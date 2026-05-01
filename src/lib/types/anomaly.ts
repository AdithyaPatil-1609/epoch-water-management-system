// ──────────────────────────────────────────────────────────────
// Anomaly Detection Type Definitions
// Shared between ML inference, rule engine, and API routes
// ──────────────────────────────────────────────────────────────

export interface ConsumptionReading {
 zone_id: string;
 timestamp: Date;
 consumption_liters: number;
}

export type AnomalySeverity = 'normal' | 'suspicious' | 'probable' | 'critical';
export type DetectionMethod = 'ml' | 'rule_based';

export interface AnomalyScore {
 zone_id: string;
 timestamp: Date;
 consumption_liters: number;

 /** 0–1 scale. Higher = more anomalous. */
 anomaly_score: number;

 severity: AnomalySeverity;

 /** Plain-language explanation for the operator. */
 explanation: string;

 /** Fine-grained contributing factors, e.g. ["slow ramp", "pressure drop"]. */
 reason_factors?: string[];

 /** Average baseline consumption over the feature window (litres). */
 baseline_consumption?: number;

 /** current / rolling_mean — useful for UI display. */
 consumption_ratio?: number;

 /** Which detector produced this score. */
 detection_method: DetectionMethod;
}

export interface MLPipelineConfig {
 /** Absolute or relative path to the ONNX model file. */
 modelPath: string;

 /** Absolute or relative path to the sklearn StandardScaler pickle. */
 scalerPath: string;

 /** Minimum days of history needed before running ML inference. */
 minHistoryDays: number;

 /** Number of days used to compute rolling features. */
 featureWindowDays: number;

 /**
 * Score thresholds that map a raw anomaly_score (0–1) to a severity.
 * score < normal → 'normal'
 * score < suspicious → 'suspicious'
 * score < probable → 'probable'
 * score >= probable → 'critical'
 */
 anomalyScoreThresholds: {
 normal: number;
 suspicious: number;
 probable: number;
 critical: number;
 };

 /** Hard timeout (ms) for a single ONNX inference call. */
 inferenceTimeoutMs: number;

 /** Max zones scored concurrently in Promise.all batches. */
 batchSize: number;
}


export interface FeatureVector {
 rolling_mean_7d: number;
 rolling_std_7d: number;
 same_hour_baseline: number;
 day_of_week: number; // 0 (Mon) – 6 (Sun)
 is_weekday: number; // 1 | 0
 consumption_ratio: number; // current / rolling_mean_7d
 rate_of_change: number; // (current - previous) / previous
}

// ── Zone input shape for batch scoring ────────────────────────

export interface ZoneInput {
 zone_id: string;
 current_consumption: number;
 timestamp: Date;
 historicalData: Array<{ timestamp: Date; consumption: number }>;
}
