// ──────────────────────────────────────────────────────────────
// Fallback Rule-Based Anomaly Detector
//
// Used when:
//   - ONNX model file is missing / fails to load
//   - Zone has fewer than minHistoryDays of data
//   - ONNX Runtime throws during inference
//
// Pure TypeScript — zero external dependencies.
// Returns the same AnomalyScore shape as the ML inference path.
// ──────────────────────────────────────────────────────────────

import type { AnomalyScore, AnomalySeverity } from '@/lib/types/anomaly';

interface HistoricalPoint {
  timestamp: Date;
  consumption: number;
}

interface RuleResult {
  triggered: boolean;
  severity: AnomalySeverity;
  factor: string;
  explanation: string;
  score: number;
}

// ── Individual Rule Implementations ───────────────────────────

/**
 * Rule 1 — Consumption Ratio
 * High ratio → leak / theft; low ratio → equipment failure / pipe rupture.
 */
function checkConsumptionRatio(
  consumption: number,
  baseline: number
): RuleResult {
  if (baseline <= 0) {
    return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
  }

  const ratio = consumption / baseline;

  if (ratio > 3.5) {
    return {
      triggered: true,
      severity: 'critical',
      factor: 'extreme-overconsumption',
      explanation: `Consumption ${ratio.toFixed(1)}x baseline — critical overuse or major leak`,
      score: 0.92,
    };
  }
  if (ratio > 2.5) {
    return {
      triggered: true,
      severity: 'probable',
      factor: 'high-consumption-ratio',
      explanation: `Consumption ${ratio.toFixed(1)}x baseline — probable leak or unauthorised draw`,
      score: 0.78,
    };
  }
  if (ratio < 0.3) {
    return {
      triggered: true,
      severity: 'critical',
      factor: 'severe-underconsumption',
      explanation: `Consumption only ${(ratio * 100).toFixed(0)}% of baseline — suspected pipe rupture or valve closure`,
      score: 0.88,
    };
  }
  if (ratio < 0.5) {
    return {
      triggered: true,
      severity: 'probable',
      factor: 'low-consumption-ratio',
      explanation: `Consumption only ${(ratio * 100).toFixed(0)}% of baseline — possible equipment failure`,
      score: 0.72,
    };
  }

  return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
}

/**
 * Rule 2 — Rate of Change
 * A sudden jump or drop between consecutive readings is suspicious.
 */
function checkRateOfChange(
  current: number,
  previous: number | null
): RuleResult {
  if (previous === null || previous <= 0) {
    return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
  }

  const roc = Math.abs(current - previous) / previous;

  if (roc > 1.0) {
    return {
      triggered: true,
      severity: 'probable',
      factor: 'extreme-rate-of-change',
      explanation: `${(roc * 100).toFixed(0)}% change from previous reading — abrupt system event`,
      score: 0.74,
    };
  }
  if (roc > 0.5) {
    return {
      triggered: true,
      severity: 'suspicious',
      factor: 'high-rate-of-change',
      explanation: `${(roc * 100).toFixed(0)}% change from previous reading — unusual spike or drop`,
      score: 0.52,
    };
  }

  return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
}

/**
 * Rule 3 — Nighttime Spike
 * Consumption above baseline between 23:00–05:00 is a theft indicator.
 */
function checkNighttimeSpike(
  consumption: number,
  baseline: number,
  timestamp: Date
): RuleResult {
  const hour = timestamp.getHours();
  const isNightHour = hour >= 23 || hour <= 4;

  if (isNightHour && consumption > baseline * 1.3) {
    const ratio = consumption / baseline;
    return {
      triggered: true,
      severity: 'suspicious',
      factor: 'nighttime-spike',
      explanation: `Consumption ${ratio.toFixed(1)}x baseline at ${hour}:00 — possible nighttime theft`,
      score: 0.61,
    };
  }

  return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
}

/**
 * Rule 4 — Sustained Elevation
 * Three or more consecutive readings all above 1.5× baseline → probable slow leak.
 */
