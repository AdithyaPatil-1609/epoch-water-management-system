import { NextRequest, NextResponse } from "next/server";
import { getDecisions, addDecision } from "@/lib/decisions";

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

    return NextResponse.json(
      { decision_id: decision.decision_id, status: "logged", timestamp: decision.timestamp },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
