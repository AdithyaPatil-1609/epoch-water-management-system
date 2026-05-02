// ──────────────────────────────────────────────────────────────
// Water Quality Manager
// Tracks pH, TDS, turbidity, chlorine, microbial load.
// Generates alerts when parameters breach WHO / BIS standards.
// Recommends treatment actions.
// ──────────────────────────────────────────────────────────────

import { getUrbanWaterZones } from "@/lib/water-zone-data";

export interface QualityAlert {
  zone_id: string;
  parameter: string;
  measured_value: number;
  safe_range: { min: number; max: number };
  severity: "WARNING" | "CRITICAL";
  recommendation: string;
}

export interface ZoneQualityReport {
  zone_id: string;
  zone_name: string;
  status: "POTABLE" | "TREATMENT_REQUIRED" | "UNFIT";
  score: number; // 0–100 (100 = perfect)
  parameters: {
    pH: { value: number; status: "ok" | "warn" | "fail" };
    TDS_mg_L: { value: number; status: "ok" | "warn" | "fail" };
    turbidity_NTU: { value: number; status: "ok" | "warn" | "fail" };
    residual_chlorine_mg_L: { value: number; status: "ok" | "warn" | "fail" };
    microbial_CFU: { value: number; status: "ok" | "warn" | "fail" };
    hardness_mg_L: { value: number; status: "ok" | "warn" | "fail" };
  };
  alerts: QualityAlert[];
  last_tested: string;
  treatment_needed: string[];
}

export interface QualitySystemSummary {
  total_zones: number;
  potable_zones: number;
  treatment_required: number;
  unfit_zones: number;
  zones_with_alerts: number;
  critical_alerts: QualityAlert[];
  reports: ZoneQualityReport[];
}

// ─── WHO / BIS safe ranges ────────────────────────────────────

const STANDARDS = {
  pH:                    { min: 6.5,  max: 8.5,  warn_min: 6.8, warn_max: 8.2 },
  TDS_mg_L:              { min: 0,    max: 500,  warn_max: 400 },
  turbidity_NTU:         { min: 0,    max: 1.0,  warn_max: 0.7 },
  residual_chlorine_mg_L:{ min: 0.2,  max: 0.5,  warn_min: 0.25, warn_max: 0.45 },
  microbial_CFU:         { min: 0,    max: 0,    warn_max: 0 },
  hardness_mg_L:         { min: 0,    max: 200,  warn_max: 150 },
};

function rateParam(
  param: keyof typeof STANDARDS,
  value: number
): "ok" | "warn" | "fail" {
  const std = STANDARDS[param] as { min: number; max: number; warn_min?: number; warn_max?: number };
  if (param === "microbial_CFU") return value > 0 ? "fail" : "ok";
  if (value < std.min || value > std.max) return "fail";
  if ((std.warn_min !== undefined && value < std.warn_min) ||
      (std.warn_max !== undefined && value > std.warn_max)) return "warn";
  return "ok";
}

function buildAlert(
  zone_id: string,
  param: string,
  value: number,
  status: "warn" | "fail"
): QualityAlert {
  const std = STANDARDS[param as keyof typeof STANDARDS] as {
    min: number; max: number; warn_min?: number; warn_max?: number;
  };

  const recs: Record<string, string> = {
    pH: "Dose lime (to raise) or CO₂ injection (to lower) to bring pH to 7.0–7.5.",
    TDS_mg_L: "Increase RO filtration capacity. Check upstream industrial discharge.",
    turbidity_NTU: "Flush distribution mains. Inspect pipe joints for soil intrusion.",
    residual_chlorine_mg_L:
      value < 0.2
        ? "Increase chlorination at treatment plant. Check contact time."
        : "Reduce dosing. Check chloramine formation.",
    microbial_CFU: "IMMEDIATE: Boil-water advisory. Shock chlorination required.",
    hardness_mg_L: "Install water softeners at household level or treat with lime-soda.",
  };

  return {
    zone_id,
    parameter: param,
    measured_value: value,
    safe_range: { min: std.min, max: std.max },
    severity: status === "fail" ? "CRITICAL" : "WARNING",
    recommendation: recs[param] ?? "Inspect and re-test.",
  };
}

// ─── Main Quality Report ──────────────────────────────────────

export function generateQualityReport(): QualitySystemSummary {
  const zones = getUrbanWaterZones();
  const reports: ZoneQualityReport[] = [];
  const all_critical_alerts: QualityAlert[] = [];

  for (const zone of zones) {
    const q = zone.water_quality;
    const alerts: QualityAlert[] = [];
    const treatment_needed: string[] = [];

    const params = {
      pH: { value: q.pH, status: rateParam("pH", q.pH) },
      TDS_mg_L: { value: q.TDS_mg_L, status: rateParam("TDS_mg_L", q.TDS_mg_L) },
      turbidity_NTU: { value: q.turbidity_NTU, status: rateParam("turbidity_NTU", q.turbidity_NTU) },
      residual_chlorine_mg_L: { value: q.residual_chlorine_mg_L, status: rateParam("residual_chlorine_mg_L", q.residual_chlorine_mg_L) },
      microbial_CFU: { value: q.microbial_load_CFU, status: rateParam("microbial_CFU", q.microbial_load_CFU) },
      hardness_mg_L: { value: q.hardness_mg_L, status: rateParam("hardness_mg_L", q.hardness_mg_L) },
    } as ZoneQualityReport["parameters"];

    for (const [key, entry] of Object.entries(params)) {
      if (entry.status !== "ok") {
        const alert = buildAlert(zone.zone_id, key, entry.value, entry.status as "warn" | "fail");
        alerts.push(alert);
        if (alert.severity === "CRITICAL") {
          all_critical_alerts.push(alert);
          treatment_needed.push(alert.recommendation.split(".")[0]);
        }
      }
    }

    const fail_count = Object.values(params).filter((p) => p.status === "fail").length;
    const warn_count = Object.values(params).filter((p) => p.status === "warn").length;
    const score = Math.max(0, 100 - fail_count * 25 - warn_count * 8);

    const status: ZoneQualityReport["status"] =
      fail_count >= 2 || params.microbial_CFU.status === "fail"
        ? "UNFIT"
        : fail_count >= 1 || warn_count >= 3
        ? "TREATMENT_REQUIRED"
        : "POTABLE";

    reports.push({
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      status,
      score,
      parameters: params,
      alerts,
      last_tested: q.last_tested,
      treatment_needed,
    });
  }

  const potable = reports.filter((r) => r.status === "POTABLE").length;
  const treatment_req = reports.filter((r) => r.status === "TREATMENT_REQUIRED").length;
  const unfit = reports.filter((r) => r.status === "UNFIT").length;

  return {
    total_zones: zones.length,
    potable_zones: potable,
    treatment_required: treatment_req,
    unfit_zones: unfit,
    zones_with_alerts: reports.filter((r) => r.alerts.length > 0).length,
    critical_alerts: all_critical_alerts,
    reports,
  };
}
