import { NextResponse } from "next/server";
import { getSummaries } from "@/lib/data-cache";

export async function GET() {
  const start = Date.now();
  const summaries = getSummaries();

  const anomalies = summaries
    .filter((s) => s.severity !== "Normal")
    .map((s) => ({
      zone_id: s.zone_id,
      zone_name: s.zone_name,
      anomaly_score: s.anomaly_score,
      severity: s.severity,
      reason: s.reason,
      factors: s.factors,
      confidence: Math.round((0.7 + s.anomaly_score * 0.25) * 100) / 100,
      lat: s.lat,
      lng: s.lng,
    }));

  return NextResponse.json({
    scan_timestamp: new Date().toISOString(),
    total_zones: summaries.length,
    anomaly_count: anomalies.length,
    critical_count: anomalies.filter((a) => a.severity === "Critical").length,
    anomalies,
    all_zones: summaries,
    response_time_ms: Date.now() - start,
  });
}