function checkSustainedElevation(
  historicalData: HistoricalPoint[],
  baseline: number,
  windowSize = 3
): RuleResult {
  if (historicalData.length < windowSize || baseline <= 0) {
    return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
  }

  const recent = historicalData.slice(-windowSize);
  const allElevated = recent.every((r) => r.consumption > baseline * 1.5);

  if (allElevated) {
    const avgRatio =
      recent.reduce((sum, r) => sum + r.consumption / baseline, 0) / windowSize;
    return {
      triggered: true,
      severity: 'probable',
      factor: 'sustained-elevation',
      explanation: `Last ${windowSize} readings average ${avgRatio.toFixed(1)}x baseline — probable slow leak`,
      score: 0.79,
    };
  }

  return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
}

/**
 * Rule 5 — Erratic / Noisy Readings
 * High variance relative to mean within recent window → metering fault.
 */
function checkErratics(historicalData: HistoricalPoint[]): RuleResult {
  const recent = historicalData.slice(-8); // last 2 days (4 readings/day)
  if (recent.length < 4) {
    return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
  }

  const values = recent.map((r) => r.consumption);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) {
    return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
  }

  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation

  if (cv > 0.6) {
    return {
      triggered: true,
      severity: 'suspicious',
      factor: 'erratic-readings',
      explanation: `Coefficient of variation ${(cv * 100).toFixed(0)}% — possible meter fault or data error`,
      score: 0.58,
    };
  }

  return { triggered: false, severity: 'normal', factor: '', explanation: '', score: 0 };
}

// ── Severity Ordering ─────────────────────────────────────────

const SEVERITY_ORDER: Record<AnomalySeverity, number> = {
  normal: 0,
  suspicious: 1,
  probable: 2,
  critical: 3,
};

function maxSeverity(a: AnomalySeverity, b: AnomalySeverity): AnomalySeverity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Score a single reading using deterministic rules.
 * Never throws — always returns a valid AnomalyScore.
 */
export function scoreWithRules(
  zoneId: string,
  consumption: number,
  baseline: number,
  historicalData: HistoricalPoint[],
  timestamp: Date = new Date()
): AnomalyScore {
  const previousReading =
    historicalData.length > 0
      ? historicalData[historicalData.length - 1].consumption
      : null;

  // Evaluate all rules
  const results: RuleResult[] = [
    checkConsumptionRatio(consumption, baseline),
    checkRateOfChange(consumption, previousReading),
    checkNighttimeSpike(consumption, baseline, timestamp),
    checkSustainedElevation(historicalData, baseline),
    checkErratics(historicalData),
  ];

  const triggered = results.filter((r) => r.triggered);

  if (triggered.length === 0) {
    return {
      zone_id: zoneId,
      timestamp,
      consumption_liters: consumption,
      anomaly_score: 0.05 + Math.random() * 0.1, // small non-zero baseline noise
      severity: 'normal',
      explanation: 'Consumption within normal parameters',
      reason_factors: [],
      baseline_consumption: baseline,
      consumption_ratio: baseline > 0 ? consumption / baseline : undefined,
      detection_method: 'rule_based',
    };
  }

  // Combine: take worst severity, sum scores (capped at 0.99)
  const worstSeverity = triggered.reduce<AnomalySeverity>(
    (best, r) => maxSeverity(best, r.severity),
    'normal'
  );

  const combinedScore = Math.min(
    triggered.reduce((sum, r) => sum + r.score, 0) / triggered.length +
      (triggered.length - 1) * 0.05,
    0.99
  );

  // Use the highest-score rule's explanation as the primary
  triggered.sort((a, b) => b.score - a.score);
  const primaryExplanation = triggered[0].explanation;
  const factors = [...new Set(triggered.map((r) => r.factor))];

  return {
    zone_id: zoneId,
    timestamp,
    consumption_liters: consumption,
    anomaly_score: Math.round(combinedScore * 1000) / 1000,
    severity: worstSeverity,
    explanation: primaryExplanation,
    reason_factors: factors,
    baseline_consumption: baseline,
    consumption_ratio: baseline > 0 ? Math.round((consumption / baseline) * 100) / 100 : undefined,
    detection_method: 'rule_based',
  };
}
