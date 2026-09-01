#!/usr/bin/env python3
"""
LM3915 Dual VU Meter Calibration Bench - CLI Application for Raspberry Pi 4.

Features:
- Real-time ASCII Dual VU Meter display (Left & Right 10-LED bargraphs)
- Interactive test modes (Step Thresholds, Voltage Ramp, Stereo Balance, Manual Knob)
- Hardware button & LED control integration (GPIO 17 Tact Switch, GPIO 27 LED)
"""

import sys
import os
import time
import json
import argparse
from typing import List

# Add src to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.lm3915_calculator import LM3915Calculator
from src.gpio_hardware import (
    DualChannelPWMGenerator,
    StatusLEDController,
    TactileButtonController,
    HAS_HARDWARE_GPIO
)
from src.calibration_engine import CalibrationEngine
from src.logger import CalibrationLogger


def render_ascii_bar(active_leds: List[bool], mode: str = "bar") -> str:
    """Render a 10-segment LED bar graph in ASCII with color coding."""
    # LED colors: Green (LEDs 1-6), Yellow (LEDs 7-8), Red (LEDs 9-10)
    # [1, 2, 3, 4, 5, 6] = Green (-27 to -9 dB)
    # [7, 8]             = Yellow (-6 to -3 dB)
    # [9, 10]            = Red (0 dB & Peak)

    chars = []
    for idx, is_on in enumerate(active_leds):
        if is_on:
            if idx < 6:
                char = "\033[92m█\033[0m"  # Green
            elif idx < 8:
                char = "\033[93m█\033[0m"  # Yellow
            else:
                char = "\033[91m█\033[0m"  # Red
        else:
            char = "\033[90m░\033[0m"      # Dim gray empty LED
        chars.append(char)

    return f"[{''.join(chars)}]"


def print_header(is_mock: bool):
    print("\033[H\033[J", end="")  # Clear terminal
    print("=" * 68)
    print("      🔊  LM3915 DUAL VU METER CALIBRATION BENCH (Raspberry Pi 4)  🔊")
    print("=" * 68)
    platform_str = "RPi 4 GPIO Hardware" if not is_mock else "Virtual Desktop (Mock Driver)"
    print(f" Platform Mode : {platform_str}")
    print(f" Controls      : Tactile Switch (GPIO 17) | Status LED (GPIO 27)")
    print(f" Signal Outputs: Left Ch (GPIO 18 PWM)    | Right Ch (GPIO 19 PWM)")
    print("=" * 68)


