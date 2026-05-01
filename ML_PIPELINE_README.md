# ML Pipeline — Isolation Forest Anomaly Detection

Water consumption anomaly detection using Isolation Forest, exported to ONNX for
production inference in the Next.js backend.

---

## 1. Overview

### Problem
Urban water distribution networks lose 25–40% of supply to undetected leaks, theft,
and meter faults. Manual inspection cannot scale across 20+ zones checked every 15 min.

### Solution
An **Isolation Forest** model trained on 30-day synthetic consumption history detects
five anomaly types automatically:

| Anomaly | Signal | Severity |
|---------|--------|----------|
| Gradual leak | Slow ramp-up over days | Probable → Critical |
| Nighttime theft | Spike at 11 PM–5 AM | Suspicious → Probable |
| Meter fault | Erratic high-variance readings | Suspicious |
| Event spike | Short-duration 2–3× surge | Suspicious |
| Pipe rupture | Sudden multi-zone drop | Critical |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  TRAINING (Python)                                                  │
│                                                                     │
│  generate_synthetic_data.py                                         │
│    └─→ scripts/data/synthetic_consumption.csv                       │
│                                                                     │
│  train_isolation_forest.py                                          │
│    └─→ lib/ml/models/isolation_forest.pkl  (sklearn)                │
│    └─→ lib/ml/models/scaler.pkl            (sklearn scaler)         │
│    └─→ lib/ml/models/scaler.json           (JSON for TS layer)      │
│                                                                     │
│  export_to_onnx.py                                                  │
│    └─→ lib/ml/models/isolation_forest.onnx (ONNX Runtime)          │
└───────────────────────────────────────────┬─────────────────────────┘
                                            │
┌───────────────────────────────────────────▼─────────────────────────┐
│  INFERENCE (TypeScript / Next.js API)                               │
│                                                                     │
│  GET /api/anomalies                                                 │
│    └─→ IsolationForestInference.scoreMultipleZones()                │
│           ├─ computeFeatures()   (7 engineered features)            │
│           ├─ applyScaler()       (StandardScaler in TS)             │
│           ├─ ONNX Runtime infer  (isolation_forest.onnx)            │
│           │      on fail ↓                                          │
│           └─ FallbackRuleEngine.scoreWithRules()                    │
│                                                                     │
│  Returns: AnomalyScore[] sorted by anomaly_score desc               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Quick Start

### Phase 1 — Python (5 min)

```bash
cd scripts/
pip install -r requirements.txt

# Step 1: Generate data
python generate_synthetic_data.py
# → scripts/data/synthetic_consumption.csv  (~2,400 rows)

# Step 2: Train model
python train_isolation_forest.py
# → src/lib/ml/models/isolation_forest.pkl
# → src/lib/ml/models/scaler.pkl
# → src/lib/ml/models/scaler.json
# Console: confusion matrix, ROC-AUC, CI check results

# Step 3: Export to ONNX
python export_to_onnx.py
# → src/lib/ml/models/isolation_forest.onnx
# Console: "✓ ONNX model validated successfully"
```

### Phase 2 — TypeScript (2 min)

```bash
# Install ONNX Runtime for Node
npm install onnxruntime-node

# Run tests (rule-based tests run without model; ML tests need Phase 1 done)
npx jest isolation-forest --passWithNoTests

# Type-check the whole project
npx tsc --noEmit
```

### Phase 3 — Start Dev Server

```bash
npm run dev
# → http://localhost:3000/api/anomalies   (uses ML model if present, rules otherwise)
```

---

## 3. Architecture

### Feature Engineering

Seven features are computed per reading from the preceding 7-day window:

| Feature | Description | Why it matters |
|---------|-------------|----------------|
| `rolling_mean_7d` | Average consumption last 7 days | Adaptive baseline |
| `rolling_std_7d` | Standard deviation last 7 days | Variance signature |
| `same_hour_baseline` | Avg at same hour × day-of-week | Captures seasonality |
| `day_of_week` | 0 (Mon) – 6 (Sun) | Weekend surge pattern |
| `is_weekday` | 1/0 | Simplified binary |
| `consumption_ratio` | current / rolling_mean_7d | Key leak indicator |
| `rate_of_change` | (current − prev) / prev | Detects sudden events |

Features are z-score normalized using sklearn `StandardScaler` before inference.
The scaler parameters are saved to `scaler.json` and re-applied identically in TypeScript.

### Gini Coefficient Integration

The fairness engine (`src/lib/fairness.ts`) consumes `ZoneSummary[]` to compute
a Gini coefficient over zone fulfillment ratios (supply ÷ demand). Anomaly scores
from the ML pipeline feed into this as demand-side signals:

