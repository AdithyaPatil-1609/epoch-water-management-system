import { NextRequest, NextResponse } from "next/server";
import { getDecisions, addDecision } from "@/lib/decisions";
import { applyRedistribution } from "@/lib/data-cache";

export async function GET() {
 const decisions = getDecisions();
 return NextResponse.json(decisions);
}

export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const decision = addDecision({
 operator_id: body.operator_id || "demo_user",
 action: body.action,
 record_type: body.record_type,
 record_id: body.record_id,
 comment: body.comment || "",
 timestamp: body.timestamp || new Date().toISOString(),
 });

 if (body.action === "Approve" && body.record_type === "proposal") {
 if (body.source_zone && body.dest_zone && body.volume_ML) {
 applyRedistribution(body.source_zone, body.dest_zone, body.volume_ML);
 }
 }

 return NextResponse.json(
 { decision_id: decision.decision_id, status: "logged", timestamp: decision.timestamp },
 { status: 201 }
 );
 } catch (error) {
 return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
 }
}
