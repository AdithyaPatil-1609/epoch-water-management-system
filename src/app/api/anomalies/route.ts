// ──────────────────────────────────────────────────────────────
// GET /api/anomalies
//
// Hybrid anomaly detection pipeline:
//   1. Load zone summaries from the in-memory synthetic data cache
//      (preserves all existing fields the dashboard depends on)
//   2. Run IsolationForestInference.scoreMultipleZones() in parallel
//      against the same historical records
//   3. Merge ML scores back onto each zone summary — ML wins when
//      it has enough history (≥7 days); rule-based fallback otherwise
//   4. Return enriched response with detection_method metadata
//
// Response time target: < 3 seconds for 20 zones
// ──────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getSummaries, getRecords, getZones } from "@/lib/data-cache";
import { getMLEngine } from "@/lib/ml/isolation-forest-inference";
import { ML_CONFIG } from "@/config/ml.config";
import type { ZoneInput } from "@/lib/types/anomaly";
import type { ZoneSummary } from "@/lib/synthetic-data";

// ── Severity mapping between the two type systems ─────────────
// synthetic-data.ts uses title-case; anomaly.ts uses lowercase.
type LegacySeverity = ZoneSummary["severity"];         // "Normal" | "Suspicious" | "Probable" | "Critical"
type MLSeverity     = "normal" | "suspicious" | "probable" | "critical";

function toLegacySeverity(ml: MLSeverity): LegacySeverity {
  return (ml.charAt(0).toUpperCase() + ml.slice(1)) as LegacySeverity;
}

// ── Build ZoneInput[] from cached records ─────────────────────
// Maps ZoneRecord[] (consumption_ML × 1000 → liters) to the
// shape expected by IsolationForestInference.
function buildZoneInputs(): ZoneInput[] {
  const zones   = getZones();
  const records = getRecords();
  const now     = new Date();

  return zones.map((zone) => {
    // All historical records for this zone, sorted chronologically
    const zoneRecords = records
      .filter((r) => r.zone_id === zone.zone_id)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Latest reading is the "current" consumption we are scoring
    const latest = zoneRecords[zoneRecords.length - 1];

    // Historical data = everything except the latest reading
    // Convert ML (megalitres) → litres for the ML feature engine
    const historicalData = zoneRecords.slice(0, -1).map((r) => ({
      timestamp:   r.timestamp,
      consumption: r.consumption_ML * 1_000_000, // ML → L
    }));

    return {
      zone_id:             zone.zone_id,
      current_consumption: (latest?.consumption_ML ?? zone.baseline_demand_ML / 4) * 1_000_000,
      timestamp:           latest?.timestamp ?? now,
      historicalData,
    };
  });
}

// ── Route handler ─────────────────────────────────────────────