class CalibrationBenchCLI:
    def __init__(self, config_path: str = "config.json"):
        self.config_path = config_path
        self.load_config()

        hw_cfg = self.config.get("hardware", {})
        lm_cfg = self.config.get("lm3915", {})

        self.calc = LM3915Calculator(
            v_ref=lm_cfg.get("v_ref", 1.25),
            max_output_voltage=hw_cfg.get("max_output_voltage", 3.3)
        )

        is_mock = not HAS_HARDWARE_GPIO
        self.gen = DualChannelPWMGenerator(
            left_pin=hw_cfg.get("left_channel_pwm_gpio", 18),
            right_pin=hw_cfg.get("right_channel_pwm_gpio", 19),
            max_voltage=hw_cfg.get("max_output_voltage", 3.3),
            frequency=hw_cfg.get("pwm_frequency_hz", 100000),
            is_mock=is_mock
        )

        self.status_led = StatusLEDController(
            gpio_pin=hw_cfg.get("status_led_gpio", 27),
            is_mock=is_mock
        )

        self.button = TactileButtonController(
            gpio_pin=hw_cfg.get("button_gpio", 17),
            is_mock=is_mock
        )

        self.logger = CalibrationLogger(
            output_dir=self.config.get("test_suite", {}).get("output_dir", "./calibration_reports")
        )

        self.engine = CalibrationEngine(
            calculator=self.calc,
            generator=self.gen,
            status_led=self.status_led,
            logger=self.logger
        )

        self.is_mock = is_mock
        self.status_led.turn_on()

        # Set button callbacks
        self.button.on_press(self.handle_button_press)
        self.button.on_hold(self.handle_button_hold)

        self.current_manual_step = 0

    def load_config(self):
        if os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
        else:
            self.config = {}

    def handle_button_press(self):
        """Short button press: advance manual step."""
        self.current_manual_step = (self.current_manual_step + 1) % 11
        if self.current_manual_step == 0:
            target_v = 0.0
        else:
            thresholds = self.calc.get_step_thresholds()
            target_v = thresholds[self.current_manual_step - 1]["voltage"]

        self.gen.set_voltages(target_v, target_v)

    def handle_button_hold(self):
        """Long button hold: trigger automatic test suite."""
        print("\n\n>>> Physical button hold detected! Launching Auto Calibration...")
        self.run_auto_calibration_suite()

    def run_auto_calibration_suite(self):
        """Executes complete automated calibration sequence."""
        print_header(self.is_mock)
        print("\n⚡ [1/3] Running Step Threshold Verification Test (-27 dB to 0 dB)...")

        def _step_progress(step, db, voltage, leds):
            left_bar = render_ascii_bar(leds)
            right_bar = render_ascii_bar(leds)
            print(f"   Step {step:2d} | {db:3d} dB | {voltage:.4f}V | L: {left_bar}  R: {right_bar}")

        step_summary = self.engine.run_step_threshold_test(
            hold_sec=1.0,
            progress_callback=_step_progress
        )

        print("\n⚡ [2/3] Running Smooth Voltage Ramp Sweep Test...")

        def _ramp_progress(t_sec, voltage, leds):
            left_bar = render_ascii_bar(leds)
            print(f"   Time {t_sec:4.1f}s | Output {voltage:.3f}V | {left_bar}\r", end="")

        ramp_summary = self.engine.run_voltage_ramp_test(
            duration_sec=4.0,
            progress_callback=_ramp_progress
        )
        print("\n")

        print("⚡ [3/3] Running Dual Channel Stereo Balance Test...")
        balance_summary = self.engine.run_channel_balance_test()

        print("\n" + "=" * 68)
        print(" SUCCESS: Calibration Test Suite Completed!")
        print(f" Saved Reports: {step_summary['saved_files']['json']}")
        print("=" * 68)

    def run_interactive_menu(self):
        """Runs the main interactive terminal CLI menu loop."""
        while True:
            print_header(self.is_mock)
            thresholds = self.calc.get_step_thresholds()

            print("\n📋 SELECT CALIBRATION TEST MODE:\n")
            print("  [1] Run Automated Full Calibration Suite")
            print("  [2] Step Threshold Calibration Test (-27 dB to 0 dB)")
            print("  [3] Smooth Voltage Ramp Sweep Test (0V to 1.25V)")
            print("  [4] Dual Channel Stereo Balance & Crosstalk Test")
            print("  [5] Manual Voltage / Step Selector (Press Button to advance)")
            print("  [6] Display LM3915 Reference Threshold Table")
            print("  [Q] Quit Application\n")

            if self.is_mock:
                print("  [B] (Dev Mock) Simulate Physical Button Click (Short Press)")
                print("  [H] (Dev Mock) Simulate Physical Button Hold (Long Press)")

            choice = input("\nEnter choice [1-6, Q]: ").strip().lower()

            if choice == "1":
                self.run_auto_calibration_suite()
                input("\nPress Enter to return to menu...")
            elif choice == "2":
                print_header(self.is_mock)
                print("\nRunning Step Threshold Test...")
                self.engine.run_step_threshold_test(
                    hold_sec=1.2,
                    progress_callback=lambda s, db, v, leds: print(
                        f" Step {s:2d} ({db:3d} dB): {v:.4f}V -> {render_ascii_bar(leds)}"
                    )
                )
                input("\nPress Enter to return to menu...")
            elif choice == "3":
                print_header(self.is_mock)
                print("\nRunning Voltage Ramp Test...")
                self.engine.run_voltage_ramp_test(
                    duration_sec=5.0,
                    progress_callback=lambda t, v, leds: print(
                        f" {t:4.1f}s | {v:.3f}V | {render_ascii_bar(leds)}\r", end=""
                    )
                )
                print("\nDone!")
                input("\nPress Enter to return to menu...")
            elif choice == "4":
                print_header(self.is_mock)
                print("\nRunning Dual Channel Balance Test...")
                summary = self.engine.run_channel_balance_test()
                print(f"Overall Balance Test Result: {summary['overall_status']}")
                input("\nPress Enter to return to menu...")
            elif choice == "5":
                self.run_manual_mode()
            elif choice == "6":
                self.display_threshold_table()
                input("\nPress Enter to return to menu...")
            elif choice == "b" and self.is_mock:
                self.button.simulate_click()
            elif choice == "h" and self.is_mock:
                self.button.simulate_hold()
            elif choice == "q":
                print("\nExiting LM3915 Calibration Bench. Muting hardware outputs...")
                self.cleanup()
                sys.exit(0)

    def run_manual_mode(self):
        """Interactive manual voltage generator mode."""
        print_header(self.is_mock)
        print("\n🎛️  MANUAL STEP & VOLTAGE CONTROL MODE")
        print("  Use 'n' for Next Step, 'p' for Prev Step, or type a voltage (0.0 to 3.3V).")
        print("  Type 'q' to exit manual mode.\n")

        thresholds = self.calc.get_step_thresholds()

        while True:
            cur_v = self.gen.left_voltage
            cur_db = self.calc.voltage_to_db(cur_v) if cur_v > 0 else -math.inf
            left_leds = self.calc.expected_active_leds(cur_v, mode="bar")
            right_leds = self.calc.expected_active_leds(self.gen.right_voltage, mode="bar")

            print(f"\r  Left : {render_ascii_bar(left_leds)}  {cur_v:.4f} V ({cur_db:5.1f} dB)")
            print(f"  Right: {render_ascii_bar(right_leds)}  {self.gen.right_voltage:.4f} V")

            cmd = input("\nManual Input [n/p/voltage/q]: ").strip().lower()
            if cmd == "q":
                break
            elif cmd == "n":
                self.current_manual_step = min(10, self.current_manual_step + 1)
            elif cmd == "p":
                self.current_manual_step = max(0, self.current_manual_step - 1)
            else:
                try:
                    v_val = float(cmd)
                    self.gen.set_voltages(v_val, v_val)
                    continue
                except ValueError:
                    print("Invalid input!")
                    continue

            if self.current_manual_step == 0:
                self.gen.mute()
            else:
                t_v = thresholds[self.current_manual_step - 1]["voltage"]
                self.gen.set_voltages(t_v, t_v)

    def display_threshold_table(self):
        print_header(self.is_mock)
        print("\n📊 LM3915 LOGARITHMIC STEP REFERENCE TABLE (Vref = 1.25V)")
        print("-" * 65)
        print(f" {'Step':^6} | {'dB Level':^10} | {'Nominal (V)':^13} | {'PWM Duty (%)':^14} | {'Bar Pattern':^10}")
        print("-" * 65)

        for item in self.calc.get_step_thresholds():
            leds = self.calc.expected_active_leds(item["voltage"], mode="bar")
            bar = "".join(["1" if b else "0" for b in leds])
            print(f" {item['step']:^6d} | {item['db']:^10d} | {item['voltage']:^13.4f} | {item['duty_cycle_pct']:^14.2f} | {bar:^10}")

        print("-" * 65)

    def cleanup(self):
        self.gen.cleanup()
        self.status_led.cleanup()
        self.button.cleanup()


def main():
    parser = argparse.ArgumentParser(description="LM3915 Dual VU Meter Calibration Bench CLI")
    parser.add_argument("--config", default="config.json", help="Path to config.json file")
    parser.add_argument("--auto", action="store_true", help="Run automated test suite and exit")

    args = parser.parse_args()

    app = CalibrationBenchCLI(config_path=args.config)
    try:
        if args.auto:
            app.run_auto_calibration_suite()
            app.cleanup()
        else:
            app.run_interactive_menu()
    except KeyboardInterrupt:
        print("\nKeyboard interrupt received. Cleaning up...")
        app.cleanup()


if __name__ == "__main__":
    main()
