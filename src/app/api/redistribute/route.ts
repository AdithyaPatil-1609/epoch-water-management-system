/**
 * API Route: /api/redistribute
 * Combines anomaly detection with redistribution optimization.
 * Returns proposals ranked by fairness impact, enriched with
 * real hydraulic pressure validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateRedistributionProposals } from "@/lib/redistribution-engine";
import { getZones, getSummaries } from "@/lib/data-cache";
import { calculateProposalFairness } from "@/lib/fairness-engine";
import { calculateNetworkPressures, checkPressureConstraint } from "@/lib/network-simulator";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const fairnessPriority = parseFloat(
    request.nextUrl.searchParams.get("fairness_weight") ?? "0.7"
  );

  const zones = getZones();
  const summaries = getSummaries();

  const result = generateRedistributionProposals(summaries, zones, fairnessPriority);

  // Compute baseline network pressures (no proposals yet)
  const baselinePressures = calculateNetworkPressures(zones, []);

  // Enrich each proposal with pressure validation + per-zone fairness metadata
  const enrichedProposals = result.proposals.map(p => {
    // 1. Pressure constraint check for this specific proposal
    const pressureCheck = checkPressureConstraint(zones, p, 1.5);

    // 2. Pressure at source zone BEFORE the transfer (baseline)
    const pressure_before_bar = baselinePressures.get(p.source_zone) ?? 2.0;

    // 3. Per-zone fairness impact
    let fairness = null;
    try {
      fairness = calculateProposalFairness(
        summaries, zones, p.source_zone, p.dest_zone, p.volume_ML
      );
    } catch {
      // Non-fatal: fairness metadata is supplementary
    }

    return {
      ...p,
      // Pressure fields
      pressure_before_bar: Math.round(pressure_before_bar * 100) / 100,
      pressure_after_bar: Math.round(pressureCheck.pressure_after * 100) / 100,
      pressure_safe: pressureCheck.feasible,
      constraint_violated: !pressureCheck.feasible ? "pressure_below_1.5_bar" : null,
      // Fairness metadata
      fairness,
    };
  });

  // Build zone balance list for backward compat
  const balances = summaries.map(s => {
    const zone = zones.find(z => z.zone_id === s.zone_id)!;
    const supply = zone.supply_capacity_ML;
    const demand = Math.max(s.current_consumption_ML, 1);
    const fulfillment = supply / demand;
    const category = fulfillment > 1.1 ? "surplus" : fulfillment < 0.9 ? "deficit" : "balanced";
    return {
      zone_id: s.zone_id,
      zone_name: s.zone_name,
      fulfillment: Math.round(fulfillment * 100) / 100,
      surplus_ML: Math.round((supply - demand) * 100) / 100,
      pressure_bar: Math.round((baselinePressures.get(s.zone_id) ?? 2.0) * 100) / 100,
      category,
    };
  });

  return NextResponse.json({
    // Fairness metrics
    baseline_fairness: result.baseline_fairness,
    projected_fairness: result.projected_fairness,
    gini_improvement_percent: result.gini_improvement_percent,

    // Backwards compat
    current_gini: result.current_gini,
    projected_gini: result.projected_gini,
    deficit_count: result.deficit_count,
    surplus_count: result.surplus_count,
    balances,
    proposals: enrichedProposals,
    response_time_ms: Date.now() - start,
  });
}
