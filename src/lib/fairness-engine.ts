// ──────────────────────────────────────────────────────────────
// Fairness Engine v2 — Demand Fulfillment + Gini Trend Tracking
// ──────────────────────────────────────────────────────────────

import { Zone, ZoneSummary } from "./synthetic-data";
import { computeGini, computeFulfillments } from "./fairness";

// ─── Types ───────────────────────────────────────────────────

export interface ZoneFulfillmentDetail {
  zone_id: string;
  zone_name: string;
  baseline_demand_ML: number;
  current_supply_ML: number;
  before_fulfillment_pct: number;
  after_fulfillment_pct: number;
  delta_pct: number;
  status: "critical" | "deficit" | "balanced" | "surplus";
}

export interface ProposalFairness {
  gini_before: number;
  gini_after: number;
  gini_improvement_pct: number;
  fairness_interpretation: "excellent" | "good" | "fair" | "poor" | "critical";
  fairness_score: number; // 0–100 for non-technical users
  city_avg_fulfillment_before: number;
  city_avg_fulfillment_after: number;
  zones_below_80_before: string[];
  zones_below_80_after: string[];
  zone_details: ZoneFulfillmentDetail[];
  computed_duration_ms: number;
}

export interface FairnessTrendPoint {
  timestamp: string;
  gini: number;
  avg_fulfillment_pct: number;
  zones_below_80: number;
}

export interface FairnessTrendSummary {
  trend: FairnessTrendPoint[];
  current_gini: number;
  average_gini_30d: number;
  best_gini_30d: number;
  worst_gini_30d: number;
  zones_below_80_fulfillment: string[];
  city_avg_fulfillment_pct: number;
}

// ─── Interpretation ──────────────────────────────────────────

export function interpretGini(gini: number): ProposalFairness["fairness_interpretation"] {
  if (gini <= 0.15) return "excellent";
  if (gini <= 0.25) return "good";
  if (gini <= 0.35) return "fair";
  if (gini <= 0.45) return "poor";
  return "critical";
}

export function giniToFairnessScore(gini: number): number {
  // Invert: 0 Gini = 100 fairness score, 0.5+ Gini = 0 fairness score
  return Math.round(Math.max(0, Math.min(100, (1 - gini / 0.5) * 100)));
}

export function interpretationLabel(interp: ProposalFairness["fairness_interpretation"]): string {
  switch (interp) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "fair": return "Fair";
    case "poor": return "Poor";
    case "critical": return "Critical";
  }
}

export function interpretationColor(interp: ProposalFairness["fairness_interpretation"]): string {
  switch (interp) {
    case "excellent": return "emerald";
    case "good": return "emerald";
    case "fair": return "yellow";
    case "poor": return "orange";
    case "critical": return "red";
  }
}

// ─── Zone Fulfillment Status ─────────────────────────────────

function fulfillmentStatus(pct: number): ZoneFulfillmentDetail["status"] {
  if (pct < 60) return "critical";
  if (pct < 80) return "deficit";
  if (pct > 110) return "surplus";
  return "balanced";
}

// ─── Per-Proposal Fairness Calculation ───────────────────────

