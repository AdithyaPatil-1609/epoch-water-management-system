/**
 * API: GET /api/reports/export
 * Generate XLSX export with three sheets: Anomalies, Proposals, Decisions
 */

import ExcelJS from "exceljs";
import { format } from "date-fns";
import { client as mongo_client } from "@/lib/mongodb";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const start_date = url.searchParams.get("start_date");
    const end_date = url.searchParams.get("end_date");
    const operator_id = url.searchParams.get("operator_id");
    const zone_ids_param = url.searchParams.get("zone_ids");
    
    const filters: any = {};
    if (start_date) filters.start_date = new Date(start_date);
    if (end_date) filters.end_date = new Date(end_date);
    if (operator_id) filters.operator_id = operator_id;
    if (zone_ids_param) filters.zone_ids = zone_ids_param.split(",");

    const buffer = await exportAuditReport(filters);

    return new Response(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="audit_report_${format(new Date(), "yyyy-MM-dd")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "",
      }),
      { status: 500 }
    );
  }
}

export async function exportAuditReport(filters: {
  start_date?: Date;
  end_date?: Date;
  zone_ids?: string[];
  operator_id?: string;
}): Promise<Buffer> {
  const db = mongo_client.db("water_systems");

  // Query data
  const anomalies = await db
    .collection("anomalies_log")
    .find(buildMongoFilter(filters))
    .toArray();

  const proposals = await db
    .collection("proposals_log")
    .find(buildMongoFilter(filters))
    .toArray();

  const decisions = await db
    .collection("decisions_log")
    .find(buildMongoFilter(filters))
    .toArray();

  // Create workbook
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Anomalies
  const anomalies_sheet = workbook.addWorksheet("Anomalies");
  anomalies_sheet.columns = [
    { header: "Zone ID", key: "zone_id", width: 12 },
    { header: "Timestamp", key: "timestamp", width: 18 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Type", key: "anomaly_type", width: 15 },
    { header: "Score", key: "anomaly_score", width: 10 },
    { header: "Reason", key: "reason", width: 40 },
    { header: "Status", key: "status", width: 12 },
  ];

  anomalies.forEach((a) => {
    anomalies_sheet.addRow({
      zone_id: a.zone_id,
      timestamp: a.timestamp ? format(new Date(a.timestamp), "yyyy-MM-dd HH:mm") : "",
      severity: a.severity,
      anomaly_type: a.anomaly_type,
      anomaly_score: a.anomaly_score?.toFixed(3),
      reason: a.reason,
      status: a.status,
    });
  });

  // Sheet 2: Redistribution Proposals
  const proposals_sheet = workbook.addWorksheet("Proposals");
  proposals_sheet.columns = [
    { header: "Proposal ID", key: "proposal_id", width: 12 },
    { header: "From Zone", key: "source_zone", width: 12 },
    { header: "To Zone", key: "dest_zone", width: 12 },
    { header: "Volume (m³/h)", key: "volume", width: 14 },
    { header: "Pressure Change (bar)", key: "pressure_impact", width: 14 },
    { header: "Fairness Gain", key: "fairness_gain", width: 12 },
    { header: "Feasibility", key: "feasibility", width: 12 },
    { header: "Gini Improvement %", key: "gini_improvement", width: 14 },
    { header: "Timestamp", key: "timestamp", width: 18 },
  ];

  proposals.forEach((p) => {
    proposals_sheet.addRow({
      proposal_id: p.proposal_id,
      source_zone: p.source_zone,
      dest_zone: p.dest_zone,
      volume: p.volume?.toFixed(2),
      pressure_impact: p.pressure_impact?.toFixed(2),
      fairness_gain: p.fairness_gain ? (p.fairness_gain * 100).toFixed(1) + "%" : "",
      feasibility: p.feasibility,
      gini_improvement: p.gini_improvement_percent ? p.gini_improvement_percent.toFixed(1) + "%" : "",
      timestamp: p.timestamp ? format(new Date(p.timestamp), "yyyy-MM-dd HH:mm") : "",
    });
  });

  // Sheet 3: Operator Decisions
  const decisions_sheet = workbook.addWorksheet("Decisions");
  decisions_sheet.columns = [
    { header: "Operator ID", key: "operator_id", width: 12 },
    { header: "Timestamp", key: "timestamp", width: 18 },
    { header: "Action", key: "action", width: 12 },
    { header: "Proposal ID", key: "proposal_id", width: 12 },
    { header: "Anomaly ID", key: "anomaly_id", width: 12 },
    { header: "Comment", key: "comment", width: 30 },
  ];

  decisions.forEach((d) => {
    decisions_sheet.addRow({
      operator_id: d.operator_id,
      timestamp: d.timestamp ? format(new Date(d.timestamp), "yyyy-MM-dd HH:mm") : "",
      action: d.action,
      proposal_id: d.proposal_id || "-",
      anomaly_id: d.anomaly_id || "-",
      comment: d.comment || "",
    });
  });

  // Sheet 4: Fairness Summary
  const summary_sheet = workbook.addWorksheet("Fairness Summary");
  const gini_over_time = aggregateFairnessMetrics(proposals);

  summary_sheet.columns = [
    { header: "Time Period", key: "period", width: 18 },
    { header: "Avg Gini Coefficient", key: "avg_gini", width: 14 },
    { header: "Proposals Generated", key: "proposal_count", width: 14 },
    { header: "Proposals Approved", key: "approved_count", width: 14 },
    { header: "Avg Fairness Gain", key: "avg_gain", width: 14 },
  ];

  gini_over_time.forEach((metric) => {
    summary_sheet.addRow({
      period: metric.period,
      avg_gini: metric.avg_gini.toFixed(3),
      proposal_count: metric.proposal_count,
      approved_count: metric.approved_count,
      avg_gain: (metric.avg_gain * 100).toFixed(1) + "%",
    });
  });

  // Format headers
  [anomalies_sheet, proposals_sheet, decisions_sheet, summary_sheet].forEach(
    (sheet) => {
      const firstRow = sheet.getRow(1);
      if (firstRow) {
        firstRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        firstRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4472C4" },
        };
      }
    }
  );

  return await workbook.xlsx.writeBuffer() as unknown as Buffer;
}

