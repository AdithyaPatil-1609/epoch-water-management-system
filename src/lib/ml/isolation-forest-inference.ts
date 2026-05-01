// ──────────────────────────────────────────────────────────────
// Isolation Forest ONNX Inference Engine
//
// Loads the ONNX model + JSON scaler produced by:
//   scripts/train_isolation_forest.py
//   scripts/export_to_onnx.py
//
// Falls back to rule-based detection if ONNX Runtime fails.
// Never throws — always returns a valid AnomalyScore[].
// ──────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import type {
  AnomalyScore,
  AnomalySeverity,
  MLPipelineConfig,
  ZoneInput,
} from '@/lib/types/anomaly';
import { scoreWithRules } from './fallback-rule-engine';
import { computeFeatures, normalizeForONNX, type EngineeredFeatures } from '@/lib/feature-engineering';

// ── Scaler shape (JSON written by Python export script) ────────
interface ScalerParams {
  mean_: number[];
  scale_: number[];
  feature_names: string[];
}

// ── ONNX Runtime (optional peer dep) ──────────────────────────
// We import lazily so the module can be used in edge-runtime-lite
// environments that don't have onnxruntime-node available.
type OrtSession = {
  run: (feeds: Record<string, OrtTensor>) => Promise<Record<string, OrtTensor>>;
};
type OrtTensor = {
  data: Float32Array | BigInt64Array;
  dims: number[];
  /** onnxruntime-node attaches cpuData for sequence/map outputs */
  cpuData?: Float32Array | number[];
};
type OrtModule = {
  InferenceSession: {
    create: (modelPath: string) => Promise<OrtSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => OrtTensor;
};

// ── Feature Engineering ────────────────────────────────────────



function scoreToSeverity(
  score: number,
  thresholds: MLPipelineConfig['anomalyScoreThresholds']
): AnomalySeverity {
  if (score >= thresholds.probable) return 'critical';
  if (score >= thresholds.suspicious) return 'probable';
  if (score >= thresholds.normal) return 'suspicious';
  return 'normal';
}

function buildExplanation(
  features: EngineeredFeatures,
  severity: AnomalySeverity,
  zoneId: string
): { explanation: string; factors: string[] } {
  const factors: string[] = [];
  const parts: string[] = [];

  const ratio = features.consumption_ratio;
  if (ratio > 2.5) {
    factors.push('high-consumption-ratio');
    parts.push(`Consumption ${ratio.toFixed(1)}x rolling mean`);
  } else if (ratio < 0.4) {
    factors.push('low-consumption-ratio');
    parts.push(`Consumption only ${(ratio * 100).toFixed(0)}% of rolling mean`);
  }

  const roc = features.rate_of_change;
  if (Math.abs(roc) > 0.5) {
    factors.push(roc > 0 ? 'sharp-increase' : 'sharp-decrease');
    parts.push(`${(Math.abs(roc) * 100).toFixed(0)}% ${roc > 0 ? 'jump' : 'drop'} from previous`);
  }

  const hour_ratio =
    features.same_hour_baseline > 0
      ? features.rolling_mean_7d / features.same_hour_baseline
      : 1;
  if (hour_ratio > 1.5) {
    factors.push('anomalous-time-pattern');
    parts.push('Elevated vs typical hour baseline');
  }

  if (parts.length === 0) {
    parts.push(`Statistical anomaly detected in zone ${zoneId}`);
    factors.push('statistical-outlier');
  }

  const severityLabel: Record<AnomalySeverity, string> = {
    normal: 'within normal range',
    suspicious: 'suspicious',
    probable: 'probable anomaly',
    critical: 'critical anomaly',
  };

  return {
    explanation: `${parts.join('; ')} — ${severityLabel[severity]}`,
    factors,
  };
}

// ── IsolationForestInference ───────────────────────────────────

export class IsolationForestInference {
  private session: OrtSession | null = null;
  private scaler: ScalerParams | null = null;
  private ort: OrtModule | null = null;
  private readonly modelPath: string;
  private readonly scalerPath: string;

  constructor(modelPath: string, scalerPath: string) {
    this.modelPath = path.resolve(modelPath);
    this.scalerPath = path.resolve(scalerPath);
  }

  /** Load model and scaler. Must be called once before inference. */
  async load(): Promise<void> {
    // Load scaler (JSON)
    try {
      const raw = fs.readFileSync(this.scalerPath, 'utf-8');
      this.scaler = JSON.parse(raw) as ScalerParams;
    } catch (err) {
      console.error('[IsolationForest] Failed to load scaler:', this.scalerPath, err);
      this.scaler = null;
    }

    // Load ONNX Runtime + model
    try {
      this.ort = (await import('onnxruntime-node')) as unknown as OrtModule;
      this.session = await this.ort.InferenceSession.create(this.modelPath);
      console.log('[IsolationForest] ONNX model loaded:', this.modelPath);
    } catch (err) {
      console.error('[IsolationForest] Failed to load ONNX model:', this.modelPath, err);
      this.session = null;
      this.ort = null;
    }
  }

  get isLoaded(): boolean {
    return this.session !== null && this.scaler !== null;
  }

  // ── Single zone inference ──────────────────────────────────

  async scoreReading(
    zoneId: string,
    consumption: number,
    historicalData: Array<{ timestamp: Date; consumption: number }>,
    config: MLPipelineConfig,
    timestamp: Date = new Date()
  ): Promise<AnomalyScore> {
    // Not enough history → fallback
    const historyDays =
      historicalData.length > 0
        ? (timestamp.getTime() - historicalData[0].timestamp.getTime()) /
          (24 * 60 * 60 * 1000)
        : 0;

    if (!this.isLoaded || historyDays < config.minHistoryDays) {
      const baseline =
        historicalData.length > 0
          ? historicalData.reduce((s, r) => s + r.consumption, 0) / historicalData.length
          : consumption;
      return scoreWithRules(zoneId, consumption, baseline, historicalData, timestamp);
    }

    try {
      return await this._runOnnxInference(
        zoneId,
        consumption,
        historicalData,
        config,
        timestamp
      );
    } catch (err) {
      console.error(`[IsolationForest] Inference error for zone ${zoneId}:`, err);
      const baseline =
        historicalData.reduce((s, r) => s + r.consumption, 0) /
        Math.max(historicalData.length, 1);
      return scoreWithRules(zoneId, consumption, baseline, historicalData, timestamp);
    }
  }

  private async _runOnnxInference(
    zoneId: string,
    consumption: number,
    historicalData: Array<{ timestamp: Date; consumption: number }>,
    config: MLPipelineConfig,
    timestamp: Date
  ): Promise<AnomalyScore> {
    const features = computeFeatures(
      { consumption, timestamp },
      historicalData
    );

    const means = this.scaler!.feature_names.reduce((acc, name, i) => {
      acc[name as keyof EngineeredFeatures] = this.scaler!.mean_[i] ?? 0;
      return acc;
    }, {} as Record<keyof EngineeredFeatures, number>);

    const stds = this.scaler!.feature_names.reduce((acc, name, i) => {
      acc[name as keyof EngineeredFeatures] = this.scaler!.scale_[i] ?? 1;
      return acc;
    }, {} as Record<keyof EngineeredFeatures, number>);

    const scaled = normalizeForONNX(features, means, stds);
    const inputTensor = new this.ort!.Tensor(
      'float32',
      scaled,
      [1, scaled.length]
    );

    // Race inference against timeout
    const inferencePromise = this.session!.run({ float_input: inputTensor });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ONNX inference timeout')), config.inferenceTimeoutMs)
    );

    const outputs = await Promise.race([inferencePromise, timeoutPromise]);

    // ── Parse skl2onnx IsolationForest ONNX output ─────────────────────────
    // skl2onnx produces:
    //   output_label:       int64 tensor, -1 = anomaly, 1 = normal
    //   output_probability: Sequence<Map<int64, float>> — one map per sample
    //
    // We map the decision score to [0,1]: anomaly=high score, normal=low score.

    let rawScore = 0.15; // default "probably normal"

    try {
      // Extract label: -1 anomaly, 1 normal
      const labelOutput = outputs['output_label'] ?? outputs['variable'];
      let isAnomaly = false;

      if (labelOutput?.data) {
        // data is BigInt64Array for int64 output
        const labelVal = Number(labelOutput.data[0]);
        isAnomaly = labelVal === -1;
      }

      // Extract probability / score map
      const probOutput = outputs['output_probability'];
      const probData = (probOutput as { cpuData?: number[]; data?: unknown })?.cpuData
        ?? (probOutput?.data instanceof Float32Array ? Array.from(probOutput.data) : null);

      if (probData && probData.length >= 2) {
        // probData[0] = P(normal=-1), probData[1] = P(anomaly=1) or vice versa
        rawScore = Math.max(probData[0] as number, probData[1] as number);
        if (isAnomaly && rawScore < 0.5) rawScore = 0.65;
      } else {
        // Fallback: use label as binary signal, map to score range
        rawScore = isAnomaly ? 0.72 : 0.12;
      }

      // Clamp to [0,1]
      rawScore = Math.max(0, Math.min(1, rawScore));

    } catch (parseErr) {
      console.error(`[IsolationForest] Output parsing error for zone ${zoneId}:`, parseErr);
      // Safe fallback: treat as normal-ish
      rawScore = 0.15;
    }

    const severity = scoreToSeverity(rawScore, config.anomalyScoreThresholds);
    const { explanation, factors } = buildExplanation(features, severity, zoneId);

    return {
      zone_id: zoneId,
      timestamp,
      consumption_liters: consumption,
      anomaly_score: Math.round(rawScore * 1000) / 1000,
      severity,
      explanation,
      reason_factors: factors,
      baseline_consumption: Math.round(features.rolling_mean_7d * 100) / 100,
      consumption_ratio: Math.round(features.consumption_ratio * 100) / 100,
      rate_of_change: Math.round(features.rate_of_change * 100) / 100,
      detection_method: 'ml',
    };
  }

  // ── Batch inference ────────────────────────────────────────

  async scoreMultipleZones(
    zones: ZoneInput[],
    config: MLPipelineConfig
  ): Promise<AnomalyScore[]> {
    const results: AnomalyScore[] = [];
    const { batchSize } = config;

    // Process in batches to avoid memory pressure
    for (let i = 0; i < zones.length; i += batchSize) {
      const batch = zones.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((zone) =>
          this.scoreReading(
            zone.zone_id,
            zone.current_consumption,
            zone.historicalData,
            config,
            zone.timestamp
          )
        )
      );
      results.push(...batchResults);
    }

    // Sort: most anomalous first
    return results.sort((a, b) => b.anomaly_score - a.anomaly_score);
  }
}

// ── Singleton for API routes ───────────────────────────────────

let _instance: IsolationForestInference | null = null;

export async function getMLEngine(config: MLPipelineConfig): Promise<IsolationForestInference> {
  if (!_instance) {
    _instance = new IsolationForestInference(config.modelPath, config.scalerPath);
    await _instance.load();
  }
  return _instance;
}
