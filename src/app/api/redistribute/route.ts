import { NextRequest, NextResponse } from "next/server";
import { getZones, getSummaries } from "@/lib/data-cache";
import { generateProposals, classifyZones } from "@/lib/fairness";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const fairnessWeight = parseFloat(searchParams.get("fairness_weight") ?? "0.7");

  const zones = getZones();
  const summaries = getSummaries();

  const { proposals, currentGini, projectedGini } = generateProposals(summaries, zones, fairnessWeight);
  const balances = classifyZones(summaries, zones);

  return NextResponse.json({
    current_gini: currentGini,
    projected_gini: projectedGini,
    deficit_count: balances.filter(b => b.category === "deficit").length,
    surplus_count: balances.filter(b => b.category === "surplus").length,
    balances,
    proposals,
    response_time_ms: Date.now() - start,
  });
}
