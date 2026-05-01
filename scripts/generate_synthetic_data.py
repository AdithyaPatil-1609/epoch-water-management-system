# -*- coding: utf-8 -*-
# Force UTF-8 output on Windows terminals
import sys, io
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
generate_synthetic_data.py
──────────────────────────
Generates a realistic 30-day water consumption time-series for 150 zones
(5 sub-zones per each of 30 city wards), at hourly resolution.

Target row count: 150 zones × 24 hours × 30 days = 108,000 rows ✓

Columns:
  timestamp            ISO-8601 datetime (hourly)
  zone_id              Ward-01-A … Ward-30-E  (ward_number + sub-zone letter)
  consumption_liters   Float — hourly kilolitres for the zone
  anomaly_type         'normal' | 'leak' | 'theft' | 'equipment_failure' |
                       'event_spike' | 'metering_error' | 'pipe_rupture'
  is_planted_anomaly   0 | 1

5+ embedded anomaly types across 12 different zone windows.

Usage:
  cd scripts/
  python generate_synthetic_data.py
"""

import os
import csv
import random
from datetime import datetime, timedelta

# ── Config ────────────────────────────────────────────────────────────────────

RANDOM_SEED      = 42
NUM_WARDS        = 30          # city wards
SUB_ZONES        = ["A", "B", "C", "D", "E"]   # 5 sub-zones per ward
NUM_ZONES        = NUM_WARDS * len(SUB_ZONES)   # 150 total
DAYS             = 30
HOURS_PER_DAY    = 24
READINGS_PER_DAY = HOURS_PER_DAY
START_DATE       = datetime(2026, 4, 1, 0, 0, 0)

OUTPUT_DIR  = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "synthetic_consumption.csv")

random.seed(RANDOM_SEED)

# ── Zone Definitions ──────────────────────────────────────────────────────────

def make_zone_ids():
    return [f"Ward-{w:02d}-{s}" for w in range(1, NUM_WARDS + 1) for s in SUB_ZONES]

ZONE_IDS = make_zone_ids()

# Baseline hourly demand in kilolitres — larger wards get higher baseline
# Ward 1-10: residential (25–55 kL/hr)
# Ward 11-20: mixed (40–80 kL/hr)
# Ward 21-30: industrial (60–120 kL/hr)
def baseline_for(zone_id: str) -> float:
    ward_num = int(zone_id.split("-")[1])
    if ward_num <= 10:
        return random.uniform(25_000, 55_000)
    elif ward_num <= 20:
        return random.uniform(40_000, 80_000)
    else:
        return random.uniform(60_000, 120_000)

ZONE_BASELINES = {z: baseline_for(z) for z in ZONE_IDS}

# ── Anomaly Schedule ──────────────────────────────────────────────────────────
# (zone_id, anomaly_type, start_day, end_day, affected_hours_set_or_None)
# affected_hours=None → all hours affected

ANOMALY_SCHEDULE = [
    # 1. Gradual leak — Ward-03-B, days 8–18 (slow ramp +40%/day)
    ("Ward-03-B", "leak",              8,  18, None),

    # 2. Gradual leak — Ward-17-D, days 12–22
    ("Ward-17-D", "leak",             12,  22, None),

    # 3. Nighttime theft — Ward-07-A, days 5–25, 22:00–04:00
    ("Ward-07-A", "theft",             5,  25, set(range(22, 24)) | set(range(0, 5))),

    # 4. Nighttime theft — Ward-22-C, days 10–28, 23:00–03:00
    ("Ward-22-C", "theft",            10,  28, set(range(23, 24)) | set(range(0, 4))),

    # 5. Meter fault — Ward-11-E, days 10–20 (erratic ±70%)
    ("Ward-11-E", "metering_error",   10,  20, None),

    # 6. Event spike — Ward-05-B, days 7–9 (festival / stadium)
    ("Ward-05-B", "event_spike",       7,   9, None),

    # 7. Event spike — Ward-25-A, days 14–16
    ("Ward-25-A", "event_spike",      14,  16, None),

    # 8. Pipe rupture — Ward-09-C + Ward-09-D, day 21
    ("Ward-09-C", "pipe_rupture",     21,  21, None),
    ("Ward-09-D", "pipe_rupture",     21,  22, None),

    # 9. Equipment failure — Ward-14-A, days 13–17 (sudden drop)
    ("Ward-14-A", "equipment_failure",13,  17, None),

    # 10. Equipment failure — Ward-28-E, days 18–21
    ("Ward-28-E", "equipment_failure",18,  21, None),

    # 11. Metering error — Ward-19-B, days 15–25
    ("Ward-19-B", "metering_error",   15,  25, None),

    # 12. Multi-zone rupture — Ward-30-A + Ward-30-B, day 25
    ("Ward-30-A", "pipe_rupture",     25,  26, None),
    ("Ward-30-B", "pipe_rupture",     25,  26, None),
]

# Build lookup dict for O(1) anomaly resolution
_ANOMALY_LOOKUP: dict[str, list] = {}
for entry in ANOMALY_SCHEDULE:
    zone = entry[0]
    _ANOMALY_LOOKUP.setdefault(zone, []).append(entry)

def _anomaly_for(zone: str, day: int, hour: int) -> str:
    """Return anomaly type if this reading falls in an anomaly window."""
    for _, atype, start, end, hours in _ANOMALY_LOOKUP.get(zone, []):
        if start <= day <= end:
            if hours is None or hour in hours:
                return atype
    return "normal"

# ── Time-of-Day Multipliers (hourly) ──────────────────────────────────────────
# Based on real Indian municipal consumption patterns

HOUR_MULTIPLIERS = {
     0: 0.55,   1: 0.45,   2: 0.40,   3: 0.38,   4: 0.40,
     5: 0.55,   6: 0.90,   7: 1.20,   8: 1.30,   9: 1.10,
    10: 1.05,  11: 1.00,  12: 1.05,  13: 1.00,  14: 0.95,
    15: 0.92,  16: 0.95,  17: 1.05,  18: 1.20,  19: 1.25,
    20: 1.15,  21: 1.00,  22: 0.85,  23: 0.65,
}

WEEKEND_MULTIPLIER = 1.18  # Weekend residential surge

def time_multiplier(hour: int, is_weekend: bool) -> float:
    m = HOUR_MULTIPLIERS.get(hour, 1.0)
    if is_weekend:
        m *= WEEKEND_MULTIPLIER
    return m

def seasonal_trend(day: int) -> float:
    """Slight increasing trend across April (+5% over month)."""
    return 1.0 + (day / DAYS) * 0.05

# ── Anomaly Modifiers ─────────────────────────────────────────────────────────

def anomaly_start_day(zone: str, atype: str) -> int:
    for _, at, start, *_ in _ANOMALY_LOOKUP.get(zone, []):
        if at == atype:
            return start
    return 0

def apply_anomaly(base: float, anomaly_type: str, day: int, start_day: int) -> float:
    """Apply anomaly multiplier to base consumption."""
    if anomaly_type == "leak":
        # Slow ramp: +35% per day from start (caps at 4× after ~9 days)
        elapsed = day - start_day
        ramp = 1.0 + 0.35 * elapsed
        return base * min(ramp, 4.0)

    elif anomaly_type == "theft":
        # Nighttime unauthorised draw: 3–5× normal
        return base * random.uniform(3.0, 5.0)

    elif anomaly_type == "metering_error":
        # Erratic: random ±70% swing each reading
        sign = 1 if random.random() > 0.5 else -1
        magnitude = random.uniform(0.20, 0.75)
        return max(100, base * (1.0 + sign * magnitude))

    elif anomaly_type == "event_spike":
        # Sharp bounded spike (festival / match)
        return base * random.uniform(2.5, 3.2)

    elif anomaly_type == "pipe_rupture":
        # Sudden major drop in supply pressure
        elapsed = day - start_day
        # Day 0: -65%, Day 1: -30% (partial recovery)
        drop = 0.35 if elapsed == 0 else 0.70
        return base * drop

    elif anomaly_type == "equipment_failure":
        # Partial failure: supply drops to 40–55%
        return base * random.uniform(0.40, 0.55)

    return base

# ── Main Generation ────────────────────────────────────────────────────────────

def generate():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    expected_rows = NUM_ZONES * DAYS * HOURS_PER_DAY
    print(f"Generating {expected_rows:,} rows  "
          f"({NUM_ZONES} zones × {DAYS} days × {HOURS_PER_DAY} hours)")

    fieldnames = [
        "timestamp", "zone_id", "consumption_liters",
        "anomaly_type", "is_planted_anomaly"
    ]

    total_written  = 0
    total_anomalous = 0

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for zone in ZONE_IDS:
            baseline = ZONE_BASELINES[zone]

            for day in range(DAYS):
                current_date = START_DATE + timedelta(days=day)
                is_weekend   = current_date.weekday() >= 5   # Sat=5, Sun=6

                for hour in range(HOURS_PER_DAY):
                    ts           = current_date.replace(hour=hour, minute=0, second=0)
                    anomaly_type = _anomaly_for(zone, day, hour)

                    # Base consumption for this hour
                    base = (
                        baseline
                        * time_multiplier(hour, is_weekend)
                        * seasonal_trend(day)
                        * (1.0 + (random.random() - 0.5) * 0.06)   # ±3% Gaussian noise
                    )

                    if anomaly_type != "normal":
                        start_d = anomaly_start_day(zone, anomaly_type)
                        consumption = apply_anomaly(base, anomaly_type, day, start_d)
                        # Overlay small noise on anomaly
                        consumption *= (1.0 + (random.random() - 0.5) * 0.04)
                        is_planted  = 1
                    else:
                        consumption = base
                        is_planted  = 0

                    consumption = max(0.0, round(consumption, 2))

                    writer.writerow({
                        "timestamp":            ts.isoformat(),
                        "zone_id":              zone,
                        "consumption_liters":   consumption,
                        "anomaly_type":         anomaly_type,
                        "is_planted_anomaly":   is_planted,
                    })

                    total_written   += 1
                    total_anomalous += is_planted

    # ── Summary ───────────────────────────────────────────────────────────────

    total_normal = total_written - total_anomalous
    anomaly_rate = total_anomalous / total_written * 100

    print(f"\n[OK] Generated {total_written:,} rows")
    print(f"  Normal:    {total_normal:,}  ({100 - anomaly_rate:.1f}%)")
    print(f"  Anomalous: {total_anomalous:,}  ({anomaly_rate:.1f}%)")
    print(f"  Anomaly types: {len(set(e[1] for e in ANOMALY_SCHEDULE))} unique")
    print(f"  Affected zones: {len(set(e[0] for e in ANOMALY_SCHEDULE))}")
    print(f"  Output: {OUTPUT_FILE}")

    # ── Assertions ────────────────────────────────────────────────────────────

    assert total_written > 100_000, \
        f"Expected >100K rows, got {total_written:,}"
    assert total_written == expected_rows, \
        f"Row count mismatch: expected {expected_rows:,}, got {total_written:,}"
    assert total_anomalous > 0, "No anomalies planted!"
    assert anomaly_rate < 15.0, f"Anomaly rate {anomaly_rate:.1f}% too high (should be < 15%)"

    print("[OK] All sanity checks passed")

if __name__ == "__main__":
    generate()
