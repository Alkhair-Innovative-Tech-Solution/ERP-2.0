"""
data_utils.py — Consolidated data source utility
=================================================
Single source of truth for reading data from either:
  - Local CSV files (read_csv_data)
  - Google Sheets API (get_sheet_data — fallback)

Usage:
  from data_utils import read_csv_data
  rows = read_csv_data('students.csv')
"""

import csv
import os


def read_csv_data(filepath):
    """
    Read a CSV file and return list of dicts.
    Same return format as google_sheets_util.get_sheet_data().

    Args:
        filepath: Path to CSV file (absolute, or relative to CWD).

    Returns:
        list[dict] — each dict key is a stripped header, value is a string.
        Returns [] if file not found or empty.
    """
    if not os.path.exists(filepath):
        print(f"   [read_csv_data] File not found: {filepath}")
        return []

    try:
        with open(filepath, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = [h.strip() for h in (reader.fieldnames or [])]
            if not headers:
                print(f"   [read_csv_data] No headers found in: {filepath}")
                return []

            rows = []
            for row in reader:
                cleaned = {}
                for k, v in row.items():
                    key = k.strip() if k else ''
                    cleaned[key] = v.strip() if v else ''
                rows.append(cleaned)

            print(f"   [read_csv_data] {len(rows)} rows loaded from {filepath}")
            return rows

    except Exception as e:
        print(f"   [read_csv_data] Error reading {filepath}: {e}")
        return []
