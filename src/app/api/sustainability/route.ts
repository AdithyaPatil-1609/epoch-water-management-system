/**
 * API: GET /api/sustainability
 *
 * Returns the full multi-variable water analysis for all zones:
 *   - Water availability breakdown (aquifer + surface + recycled + storage)
 *   - Daily demand breakdown (residential + industrial + losses)
 *   - 5-year sustainability projection per zone
 *   - Supply feasibility check
 *   - System-wide summary (Gini, risk counts, totals)
 *
 * Query params:
 *   ?zone_id=Zone-A        → filter to one zone
 *   ?years=5               → projection horizon (default 5)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUrbanWaterZones } from "@/lib/water-zone-data";
import {
  calculateWaterAvailability,
  calculateDailyDemand,
  checkSustainability,
  canSupplyDemand,
  summarizeWaterSystem,
} from "@/lib/water-availability";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const params = request.nextUrl.searchParams;
  const zone_id_filter = params.get("zone_id");
  const years = Math.min(parseInt(params.get("years") ?? "5", 10), 20);

  const allZones = getUrbanWaterZones();
  const zones = zone_id_filter
    ? allZones.filter((z) => z.zone_id === zone_id_filter)
    : allZones;

  if (zone_id_filter && zones.length === 0) {
    return NextResponse.json({ error: `Zone ${zone_id_filter} not found.` }, { status: 404 });
  }

  // Per-zone analysis
  const zone_analysis = zones.map((zone) => {
    const availability = calculateWaterAvailability(zone);
    const demand = calculateDailyDemand(zone);
    const sustainability = checkSustainability(zone, years);
    const feasibility = canSupplyDemand(zone, demand.total_demand_ML);

    return {
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,

      // Supply breakdown
      availability,
      demand,

      // Computed balance
      fulfillment_percent: demand.total_demand_ML > 0
        ? Math.round((availability.total_available_ML / demand.total_demand_ML) * 100)
        : 100,

      // Infrastructure snapshot
      water_table_depth_m: zone.water_table.current_depth_meters,
      water_table_trend_m_per_month: zone.water_table.trend_meters_per_month,
      nrw_percent: zone.water_loss.nrw_percent,
      storage_level_pct: Math.round(
        (zone.storage.current_volume_ML / zone.storage.total_capacity_ML) * 100
      ),

      // Quality
      water_quality: zone.water_quality,

      // Sustainability projection
      sustainability,

      // Feasibility
      feasibility,

      // Equity
      equity: zone.equity,
      population: zone.population,
    };
  });

  // System-wide summary (always over all zones)
  const system_summary = summarizeWaterSystem(allZones);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    response_time_ms: Date.now() - start,
    system_summary,
    zones: zone_analysis,
  });
}
