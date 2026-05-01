import { NextRequest, NextResponse } from "next/server";
import { getZones, getSummaries } from "@/lib/data-cache";
import { generateFairnessTrend } from "@/lib/fairness-engine";

// GET /api/fairness/trend?days=30
export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10);
    const clampedDays = Math.max(7, Math.min(90, days));

    const zones = getZones();
    const summaries = getSummaries();

    const summary = generateFairnessTrend(summaries, zones, clampedDays);

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[/api/fairness/trend] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate fairness trend" },
      { status: 500 }
    );
  }
}