- A zone with `severity='critical'` has its `current_consumption_ML` inflated in the
  redistribution optimizer, making it a higher-priority redistribution target.
- This links anomaly detection directly to the fairness-equity metric displayed in
  the Redistribution page.

---

## 4. API Integration

### Endpoint

```
GET /api/anomalies
```

### How the ML engine is used

```typescript
// src/app/api/anomalies/route.ts (simplified)
import { getMLEngine } from '@/lib/ml/isolation-forest-inference';
import { ML_CONFIG } from '@/config/ml.config';
import { getZones, getRecords } from '@/lib/data-cache';

export async function GET() {
  const mlEngine = await getMLEngine(ML_CONFIG);   // singleton, loaded once
  const zones = getZones();
  const records = getRecords();

  const zoneInputs = zones.map(zone => ({
    zone_id: zone.zone_id,
    current_consumption: /* latest reading */,
    timestamp: new Date(),
    historicalData: /* last 56 readings */,
  }));

  const scores = await mlEngine.scoreMultipleZones(zoneInputs, ML_CONFIG);
  return NextResponse.json({ anomalies: scores });
}
```

### Example Response

```json
{
  "anomalies": [
    {
      "zone_id": "Zone-D",
      "timestamp": "2026-04-17T18:00:00.000Z",
      "consumption_liters": 273600,
      "anomaly_score": 0.891,
      "severity": "critical",
      "explanation": "Consumption 3.4x rolling mean — critical anomaly",
      "reason_factors": ["high-consumption-ratio", "sharp-increase"],
      "baseline_consumption": 80470,
      "consumption_ratio": 3.4,
      "detection_method": "ml"
    }
  ]
}
```

---

## 5. Troubleshooting

### `ModuleNotFoundError: No module named 'skl2onnx'`
```bash
pip install skl2onnx onnxruntime
```

### `Cannot find module 'onnxruntime-node'`
```bash
npm install onnxruntime-node
```
> Note: `onnxruntime-node` requires Node.js ≥18 and compiles a native addon.
> If build fails, the app will automatically use the rule-based fallback.

### ONNX model not found at runtime
The API and inference layer gracefully fall back to `scoreWithRules()` automatically.
You will see a console log:
```
[IsolationForest] Failed to load ONNX model: ...
```
The `/api/anomalies` endpoint still returns valid results using the rule engine.

### Training assertion failures
If `train_isolation_forest.py` reports `✗ FAIL` on the CI checks:
1. Try increasing `n_estimators` to 200
2. Lower `contamination` to 0.03 if FP rate is too high
3. Check that `synthetic_consumption.csv` has at least 500 rows

### Slow inference (> 3s per request)
- The ONNX model should score 30 zones in < 500ms
- If slow, verify `CPUExecutionProvider` is used (not GPU stub)
- Reduce `batchSize` to 10 if memory-constrained

---

## 6. Testing

### Run all pipeline tests

```bash
# Rule-based tests only (no model needed)
npx jest isolation-forest --passWithNoTests

# Full suite (requires Python Phase 1 completed)
ONNX_AVAILABLE=1 npx jest isolation-forest
```

### Expected output (all phases done)

```
  Isolation Forest ML Pipeline
    a) Model loading
      ✓ should instantiate IsolationForestInference without throwing
      ✓ should load ONNX model and scaler successfully
    b) Score range validation
      ✓ rule engine: 10 normal readings should all score 0 ≤ score ≤ 1
      ✓ rule engine: normal readings should score < 0.3
      ✓ ML engine: 10 normal readings should all score 0 ≤ score ≤ 1
    c) Planted anomaly detection
      ✓ rule engine: should detect leak (3x baseline) as probable or critical
      ✓ rule engine: should detect theft (4.5x at night)
      ✓ rule engine: should detect equipment failure (0.3x baseline)
      ✓ rule engine: should detect sustained elevation over 3 readings
      ✓ ML engine: ≥3 planted anomalies from CSV detected with score > 0.6
    d) False positive rate
      ✓ rule engine: FP rate < 10% on 100 normal readings at midday
      ✓ ML engine: FP rate < 10% on 100 normal CSV readings
    e) Fallback rule detector independence
      ✓ should return valid AnomalyScore without any model
      ✓ should return all four severity values for appropriate inputs
      ✓ should never throw regardless of input
    f) Batch inference performance
      ✓ rule engine: 25 zones batch should complete in < 3 seconds
      ✓ ML engine: 25 zones batch should complete in < 3 seconds

  Tests: 17 passed  |  Time: ~8s
```

### Validate model accuracy independently

```bash
# Re-run training and check the printed metrics
python scripts/train_isolation_forest.py

# Expected:
#   ROC-AUC:    > 0.80
#   Detected:   ≥3 planted anomalies in test split
#   FP rate:    < 10%
```
