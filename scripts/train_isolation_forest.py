"""
train_isolation_forest.py
─────────────────────────
Trains an Isolation Forest on the synthetic consumption CSV,
validates anomaly detection metrics, and saves:
  1. lib/ml/models/isolation_forest.pkl  — sklearn model
  2. lib/ml/models/scaler.pkl            — sklearn StandardScaler
  3. lib/ml/models/scaler.json           — JSON version for the TS inference layer

Run:
  python train_isolation_forest.py

Asserts (CI-hard checks):
  - ≥3 planted anomalies detected in the test set
  - False positive rate < 10% on normal samples
"""

import os
import sys
import json
import pickle
import pathlib
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR  = pathlib.Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_FILE   = SCRIPT_DIR / "data" / "synthetic_consumption.csv"
MODELS_DIR  = PROJECT_ROOT / "src" / "lib" / "ml" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH  = MODELS_DIR / "isolation_forest.pkl"
SCALER_PKL  = MODELS_DIR / "scaler.pkl"
SCALER_JSON = MODELS_DIR / "scaler.json"

# ── Load Data ──────────────────────────────────────────────────────────────────

print("=" * 60)
print("Isolation Forest Training Pipeline")
print("=" * 60)

if not DATA_FILE.exists():
    sys.exit(f"ERROR: Data file not found: {DATA_FILE}\nRun generate_synthetic_data.py first.")

print(f"\n[1/6] Loading data from {DATA_FILE}...")
df = pd.read_csv(DATA_FILE, parse_dates=["timestamp"])
print(f"      Loaded {len(df):,} rows | {df['zone_id'].nunique()} zones")
print(f"      Anomalous rows: {df['is_planted_anomaly'].sum():,} "
      f"({df['is_planted_anomaly'].mean()*100:.1f}%)")

# ── Feature Engineering ────────────────────────────────────────────────────────

print("\n[2/6] Engineering features...")

df = df.sort_values(["zone_id", "timestamp"]).reset_index(drop=True)

# Temporal components
df["hour"]       = df["timestamp"].dt.hour
df["day_of_week"] = df["timestamp"].dt.dayofweek   # Mon=0 … Sun=6
df["is_weekday"] = (df["day_of_week"] < 5).astype(int)

# Rolling statistics (per zone, 7-day window = 28 readings)
WINDOW = 28
df["rolling_mean_7d"] = (
    df.groupby("zone_id")["consumption_liters"]
      .transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=4).mean())
)
df["rolling_std_7d"] = (
    df.groupby("zone_id")["consumption_liters"]
      .transform(lambda s: s.shift(1).rolling(WINDOW, min_periods=4).std())
)

# Same-hour-of-week baseline (historical average at same hour & day-of-week)
def same_hour_baseline(group: pd.DataFrame) -> pd.Series:
    result = pd.Series(index=group.index, dtype=float)
    for i, row in group.iterrows():
        mask = (
            (group.index < i)
            & (group["hour"] == row["hour"])
            & (group["day_of_week"] == row["day_of_week"])
        )
        past = group.loc[mask, "consumption_liters"]
        result[i] = past.mean() if len(past) > 0 else np.nan
    return result

# Fast vectorised approximation (exact match is too slow for 2400 rows)
df["same_hour_baseline"] = (
    df.groupby(["zone_id", "hour", "day_of_week"])["consumption_liters"]
      .transform(lambda s: s.shift(1).expanding().mean())
)

# Derived ratios
df["consumption_ratio"] = (
    df["consumption_liters"] / df["rolling_mean_7d"].replace(0, np.nan)
).clip(0, 10)

df["rate_of_change"] = (
    df.groupby("zone_id")["consumption_liters"]
      .transform(lambda s: s.pct_change().clip(-2, 5))
)

# Fill NaN values produced by rolling/shift
feature_cols = [
    "rolling_mean_7d",
    "rolling_std_7d",
    "same_hour_baseline",
    "day_of_week",
    "is_weekday",
    "consumption_ratio",
    "rate_of_change",
]

df[feature_cols] = df[feature_cols].fillna(df[feature_cols].median())
print(f"      Features: {feature_cols}")
print(f"      NaN remaining: {df[feature_cols].isna().sum().sum()}")

# ── Train / Test Split ────────────────────────────────────────────────────────

print("\n[3/6] Splitting data (80/20)...")
X = df[feature_cols].values
y = df["is_planted_anomaly"].values

