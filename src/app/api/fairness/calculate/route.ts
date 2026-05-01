import { NextRequest, NextResponse } from "next/server";
import { getZones, getSummaries } from "@/lib/data-cache";
import { calculateProposalFairness } from "@/lib/fairness-engine";

// POST /api/fairness/calculate
// Body: { source_zone_id, dest_zone_id, volume_ML }
export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const { source_zone_id, dest_zone_id, volume_ML } = body;

 if (!source_zone_id || !dest_zone_id || typeof volume_ML !== "number") {
 return NextResponse.json(
 { success: false, error: "Missing required fields: source_zone_id, dest_zone_id, volume_ML" },
 { status: 400 }
 );
 }

 const zones = getZones();
 const summaries = getSummaries();

 const fairness = calculateProposalFairness(
 summaries,
 zones,
 source_zone_id,
 dest_zone_id,
 volume_ML
 );

 return NextResponse.json({ success: true, ...fairness });
 } catch (error) {
 console.error("[/api/fairness/calculate] Error:", error);
 return NextResponse.json(
 { success: false, error: "Fairness calculation failed", demand_fulfillment: {} },
 { status: 500 }
 );
 }
}
