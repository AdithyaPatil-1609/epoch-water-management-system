import { NextResponse } from "next/server";
import { getDecisions } from "@/lib/decisions";
import { getSummaries } from "@/lib/data-cache";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const summaries = getSummaries();
    const decisions = getDecisions();

    // Sheet 1: Anomaly Summary
    const anomalyData = summaries
      .filter((s) => s.severity !== "Normal")
      .map((s) => ({
        "Zone": s.zone_name,
        "Anomaly Score": s.anomaly_score,
        "Severity": s.severity,
        "Reason": s.reason,
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

    // Create workbook
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(anomalyData);
    XLSX.utils.book_append_sheet(wb, ws1, "Anomaly Summary");

    const ws2 = XLSX.utils.json_to_sheet(redistributionData);
    XLSX.utils.book_append_sheet(wb, ws2, "Redistribution Log");

    const ws3 = XLSX.utils.json_to_sheet(logData);
    XLSX.utils.book_append_sheet(wb, ws3, "Decisions Log");

    // Write to buffer
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Return as downloadable file
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