export function calculateProposalFairness(
  summaries: ZoneSummary[],
  zones: Zone[],
  sourceZoneId: string,
  destZoneId: string,
  volumeML: number
): ProposalFairness {
  const start = Date.now();

  // Build per-zone baseline and current supply
  const zoneMap = new Map(zones.map((z) => [z.zone_id, z]));
  const fulfillmentMap = computeFulfillments(summaries, zones);

  // Current fulfillment ratios → Gini before
  const fulfillmentsBefore = Array.from(fulfillmentMap.values());
  const giniBefore = computeGini(fulfillmentsBefore);

  // Simulate post-transfer fulfillment ratios
  const testFulfillments = new Map(fulfillmentMap);
  const sourceZone = zoneMap.get(sourceZoneId);
  const destZone = zoneMap.get(destZoneId);

  if (sourceZone && destZone) {
    const newSrc = Math.max(
      (testFulfillments.get(sourceZoneId) ?? 1) -
        volumeML / sourceZone.supply_capacity_ML,
      0
    );
    const newDst = Math.min(
      (testFulfillments.get(destZoneId) ?? 0) +
        volumeML / destZone.supply_capacity_ML,
      1.0
    );
    testFulfillments.set(sourceZoneId, newSrc);
    testFulfillments.set(destZoneId, newDst);
  }

  const fulfillmentsAfter = Array.from(testFulfillments.values());
  const giniAfter = computeGini(fulfillmentsAfter);

  const giniImprovementPct =
    giniBefore > 0
      ? Math.round(((giniBefore - giniAfter) / giniBefore) * 100)
      : 0;

  // Build per-zone detail list
  const zoneDetails: ZoneFulfillmentDetail[] = summaries.map((s) => {
    const zone = zoneMap.get(s.zone_id);
    if (!zone) return null!;
    const supplyML = zone.supply_capacity_ML;
    const demandML = Math.max(s.current_consumption_ML, 1);
    const beforeFulfill = Math.min((supplyML / demandML) * 100, 100);

    let afterSupply = supplyML;
    if (s.zone_id === sourceZoneId) afterSupply = Math.max(supplyML - volumeML, 0);
    if (s.zone_id === destZoneId) afterSupply = supplyML + volumeML;
    const afterFulfill = Math.min((afterSupply / demandML) * 100, 100);

    return {
      zone_id: s.zone_id,
      zone_name: s.zone_name,
      baseline_demand_ML: zone.baseline_demand_ML,
      current_supply_ML: supplyML,
      before_fulfillment_pct: Math.round(beforeFulfill),
      after_fulfillment_pct: Math.round(afterFulfill),
      delta_pct: Math.round(afterFulfill - beforeFulfill),
      status: fulfillmentStatus(afterFulfill),
    };
  });

  const allBefore = zoneDetails.map((z) => z.before_fulfillment_pct);
  const allAfter = zoneDetails.map((z) => z.after_fulfillment_pct);
  const cityAvgBefore = Math.round(allBefore.reduce((a, b) => a + b, 0) / allBefore.length);
  const cityAvgAfter = Math.round(allAfter.reduce((a, b) => a + b, 0) / allAfter.length);

  const interp = interpretGini(giniAfter);

  return {
    gini_before: Math.round(giniBefore * 1000) / 1000,
    gini_after: Math.round(giniAfter * 1000) / 1000,
    gini_improvement_pct: giniImprovementPct,
    fairness_interpretation: interp,
    fairness_score: giniToFairnessScore(giniAfter),
    city_avg_fulfillment_before: cityAvgBefore,
    city_avg_fulfillment_after: cityAvgAfter,
    zones_below_80_before: zoneDetails
      .filter((z) => z.before_fulfillment_pct < 80)
      .map((z) => z.zone_id),
    zones_below_80_after: zoneDetails
      .filter((z) => z.after_fulfillment_pct < 80)
      .map((z) => z.zone_id),
    zone_details: zoneDetails,
    computed_duration_ms: Date.now() - start,
  };
}

// ─── Historical Trend Generator ──────────────────────────────
// Synthesizes a 30-day Gini history from the deterministic time
// series so the trend chart always has plausible data.

export function generateFairnessTrend(
  summaries: ZoneSummary[],
  zones: Zone[],
  days = 30
): FairnessTrendSummary {
  const fulfillmentMap = computeFulfillments(summaries, zones);
  const currentGini = computeGini(Array.from(fulfillmentMap.values()));

  // Seeded pseudo-random for deterministic trend
  let seed = 7777;
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const trend: FairnessTrendPoint[] = [];
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  // Walk backward from current Gini, adding noise
  let giniWalk = currentGini + 0.08; // Trend started higher (less fair)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);

    // Slowly improving trend + noise
    const improvement = (0.08 / days) * (days - i);
    const noise = (rng() - 0.5) * 0.015;
    giniWalk = Math.max(
      0.01,
      currentGini + 0.08 - improvement + noise
    );

    // Average fulfillment inversely correlates with Gini
    const avgFulfillment = Math.round(Math.min(100, 75 + (1 - giniWalk) * 25));

    trend.push({
      timestamp: d.toISOString().split("T")[0],
      gini: Math.round(giniWalk * 1000) / 1000,
      avg_fulfillment_pct: avgFulfillment,
      zones_below_80: Math.round(giniWalk * zones.length * 0.6),
    });
  }

  const giniValues = trend.map((t) => t.gini);
  const zoneDetails = summaries.map((s) => {
    const zone = zones.find((z) => z.zone_id === s.zone_id)!;
    const supplyML = zone.supply_capacity_ML;
    const demandML = Math.max(s.current_consumption_ML, 1);
    return { zone_id: s.zone_id, pct: Math.min((supplyML / demandML) * 100, 100) };
  });

  const cityAvgFulfillment = Math.round(
    zoneDetails.reduce((a, b) => a + b.pct, 0) / zoneDetails.length
  );

  return {
    trend,
    current_gini: Math.round(currentGini * 1000) / 1000,
    average_gini_30d: Math.round((giniValues.reduce((a, b) => a + b, 0) / giniValues.length) * 1000) / 1000,
    best_gini_30d: Math.round(Math.min(...giniValues) * 1000) / 1000,
    worst_gini_30d: Math.round(Math.max(...giniValues) * 1000) / 1000,
    zones_below_80_fulfillment: zoneDetails.filter((z) => z.pct < 80).map((z) => z.zone_id),
    city_avg_fulfillment_pct: cityAvgFulfillment,
  };
}