export async function GET() {
  const start = Date.now();

  // ── Step 1: Existing rule-based summaries (always available) ─
  const summaries = getSummaries();

  // ── Step 2: ML inference (with graceful fallback baked in) ───
  // getMLEngine() returns a singleton — model is loaded once.
  // If ONNX model files are missing, all zones use rule-based fallback.
  let mlScores: import("@/lib/types/anomaly").AnomalyScore[] = [];

  try {
    const mlEngine  = await getMLEngine(ML_CONFIG);
    const zoneInputs: ZoneInput[] = buildZoneInputs();
    mlScores = await mlEngine.scoreMultipleZones(zoneInputs, ML_CONFIG);
  } catch (err) {
    // This should never happen — the engine itself catches all errors —
    // but belt-and-suspenders here ensures the endpoint never 500s.
    console.error("[/api/anomalies] ML engine top-level failure:", err);
    mlScores = [];
  }

  // Index ML scores by zone_id for O(1) lookup
  const mlScoreMap = new Map(mlScores.map((s) => [s.zone_id, s]));

  // ── Step 3: Merge ML scores onto the existing summaries ──────
  const enrichedSummaries = summaries.map((summary) => {
    const ml = mlScoreMap.get(summary.zone_id);

    if (!ml) {
      // No ML score available — return as-is with detection_method tag
      return {
        ...summary,
        detection_method: "rule_based" as const,
        ml_anomaly_score: null,
        ml_severity:      null,
      };
    }

    // ML wins: override score, severity, reason, and factors
    // EXCEPTION: If the rule-based engine has explicitly planted a known
    // anomaly type (industrial_misuse, pipe_rupture, etc.), preserve it —
    // the ML model doesn't have enough signal to override ground-truth labels.
    const PLANTED_TYPES = new Set([
      "industrial_misuse", "pipe_rupture", "theft", "leak", "event", "meter_fault"
    ]);
    const hasPlantedAnomaly = summary.anomaly_type && PLANTED_TYPES.has(summary.anomaly_type);
    const useMlResult = ml.detection_method === "ml" && !hasPlantedAnomaly;

    return {
      // ── Existing fields (always preserved for dashboard compatibility) ──
      zone_id:               summary.zone_id,
      zone_name:             summary.zone_name,
      lat:                   summary.lat,
      lng:                   summary.lng,
      current_consumption_ML: summary.current_consumption_ML,
      baseline_ML:           summary.baseline_ML,
      pressure_bar:          summary.pressure_bar,
      supply_capacity_ML:    summary.supply_capacity_ML,
      fulfillment_pct:       summary.fulfillment_pct,
      anomaly_type:          summary.anomaly_type,

      // ── ML-enhanced fields ─────────────────────────────────────────────
      anomaly_score:   useMlResult ? ml.anomaly_score : summary.anomaly_score,
      severity:        useMlResult ? toLegacySeverity(ml.severity) : summary.severity,
      reason:          useMlResult ? ml.explanation    : summary.reason,
      factors:         useMlResult ? (ml.reason_factors ?? summary.factors) : summary.factors,

      // ── Extra ML metadata (new fields for v2 clients) ─────────────────
      confidence:        Math.round((0.7 + (useMlResult ? ml.anomaly_score : summary.anomaly_score) * 0.25) * 100) / 100,
      baseline_consumption_L: ml.baseline_consumption ?? null,
      consumption_ratio:      ml.consumption_ratio     ?? null,
      detection_method:       hasPlantedAnomaly ? "rule_based" : ml.detection_method,
      ml_anomaly_score:       ml.anomaly_score,   // Always include raw ML score for debugging
      ml_severity:            ml.severity,
    };

  });

  // ── Step 4: Filter and sort anomalies for the response ───────
  const anomalies = enrichedSummaries
    .filter((s) => s.severity !== "Normal")
    .sort((a, b) => b.anomaly_score - a.anomaly_score); // Highest risk first

  const criticalCount    = anomalies.filter((a) => a.severity === "Critical").length;
  const mlDetectedCount  = anomalies.filter((a) => a.detection_method === "ml").length;
  const mlLoadedCount    = mlScores.length;

  return NextResponse.json({
    // ── Response envelope ───────────────────────────────────────
    scan_timestamp:    new Date().toISOString(),
    total_zones:       enrichedSummaries.length,
    anomaly_count:     anomalies.length,
    critical_count:    criticalCount,
    response_time_ms:  Date.now() - start,

    // ── Detection pipeline metadata ─────────────────────────────
    detection: {
      ml_model_loaded:   mlLoadedCount > 0,
      ml_scored_zones:   mlLoadedCount,
      ml_detected_count: mlDetectedCount,
      rule_detected_count: anomalies.length - mlDetectedCount,
    },

    // ── Main payload ────────────────────────────────────────────
    anomalies,
    all_zones: enrichedSummaries,

    // ── Network graph for pipe visualization ────────────────────
    network_connections: getZones().map(z => ({
      zone_id: z.zone_id,
      connected_zones: z.connected_zones,
      min_pressure: z.min_operating_pressure,
    })),
  });
}