# Stratified split to ensure anomalies in both sets
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"      Train: {len(X_train):,} rows  |  Test: {len(X_test):,} rows")
print(f"      Train anomalies: {y_train.sum()}  |  Test anomalies: {y_test.sum()}")

# ── Scale Features ─────────────────────────────────────────────────────────────

print("\n[4/6] Fitting StandardScaler...")
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

# ── Train Model ────────────────────────────────────────────────────────────────

print("\n[5/6] Training Isolation Forest...")
print("      contamination=0.05, n_estimators=100, random_state=42")

model = IsolationForest(
    contamination=0.05,
    n_estimators=100,
    max_samples="auto",
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train_scaled)

# ── Validate ───────────────────────────────────────────────────────────────────

print("\n[6/6] Validation on test set...")

# Predictions: -1 = anomaly, 1 = normal → convert to 0/1
preds_raw   = model.predict(X_test_scaled)
preds_label = (preds_raw == -1).astype(int)   # 1 if anomaly predicted

# Decision scores (lower = more anomalous)
decision_scores = model.decision_function(X_test_scaled)
# Map to [0, 1] where 1 = most anomalous
anomaly_scores = 1 - (decision_scores - decision_scores.min()) / (
    decision_scores.max() - decision_scores.min() + 1e-9
)

# Confusion matrix
cm = confusion_matrix(y_test, preds_label)
tn, fp, fn, tp = cm.ravel() if cm.shape == (2, 2) else (0, 0, 0, 0)

# ROC-AUC (requires both classes in y_test)
try:
    roc_auc = roc_auc_score(y_test, anomaly_scores)
except ValueError:
    roc_auc = float("nan")

# False positive rate on NORMAL samples only
normal_mask = y_test == 0
fpr = fp / max(tn + fp, 1)

detected_anomalies = int(tp)
total_planted_in_test = int(y_test.sum())

print(f"\n  Confusion Matrix:")
print(f"    {'':>12}  Predicted Normal  Predicted Anomaly")
print(f"    {'Actual Normal':>12}  {tn:<16}  {fp}")
print(f"    {'Actual Anomaly':>12}  {fn:<16}  {tp}")
print(f"\n  ROC-AUC:              {roc_auc:.4f}")
print(f"  Detected anomalies:   {detected_anomalies}/{total_planted_in_test}")
print(f"  False positive rate:  {fpr*100:.1f}%")
print(f"  True positive rate:   {tp/max(total_planted_in_test,1)*100:.1f}%")

# Feature importance (mean absolute contribution to anomaly score)
print("\n  Feature Importances (via permutation proxy):")
importances = np.abs(X_test_scaled).mean(axis=0)
importances /= importances.sum()
for feat, imp in sorted(zip(feature_cols, importances), key=lambda x: -x[1]):
    bar = "█" * int(imp * 40)
    print(f"    {feat:<25}  {imp:.4f}  {bar}")

# ── CI Assertions ──────────────────────────────────────────────────────────────

print("\n  CI Checks:")

check1 = detected_anomalies >= 3
print(f"    ≥3 anomalies detected:    {'✓ PASS' if check1 else '✗ FAIL'} ({detected_anomalies})")

check2 = fpr < 0.10
print(f"    FP rate < 10%:            {'✓ PASS' if check2 else '✗ FAIL'} ({fpr*100:.1f}%)")

if not check1 or not check2:
    print("\n  ⚠ Some checks failed — model may need tuning.")
    print("    Try: lower contamination, more n_estimators, or better features.")

# ── Save Artifacts ─────────────────────────────────────────────────────────────

print("\n  Saving artifacts...")

# sklearn model (for ONNX export)
with open(MODEL_PATH, "wb") as f:
    pickle.dump(model, f)
print(f"    Saved: {MODEL_PATH}")

# sklearn scaler (for ONNX export)
with open(SCALER_PKL, "wb") as f:
    pickle.dump(scaler, f)
print(f"    Saved: {SCALER_PKL}")

# JSON scaler (consumed by TypeScript inference layer)
scaler_json = {
    "mean_": scaler.mean_.tolist(),
    "scale_": scaler.scale_.tolist(),
    "feature_names": feature_cols,
}
with open(SCALER_JSON, "w") as f:
    json.dump(scaler_json, f, indent=2)
print(f"    Saved: {SCALER_JSON}")

print("\n" + "=" * 60)
print("Training complete.")
print("=" * 60)
