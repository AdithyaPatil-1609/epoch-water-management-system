/**
 * API: GET /api/reports/export
 * Generate XLSX export with three sheets: Anomalies, Proposals, Decisions
 */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSummaries, getZones } from "@/lib/data-cache";
import { getDecisions } from "@/lib/decisions";
import { generateFairnessTrend, interpretGini, interpretationLabel } from "@/lib/fairness-engine";

export async function GET() {
 try {
 const summaries = getSummaries();
 const decisions = getDecisions();
 const zones = getZones();

 // Sheet 1: Anomaly Summary
 const anomalyData = summaries
 .filter((s) => s.severity !== "Normal")
 .map((s) => ({
 "Zone": s.zone_name,
 "Zone ID": s.zone_id,
 "Anomaly Score": s.anomaly_score,
 "Severity": s.severity,
 "Anomaly Type": s.anomaly_type ?? "—",
 "Reason": s.reason,
 "Fulfillment %": s.fulfillment_pct,
 "Status": decisions.find(d => d.record_id === s.zone_id && d.record_type === "anomaly")?.action || "Open",
 }));

 // Sheet 2: Redistribution Log
 const redistributionData = decisions
 .filter((d) => d.record_type === "proposal" && d.action === "Approve")
 .map((d) => ({
 "Proposal ID": d.record_id,
 "Operator": d.operator_id,
 "Approved At": new Date(d.timestamp).toLocaleString(),
 "Comment": d.comment,
 }));

 // Sheet 3: Full Decisions Log
 const logData = decisions.map(d => ({
 "Timestamp": new Date(d.timestamp).toLocaleString(),
 "Operator": d.operator_id,
 "Action": d.action,
 "Type": d.record_type,
 "Record ID": d.record_id,
 "Comment": d.comment
 }));

 // Sheet 4 (NEW): Fairness Metrics
 const trendSummary = generateFairnessTrend(summaries, zones, 30);
 const fairnessData = trendSummary.trend.map((t) => ({
 "Date": t.timestamp,
 "Gini Coefficient": t.gini,
 "Fairness Level": interpretationLabel(interpretGini(t.gini)),
 "Avg Fulfillment %": t.avg_fulfillment_pct,
 "Zones Below 80%": t.zones_below_80,
 }));

 // Sheet 5 (NEW): Zone Demand Fulfillment
 const fulfillmentData = summaries.map((s) => {
 const zone = zones.find((z) => z.zone_id === s.zone_id);
 return {
 "Zone": s.zone_name,
 "Zone ID": s.zone_id,
 "Baseline Demand (ML/d)": zone?.baseline_demand_ML ?? "—",
 "Supply Capacity (ML/d)": zone?.supply_capacity_ML ?? "—",
 "Current Consumption (ML/d)": s.current_consumption_ML,
 "Fulfillment %": s.fulfillment_pct,
 "Status": s.fulfillment_pct >= 100 ? "Surplus" : s.fulfillment_pct >= 80 ? "Balanced" : s.fulfillment_pct >= 60 ? "Deficit" : "Critical",
 "Anomaly": s.severity !== "Normal" ? `${s.severity} — ${s.anomaly_type ?? "Unknown"}` : "None",
 };
 });

 // Build workbook
 const wb = XLSX.utils.book_new();

 const ws1 = XLSX.utils.json_to_sheet(anomalyData);
 XLSX.utils.book_append_sheet(wb, ws1, "Anomaly Summary");

 const ws2 = XLSX.utils.json_to_sheet(redistributionData);
 XLSX.utils.book_append_sheet(wb, ws2, "Redistribution Log");

 const ws3 = XLSX.utils.json_to_sheet(logData);
 XLSX.utils.book_append_sheet(wb, ws3, "Decisions Log");

 const ws4 = XLSX.utils.json_to_sheet(fairnessData);
 XLSX.utils.book_append_sheet(wb, ws4, "Fairness Metrics");

 const ws5 = XLSX.utils.json_to_sheet(fulfillmentData);
 XLSX.utils.book_append_sheet(wb, ws5, "Zone Fulfillment");

 // Write to buffer
 const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

 const dateStr = new Date().toISOString().split("T")[0];
 return new NextResponse(buf, {
 status: 200,
 headers: {
 "Content-Disposition": `attachment; filename="water-audit-${dateStr}.xlsx"`,
 "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 },
 });
 } catch (error) {
 console.error("Export error:", error);
 return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
 }
}