/**
 * Helper: Build MongoDB filter from query params
 */
function buildMongoFilter(filters: {
  start_date?: Date;
  end_date?: Date;
  zone_ids?: string[];
  operator_id?: string;
}): any {
  const filter: any = {};

  if (filters.start_date || filters.end_date) {
    filter.timestamp = {};
    if (filters.start_date)
      filter.timestamp.$gte = filters.start_date;
    if (filters.end_date)
      filter.timestamp.$lte = filters.end_date;
  }

  if (filters.zone_ids && filters.zone_ids.length > 0) {
    filter.$or = [
      { zone_id: { $in: filters.zone_ids } },
      { source_zone: { $in: filters.zone_ids } },
      { dest_zone: { $in: filters.zone_ids } },
    ];
  }

  if (filters.operator_id) {
    filter.operator_id = filters.operator_id;
  }

  return filter;
}

/**
 * Helper: Aggregate fairness metrics over time periods
 */
function aggregateFairnessMetrics(proposals: any[]): any[] {
  const by_day = new Map();

  proposals.forEach((p) => {
    if (!p.timestamp) return;
    const day = format(new Date(p.timestamp), "yyyy-MM-dd");
    if (!by_day.has(day)) {
      by_day.set(day, {
        period: day,
        avg_gini: 0,
        proposal_count: 0,
        approved_count: 0,
        avg_gain: 0,
        gains: [],
      });
    }

    const entry = by_day.get(day);
    entry.proposal_count++;
    entry.avg_gini += p.baseline_gini || 0;
    if (p.fairness_gain) entry.gains.push(p.fairness_gain);
  });

  const result: any[] = [];
  for (const [_, entry] of by_day) {
    if (entry.proposal_count > 0) {
        entry.avg_gini /= entry.proposal_count;
    }
    entry.avg_gain = entry.gains.length > 0 ? entry.gains.reduce((a: any, b: any) => a + b, 0) / entry.gains.length : 0;
    result.push(entry);
  }

  return result.sort((a, b) =>
    new Date(a.period).getTime() - new Date(b.period).getTime()
  );
}
