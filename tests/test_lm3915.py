"""
Unit tests for LM3915 Dual VU Meter Calibration Bench software suite.
Uses standard library unittest for zero-dependency execution.
"""

import math
import unittest
import sys
import os

# Add root directory to python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.lm3915_calculator import LM3915Calculator
from src.gpio_hardware import (
    DualChannelPWMGenerator,
    StatusLEDController,
    TactileButtonController
)
from src.calibration_engine import CalibrationEngine


class TestLM3915Calibration(unittest.TestCase):

    def test_lm3915_calculator_db_to_voltage(self):
        calc = LM3915Calculator(v_ref=1.25, max_output_voltage=3.3)

        # 0 dB should equal Vref (1.25V)
        v_0db = calc.db_to_voltage(0.0)
        self.assertAlmostEqual(v_0db, 1.25, delta=0.001)

        # -6 dB should equal approx Vref * 10^(-6/20) = 1.25 * 0.501187 = 0.6265V
        v_minus6 = calc.db_to_voltage(-6.0)
        self.assertAlmostEqual(v_minus6, 0.6265, delta=0.005)

        # -27 dB should equal approx Vref * 10^(-27/20) = 1.25 * 0.044668 = 0.0558V
        v_minus27 = calc.db_to_voltage(-27.0)
        self.assertAlmostEqual(v_minus27, 0.0558, delta=0.005)

    def test_lm3915_calculator_voltage_to_db(self):
        calc = LM3915Calculator(v_ref=1.25, max_output_voltage=3.3)

        db_0 = calc.voltage_to_db(1.25)
        self.assertAlmostEqual(db_0, 0.0, delta=0.001)

        db_neg = calc.voltage_to_db(0.0558)
        self.assertAlmostEqual(db_neg, -27.0, delta=0.5)

    def test_lm3915_step_thresholds(self):
        calc = LM3915Calculator(v_ref=1.25, max_output_voltage=3.3)
        thresholds = calc.get_step_thresholds()

        self.assertEqual(len(thresholds), 10)
        self.assertEqual(thresholds[0]["db"], -27)
        self.assertEqual(thresholds[9]["db"], 0)

        # Ensure step voltages are strictly increasing
        voltages = [t["voltage"] for t in thresholds]
        self.assertEqual(voltages, sorted(voltages))

    def test_expected_active_leds(self):
        calc = LM3915Calculator(v_ref=1.25)

        # 0V -> no LEDs on
        leds_off = calc.expected_active_leds(0.0, mode="bar")
        self.assertEqual(sum(leds_off), 0)

        # Vref (1.25V) -> all 10 LEDs on in bar mode
        leds_full = calc.expected_active_leds(1.25, mode="bar")
        self.assertEqual(sum(leds_full), 10)

        # Vref in dot mode -> only LED 10 on
        leds_dot = calc.expected_active_leds(1.25, mode="dot")
        self.assertTrue(leds_dot[9])
        self.assertEqual(sum(leds_dot), 1)

    def test_mock_gpio_hardware(self):
        gen = DualChannelPWMGenerator(left_pin=18, right_pin=19, is_mock=True)
        led = StatusLEDController(gpio_pin=27, is_mock=True)
        btn = TactileButtonController(gpio_pin=17, is_mock=True)

        # Verify PWM generator
        gen.set_voltages(1.25, 0.625)
        self.assertAlmostEqual(gen.left_voltage, 1.25, delta=0.001)
        self.assertAlmostEqual(gen.right_voltage, 0.625, delta=0.001)

        # Verify LED controller
        led.turn_on()
        self.assertTrue(led._led.is_active)
        led.turn_off()
        self.assertFalse(led._led.is_active)

        # Verify Button callback simulation
        pressed = []
        btn.on_press(lambda: pressed.append("pressed"))
        btn.simulate_click()
        self.assertEqual(pressed, ["pressed"])

        gen.cleanup()
        led.cleanup()
        btn.cleanup()

    def test_calibration_engine_runs(self):
        calc = LM3915Calculator(v_ref=1.25)
        gen = DualChannelPWMGenerator(is_mock=True)
        led = StatusLEDController(gpio_pin=27, is_mock=True)
        engine = CalibrationEngine(calculator=calc, generator=gen, status_led=led)

        summary = engine.run_step_threshold_test(hold_sec=0.01)
        self.assertEqual(summary["overall_status"], "PASS")
        self.assertEqual(len(summary["details"]), 10)

        ramp_summary = engine.run_voltage_ramp_test(duration_sec=0.1, fps=10)
        self.assertEqual(ramp_summary["status"], "PASS")

        balance_summary = engine.run_channel_balance_test(test_db_levels=[-6.0, 0.0], hold_sec=0.01)
        self.assertEqual(balance_summary["overall_status"], "PASS")

        gen.cleanup()
        led.cleanup()


if __name__ == "__main__":
    unittest.main()
