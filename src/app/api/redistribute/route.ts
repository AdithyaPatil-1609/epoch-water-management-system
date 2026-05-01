import { NextRequest, NextResponse } from "next/server";
import { getZones, getSummaries } from "@/lib/data-cache";
import { generateProposals, classifyZones } from "@/lib/fairness";
import { calculateProposalFairness } from "@/lib/fairness-engine";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const fairnessWeight = parseFloat(searchParams.get("fairness_weight") ?? "0.7");

  const zones = getZones();
  const summaries = getSummaries();

  const { proposals, currentGini, projectedGini } = generateProposals(summaries, zones, fairnessWeight);
  const balances = classifyZones(summaries, zones);

  // Attach per-proposal fairness metadata (synchronous, <10ms each)
  const enrichedProposals = proposals.map((p) => {
    try {
      const fairness = calculateProposalFairness(
        summaries,
        zones,
        p.source_zone,
        p.dest_zone,
        p.volume_ML
      );
      return { ...p, fairness };
    } catch {
      // Graceful degradation: proposal still valid without fairness
      return { ...p, fairness: null };
    }
  });

  return NextResponse.json({
    current_gini: currentGini,
    projected_gini: projectedGini,
    deficit_count: balances.filter(b => b.category === "deficit").length,
    surplus_count: balances.filter(b => b.category === "surplus").length,
    balances,
    proposals: enrichedProposals,
    response_time_ms: Date.now() - start,
  });
}
