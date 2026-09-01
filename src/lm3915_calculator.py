"""
LM3915 Logarithmic Step Calculator & Calibration Math.

The LM3915 is a monolithic integrated circuit that senses analog voltage levels
and drives a 10-segment logarithmic display spanning 27 dB in 3 dB steps:
[-27, -24, -21, -18, -15, -12, -9, -6, -3, 0] dB.
"""

import math
from typing import List, Dict, Tuple


class LM3915Calculator:
    """Calculates voltage thresholds, dB levels, and expected LED states for LM3915."""

    DEFAULT_DB_STEPS = [-27, -24, -21, -18, -15, -12, -9, -6, -3, 0]

    def __init__(self, v_ref: float = 1.25, max_output_voltage: float = 3.3):
        """
        Initialize the LM3915 calculator.

        :param v_ref: Full scale reference voltage (0 dB level), default 1.25V.
        :param max_output_voltage: Maximum voltage reachable by DAC/PWM (default 3.3V).
        """
        if v_ref <= 0:
            raise ValueError("v_ref must be greater than 0")
        if max_output_voltage <= 0:
            raise ValueError("max_output_voltage must be greater than 0")

        self.v_ref = v_ref
        self.max_output_voltage = max_output_voltage

    def db_to_voltage(self, db: float) -> float:
        """
        Convert a dB level relative to Vref to nominal voltage.
        V = Vref * 10^(db / 20)
        """
        return self.v_ref * math.pow(10.0, db / 20.0)

    def voltage_to_db(self, voltage: float) -> float:
        """
        Convert a voltage to dB level relative to Vref.
        dB = 20 * log10(V / Vref)
        """
        if voltage <= 0:
            return -math.inf
        return 20.0 * math.log10(voltage / self.v_ref)

    def get_step_thresholds(self) -> List[Dict[str, float]]:
        """
        Get expected voltage thresholds and duty cycles for all 10 LM3915 steps.

        Returns a list of dicts:
        [
          {
            "step": 1..10,
            "db": -27,
            "voltage": 0.0445,
            "duty_cycle_pct": 1.35,
            "ratio_of_vref": 0.0356
          }, ...
        ]
        """
        thresholds = []
        for idx, db in enumerate(self.DEFAULT_DB_STEPS, start=1):
            v_nom = self.db_to_voltage(db)
            duty_cycle = (v_nom / self.max_output_voltage) * 100.0
            duty_cycle = min(100.0, max(0.0, duty_cycle))
            thresholds.append({
                "step": idx,
                "db": db,
                "voltage": round(v_nom, 4),
                "duty_cycle_pct": round(duty_cycle, 2),
                "ratio_of_vref": round(v_nom / self.v_ref, 4)
            })
        return thresholds

    def voltage_to_duty_cycle(self, voltage: float) -> float:
        """Convert a target voltage (0..max_output_voltage) to PWM duty cycle (0..100%)."""
        duty = (voltage / self.max_output_voltage) * 100.0
        return min(100.0, max(0.0, duty))

    def duty_cycle_to_voltage(self, duty_cycle_pct: float) -> float:
        """Convert PWM duty cycle (0..100%) to target output voltage."""
        return (duty_cycle_pct / 100.0) * self.max_output_voltage

    def expected_active_leds(self, voltage: float, mode: str = "bar") -> List[bool]:
        """
        Determine which of the 10 LEDs should be lit for a given input voltage.

        :param voltage: Input voltage applied to LM3915 signal pin.
        :param mode: 'bar' (all LEDs up to current step on) or 'dot' (only top LED on).
        :return: List of 10 booleans representing LED 1..10 states.
        """
        thresholds = [t["voltage"] for t in self.get_step_thresholds()]
        active_step = 0

        # Determine highest step triggered (with small hysteresis band)
        for idx, v_thresh in enumerate(thresholds, start=1):
            if voltage >= (v_thresh * 0.95):  # 5% lower bound threshold for LED activation
                active_step = idx

        if active_step == 0:
            return [False] * 10

        if mode.lower() == "dot":
            leds = [False] * 10
            leds[active_step - 1] = True
            return leds
        else:  # bar mode
            return [i < active_step for i in range(10)]
