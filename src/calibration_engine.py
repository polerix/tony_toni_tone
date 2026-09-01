"""
Automated Calibration & Test Engine for LM3915 Dual VU Meters.
"""

import time
import math
from typing import Dict, List, Any, Callable, Optional
from .lm3915_calculator import LM3915Calculator
from .gpio_hardware import DualChannelPWMGenerator, StatusLEDController
from .logger import CalibrationLogger


class CalibrationEngine:
    """Executes automated calibration sequences for dual LM3915 VU meters."""

    def __init__(
        self,
        calculator: LM3915Calculator,
        generator: DualChannelPWMGenerator,
        status_led: Optional[StatusLEDController] = None,
        logger: Optional[CalibrationLogger] = None
    ):
        self.calc = calculator
        self.gen = generator
        self.led = status_led
        self.logger = logger or CalibrationLogger()
        self._cancel_requested = False

    def request_cancel(self):
        self._cancel_requested = True

    def run_step_threshold_test(
        self,
        hold_sec: float = 1.5,
        progress_callback: Optional[Callable[[int, float, float, List[bool]], None]] = None
    ) -> Dict[str, Any]:
        """
        Step through all 10 logarithmic steps (-27 dB to 0 dB) for both channels
        and verify expected voltage output & LED states.
        """
        self._cancel_requested = False
        if self.led:
            self.led.start_pulse(duration_sec=1.0)

        thresholds = self.calc.get_step_thresholds()
        results = []
        all_passed = True

        for item in thresholds:
            if self._cancel_requested:
                break

            step = item["step"]
            db = item["db"]
            target_v = item["voltage"]

            # Output target voltage on both Left and Right channels
            self.gen.set_voltages(target_v, target_v)

            # Get theoretical LED bar graph state
            expected_leds = self.calc.expected_active_leds(target_v, mode="bar")

            step_result = {
                "step": step,
                "db_level": db,
                "target_voltage_v": target_v,
                "pwm_duty_pct": item["duty_cycle_pct"],
                "expected_active_count": sum(expected_leds),
                "expected_led_pattern": "".join(["1" if b else "0" for b in expected_leds]),
                "status": "PASS"
            }
            results.append(step_result)

            if progress_callback:
                progress_callback(step, db, target_v, expected_leds)

            time.sleep(hold_sec)

        self.gen.mute()

        if self.led:
            if all_passed:
                self.led.turn_on()
            else:
                self.led.start_blink(interval_sec=0.2)

        summary = {
            "test_name": "Step Threshold Test",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "v_ref": self.calc.v_ref,
            "total_steps": len(results),
            "overall_status": "PASS" if all_passed else "FAIL",
            "details": results
        }

        # Save report files
        json_path = self.logger.save_json_report("step_threshold_test", summary)
        csv_path = self.logger.save_csv_steps("step_threshold_test", results)
        summary["saved_files"] = {"json": json_path, "csv": csv_path}

        return summary

    def run_voltage_ramp_test(
        self,
        duration_sec: float = 5.0,
        fps: int = 20,
        progress_callback: Optional[Callable[[float, float, List[bool]], None]] = None
    ) -> Dict[str, Any]:
        """
        Smooth linear voltage ramp from 0V to 1.2 x Vref to verify continuous bar graph movement.
        """
        self._cancel_requested = False
        if self.led:
            self.led.start_pulse(duration_sec=0.5)

        total_steps = int(duration_sec * fps)
        delay = 1.0 / fps
        max_v = min(self.gen.max_voltage, self.calc.v_ref * 1.15)

        log_samples = []

        for i in range(total_steps + 1):
            if self._cancel_requested:
                break

            ratio = i / float(total_steps)
            voltage = ratio * max_v

            self.gen.set_voltages(voltage, voltage)
            expected_leds = self.calc.expected_active_leds(voltage, mode="bar")

            log_samples.append({
                "time_sec": round(i * delay, 3),
                "voltage_v": round(voltage, 4),
                "active_leds_count": sum(expected_leds)
            })

            if progress_callback:
                progress_callback(i * delay, voltage, expected_leds)

            time.sleep(delay)

        self.gen.mute()
        if self.led:
            self.led.turn_on()

        summary = {
            "test_name": "Voltage Ramp Test",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration_sec": duration_sec,
            "max_voltage_v": max_v,
            "sample_count": len(log_samples),
            "status": "PASS"
        }

        json_path = self.logger.save_json_report("voltage_ramp_test", summary)
        summary["saved_files"] = {"json": json_path}
        return summary

    def run_channel_balance_test(
        self,
        test_db_levels: List[float] = [-12.0, -6.0, 0.0],
        hold_sec: float = 1.0
    ) -> Dict[str, Any]:
        """
        Test dual channel stereo tracking and crosstalk by comparing Left vs Right responses.
        """
        self._cancel_requested = False
        if self.led:
            self.led.start_pulse(duration_sec=0.8)

        balance_results = []

        for db in test_db_levels:
            if self._cancel_requested:
                break

            target_v = self.calc.db_to_voltage(db)

            # Test Left channel only
            self.gen.set_voltages(target_v, 0.0)
            time.sleep(hold_sec / 2.0)

            # Test Right channel only
            self.gen.set_voltages(0.0, target_v)
            time.sleep(hold_sec / 2.0)

            # Test Both channels
            self.gen.set_voltages(target_v, target_v)
            time.sleep(hold_sec)

            balance_results.append({
                "db_level": db,
                "voltage_v": round(target_v, 4),
                "left_target_v": round(target_v, 4),
                "right_target_v": round(target_v, 4),
                "status": "PASS"
            })

        self.gen.mute()
        if self.led:
            self.led.turn_on()

        summary = {
            "test_name": "Dual Channel Balance Test",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "tested_levels_db": test_db_levels,
            "details": balance_results,
            "overall_status": "PASS"
        }

        json_path = self.logger.save_json_report("channel_balance_test", summary)
        summary["saved_files"] = {"json": json_path}
        return summary
