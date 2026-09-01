"""
Raspberry Pi 4 GPIO Hardware Abstraction Layer & Mock Drivers.

Provides clean interfaces for:
1. Tactile Switch Input (PUD_UP, debounced)
2. Status LED Output (Solid, Flash, PWM Pulse)
3. Dual Channel PWM Analog Output (GPIO 18 / 19)
4. Fallback Mock Controllers for desktop execution (macOS/x86)
"""

import time
import threading
import sys
from typing import Callable, Optional

# Attempt to import real Raspberry Pi GPIO / gpiozero modules
HAS_HARDWARE_GPIO = False
try:
    import gpiozero
    HAS_HARDWARE_GPIO = True
except (ImportError, RuntimeError):
    HAS_HARDWARE_GPIO = False


class VirtualLED:
    """Mock LED for desktop platforms without physical RPi GPIO."""

    def __init__(self, pin: int):
        self.pin = pin
        self.value = 0.0

    @property
    def is_active(self) -> bool:
        return self.value > 0.0

    def on(self):
        self.value = 1.0

    def off(self):
        self.value = 0.0

    def close(self):
        self.off()


class VirtualButton:
    """Mock Button for desktop testing."""

    def __init__(self, pin: int):
        self.pin = pin
        self.when_pressed: Optional[Callable[[], None]] = None
        self.when_held: Optional[Callable[[], None]] = None

    def simulate_press(self):
        if self.when_pressed:
            self.when_pressed()

    def simulate_hold(self):
        if self.when_held:
            self.when_held()

    def close(self):
        pass


class VirtualPWMOutputDevice:
    """Mock PWM output device for desktop testing."""

    def __init__(self, pin: int, frequency: int = 100000):
        self.pin = pin
        self.frequency = frequency
        self.value = 0.0

    def close(self):
        self.value = 0.0


class StatusLEDController:
    """Controls the front-bezel status LED with blink patterns and PWM control."""

    def __init__(self, gpio_pin: int, is_mock: bool = not HAS_HARDWARE_GPIO):
        self.pin = gpio_pin
        self.is_mock = is_mock
        self._blink_thread: Optional[threading.Thread] = None
        self._stop_blink = threading.Event()

        if not self.is_mock and HAS_HARDWARE_GPIO:
            self._led = gpiozero.PWMLED(self.pin)
        else:
            self._led = VirtualLED(self.pin)

    def set_brightness(self, value: float):
        """Set brightness level (0.0 to 1.0)."""
        self.stop_animation()
        val = min(1.0, max(0.0, value))
        if hasattr(self._led, "value"):
            self._led.value = val

    def turn_on(self):
        self.set_brightness(1.0)

    def turn_off(self):
        self.set_brightness(0.0)

    def start_blink(self, interval_sec: float = 0.5):
        """Start steady blinking pattern."""
        self.stop_animation()
        self._stop_blink.clear()

        def _blink_loop():
            state = False
            while not self._stop_blink.is_set():
                state = not state
                val = 1.0 if state else 0.0
                if hasattr(self._led, "value"):
                    self._led.value = val
                time.sleep(interval_sec)

        self._blink_thread = threading.Thread(target=_blink_loop, daemon=True)
        self._blink_thread.start()

    def start_pulse(self, duration_sec: float = 1.5):
        """Start breathing / heartbeat PWM pulse pattern."""
        self.stop_animation()
        self._stop_blink.clear()

        def _pulse_loop():
            steps = 50
            delay = duration_sec / (steps * 2)
            while not self._stop_blink.is_set():
                # Ramp up
                for i in range(steps):
                    if self._stop_blink.is_set():
                        break
                    val = i / float(steps)
                    if hasattr(self._led, "value"):
                        self._led.value = val
                    time.sleep(delay)
                # Ramp down
                for i in range(steps, -1, -1):
                    if self._stop_blink.is_set():
                        break
                    val = i / float(steps)
                    if hasattr(self._led, "value"):
                        self._led.value = val
                    time.sleep(delay)

        self._blink_thread = threading.Thread(target=_pulse_loop, daemon=True)
        self._blink_thread.start()

    def stop_animation(self):
        self._stop_blink.set()
        if self._blink_thread and self._blink_thread.is_alive():
            self._blink_thread.join(timeout=0.2)

    def cleanup(self):
        self.stop_animation()
        self.turn_off()
        if hasattr(self._led, "close"):
            self._led.close()


