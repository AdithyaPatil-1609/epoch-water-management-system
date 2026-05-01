// ──────────────────────────────────────────────────────────────
// ML Pipeline Configuration
// Override any value via environment variables (see .env.local)
// ──────────────────────────────────────────────────────────────

import type { MLPipelineConfig } from '@/lib/types/anomaly';
import path from 'path';

const PROJECT_ROOT = process.cwd();

export const ML_CONFIG: MLPipelineConfig = {
  // ── Model paths ─────────────────────────────────────────────
  modelPath:
    process.env.ISOLATION_FOREST_MODEL ??
    path.join(PROJECT_ROOT, 'src', 'lib', 'ml', 'models', 'isolation_forest.onnx'),

  scalerPath:
    process.env.SCALER_PATH ??
    path.join(PROJECT_ROOT, 'src', 'lib', 'ml', 'models', 'scaler.json'),

  // ── Feature engineering window ───────────────────────────────
  /** Days used for rolling statistics (mean, std). */
  featureWindowDays: parseInt(process.env.FEATURE_WINDOW_DAYS ?? '7', 10),

  /** Minimum historical days before switching from rules → ML. */
  minHistoryDays: parseInt(process.env.MIN_HISTORY_DAYS ?? '7', 10),

  // ── Score → severity mapping ─────────────────────────────────
  //  0.00–0.30 → normal
  //  0.30–0.60 → suspicious
  //  0.60–0.85 → probable
  //  0.85–1.00 → critical
  anomalyScoreThresholds: {
    normal:     parseFloat(process.env.THRESHOLD_NORMAL     ?? '0.30'),
    suspicious: parseFloat(process.env.THRESHOLD_SUSPICIOUS ?? '0.60'),
    probable:   parseFloat(process.env.THRESHOLD_PROBABLE   ?? '0.85'),
    critical:   parseFloat(process.env.THRESHOLD_CRITICAL   ?? '0.95'),
  },

  // ── Runtime limits ───────────────────────────────────────────
  /** Timeout (ms) for a single ONNX inference call. */
  inferenceTimeoutMs: parseInt(process.env.INFERENCE_TIMEOUT_MS ?? '5000', 10),

  /** Concurrent zones per Promise.all batch. */
  batchSize: parseInt(process.env.ML_BATCH_SIZE ?? '30', 10),
};
