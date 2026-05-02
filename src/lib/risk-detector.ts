// ──────────────────────────────────────────────────────────────
// Risk Detector
// Compares forecasted demand to zone supply capacity and
// produces LOW/MEDIUM/HIGH/CRITICAL risk ratings with
// actionable recommendations.
// ──────────────────────────────────────────────────────────────

import { getForecaster, defaultFactors, type ExogenousFactors } from "@/lib/demand-forecaster";
import { getUrbanWaterZones } from "@/lib/water-zone-data";
import { calculateWaterAvailability } from "@/lib/water-availability";

export interface DeficitRisk {
  zone_id: string;
  zone_name: string;
  predicted_demand_ML_day: number;
  supply_capacity_ML_day: number;
  predicted_fulfillment_percent: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  deficit_ML_day: number;
  affected_population: number;
  recommendation: string;
  hours_until_critical: number | null; // null if not expected to go critical
}

export interface RiskSummary {
  horizon_hours: number;
  total_zones: number;
  zones_at_risk: number;
  zones_critical: number;
  max_deficit_percent: number;
  total_affected_population: number;
  recommended_actions: string[];
  deficit_risks: DeficitRisk[];
}

const RISK_RECOMMENDATIONS: Record<string, string> = {
  LOW: "Monitor regularly. No immediate action needed.",
  MEDIUM: "Pre-stage redistribution from nearest surplus zone. Review pipes for NRW.",
  HIGH: "Initiate transfer within 2 hours. Alert field team. Check pump status.",
  CRITICAL: "Emergency redistribution required NOW. Activate failover. Ration non-essential use.",
};

export function analyseRisks(
  horizon_hours: 24 | 48 | 72 = 24,
  factors?: ExogenousFactors
): RiskSummary {
  const eff = factors ?? defaultFactors();
  const forecaster = getForecaster();
  const zones = getUrbanWaterZones();

  const forecasts = forecaster.forecastAll(horizon_hours, eff);
  const forecastMap = new Map(forecasts.map((f) => [f.zone_id, f]));

  const risks: DeficitRisk[] = zones.map((zone) => {
    const fc = forecastMap.get(zone.zone_id);
    const avail = calculateWaterAvailability(zone);

    const predicted_demand_ML_day = fc
      ? (fc.daily_summary.mean_ML_per_hour * 24)
      : zone.demand_supply.total_demand_ML_day;

    const supply_capacity_ML_day = avail.total_available_ML;
    const fulfillment = supply_capacity_ML_day > 0
      ? Math.round((supply_capacity_ML_day / predicted_demand_ML_day) * 100)
      : 0;

    const deficit_ML_day = Math.max(0, predicted_demand_ML_day - supply_capacity_ML_day);

    let risk_level: DeficitRisk["risk_level"] =
      fulfillment >= 100 ? "LOW"
      : fulfillment >= 80 ? "MEDIUM"
      : fulfillment >= 60 ? "HIGH"
      : "CRITICAL";

    // Escalate if declining water table
    if (zone.water_table.trend_meters_per_month < -0.2 && risk_level === "MEDIUM") {
      risk_level = "HIGH";
    }

    const hours_until_critical =
      risk_level === "CRITICAL" ? 0
      : risk_level === "HIGH" ? 4
      : risk_level === "MEDIUM" ? 12
      : null;

    const specific_rec =
      deficit_ML_day > 0
        ? `${RISK_RECOMMENDATIONS[risk_level]} Deficit: ${deficit_ML_day.toFixed(1)} ML/day — find nearest surplus zone to transfer.`
        : RISK_RECOMMENDATIONS[risk_level];

    return {
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      predicted_demand_ML_day: Math.round(predicted_demand_ML_day * 10) / 10,
      supply_capacity_ML_day: Math.round(supply_capacity_ML_day * 10) / 10,
      predicted_fulfillment_percent: fulfillment,
      risk_level,
      deficit_ML_day: Math.round(deficit_ML_day * 10) / 10,
      affected_population:
        fulfillment >= 100
          ? 0
          : Math.round(zone.population.total * (1 - fulfillment / 100)),
      recommendation: specific_rec,
      hours_until_critical,
    };
  });

  // Sort: CRITICAL first
  const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  risks.sort((a, b) => ORDER[a.risk_level] - ORDER[b.risk_level]);

  const zones_at_risk = risks.filter((r) => r.risk_level !== "LOW").length;
  const zones_critical = risks.filter((r) => r.risk_level === "CRITICAL").length;
  const max_deficit_pct = risks.reduce(
    (m, r) => Math.max(m, 100 - r.predicted_fulfillment_percent),
    0
  );
  const total_affected = risks.reduce((s, r) => s + r.affected_population, 0);

  const recommended_actions: string[] = [];
  if (zones_critical > 0)
    recommended_actions.push(`🚨 ${zones_critical} zone(s) in CRITICAL state — emergency redistribution required.`);
  if (zones_at_risk > 0)
    recommended_actions.push(`⚠ ${zones_at_risk} zone(s) at risk. Run redistribution engine to generate transfer proposals.`);
  if (risks.some((r) => r.zone_id && r.risk_level !== "LOW"))
    recommended_actions.push("Review NRW% — reducing leaks is the fastest way to increase effective supply.");
  recommended_actions.push("Check Prim's MST coverage to ensure all at-risk zones have viable pipe routes.");

  return {
    horizon_hours,
    total_zones: zones.length,
    zones_at_risk,
    zones_critical,
    max_deficit_percent: Math.round(max_deficit_pct),
    total_affected_population: total_affected,
    recommended_actions,
    deficit_risks: risks,
  };
}