class TactileButtonController:
    """Handles debounced button presses from the 6x6 mm tactile switch."""

    def __init__(self, gpio_pin: int, is_mock: bool = not HAS_HARDWARE_GPIO):
        self.pin = gpio_pin
        self.is_mock = is_mock

        if not self.is_mock and HAS_HARDWARE_GPIO:
            # Wire switch between pin and GND, use internal pull-up resistor
            self._button = gpiozero.Button(
                self.pin,
                pull_up=True,
                bounce_time=0.05,
                hold_time=1.5
            )
        else:
            self._button = VirtualButton(self.pin)

    def on_press(self, callback: Callable[[], None]):
        self._button.when_pressed = callback

    def on_hold(self, callback: Callable[[], None]):
        self._button.when_held = callback

    def simulate_click(self):
        """Simulate button press (for testing/mocking)."""
        if hasattr(self._button, "simulate_press"):
            self._button.simulate_press()

    def simulate_hold(self):
        """Simulate button hold (for testing/mocking)."""
        if hasattr(self._button, "simulate_hold"):
            self._button.simulate_hold()

    def cleanup(self):
        if hasattr(self._button, "close"):
            self._button.close()


class DualChannelPWMGenerator:
    """
    Generates analog test signals for Left & Right LM3915 channels
    using RPi 4 PWM outputs (GPIO 18 and GPIO 19).
    """

    def __init__(
        self,
        left_pin: int = 18,
        right_pin: int = 19,
        max_voltage: float = 3.3,
        frequency: int = 100000,
        is_mock: bool = not HAS_HARDWARE_GPIO
    ):
        self.left_pin = left_pin
        self.right_pin = right_pin
        self.max_voltage = max_voltage
        self.frequency = frequency
        self.is_mock = is_mock

        self.left_voltage = 0.0
        self.right_voltage = 0.0

        if not self.is_mock and HAS_HARDWARE_GPIO:
            self._left_pwm = gpiozero.PWMOutputDevice(self.left_pin, frequency=self.frequency)
            self._right_pwm = gpiozero.PWMOutputDevice(self.right_pin, frequency=self.frequency)
        else:
            self._left_pwm = VirtualPWMOutputDevice(self.left_pin, frequency=self.frequency)
            self._right_pwm = VirtualPWMOutputDevice(self.right_pin, frequency=self.frequency)

    def set_channel_voltage(self, channel: str, voltage: float):
        """Set output voltage (0.0 to max_voltage) for a single channel ('left' or 'right')."""
        v_clamped = min(self.max_voltage, max(0.0, voltage))
        duty_cycle = v_clamped / self.max_voltage

        ch = channel.lower()
        if ch in ("left", "l"):
            self.left_voltage = v_clamped
            self._left_pwm.value = duty_cycle
        elif ch in ("right", "r"):
            self.right_voltage = v_clamped
            self._right_pwm.value = duty_cycle
        elif ch in ("both", "stereo", "all"):
            self.left_voltage = v_clamped
            self.right_voltage = v_clamped
            self._left_pwm.value = duty_cycle
            self._right_pwm.value = duty_cycle
        else:
            raise ValueError(f"Unknown channel: {channel}")

    def set_voltages(self, left_v: float, right_v: float):
        """Set Left and Right voltages simultaneously."""
        self.set_channel_voltage("left", left_v)
        self.set_channel_voltage("right", right_v)

    def mute(self):
        """Set both channels to 0.0V."""
        self.set_voltages(0.0, 0.0)

    def cleanup(self):
        self.mute()
        if hasattr(self._left_pwm, "close"):
            self._left_pwm.close()
        if hasattr(self._right_pwm, "close"):
            self._right_pwm.close()
