import { NextRequest, NextResponse } from "next/server";
import { getZones, getSummaries } from "@/lib/data-cache";
import { generateRedistributionProposals } from "@/lib/redistribution-engine";
import { calculateProposalFairness } from "@/lib/fairness-engine";

export async function GET(request: NextRequest) {
 const start = Date.now();
 const fairnessPriority = parseFloat(
 request.nextUrl.searchParams.get("fairness_weight") ?? "0.7"
 );

 const zones = getZones();
 const summaries = getSummaries();

 const result = generateRedistributionProposals(summaries, zones, fairnessPriority);

 // Enrich each proposal with per-zone fairness metadata
 const enrichedProposals = result.proposals.map(p => {
 try {
 const fairness = calculateProposalFairness(
 summaries, zones, p.source_zone, p.dest_zone, p.volume_ML
 );
 return { ...p, fairness };
 } catch {
 return { ...p, fairness: null };
 }
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
 category,
 };
 });

 return NextResponse.json({
 // Fairness metrics (new)
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
