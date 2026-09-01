"""
Calibration Result Logger & Exporter for LM3915 Test Bench.
"""

import json
import csv
import os
import time
from typing import Dict, List, Any


class CalibrationLogger:
    """Logs and exports test run metrics to JSON and CSV formats."""

    def __init__(self, output_dir: str = "./calibration_reports"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_filename(self, test_name: str, ext: str) -> str:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"{test_name}_{timestamp}.{ext}"
        return os.path.join(self.output_dir, filename)

    def save_json_report(self, test_name: str, summary: Dict[str, Any]) -> str:
        filepath = self.generate_filename(test_name, "json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        return filepath

    def save_csv_steps(self, test_name: str, step_data: List[Dict[str, Any]]) -> str:
        filepath = self.generate_filename(test_name, "csv")
        if not step_data:
            return filepath

        fieldnames = list(step_data[0].keys())
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(step_data)
        return filepath
