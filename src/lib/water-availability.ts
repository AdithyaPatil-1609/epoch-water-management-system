// ──────────────────────────────────────────────────────────────
// Water Availability Engine
// Implements the complete water balance equation:
//
//   Daily Available = Aquifer + Surface Water + Recycled + Storage Draw - Evaporation
//   Daily Demand    = Residential + Industrial + System Losses
//   Fulfillment %   = (Supply / Demand) × 100
//
// Also provides 5-year sustainability projection and feasibility checks.
// ──────────────────────────────────────────────────────────────

import type {
  UrbanWaterZone,
  WaterAvailabilityResult,
  SustainabilityResult,
  SupplyFeasibilityResult,
  YearlyProjection,
} from "@/lib/types/water-zone";

// ─── 1. Water Availability Calculation ───────────────────────

/**
 * Calculate total daily water available to a zone from all sources.
 *
 * Formula:
 *   Available = (Aquifer × SeasonalMultiplier - DecliningTrend/365)
 *             + (SurfaceAllocation × Reliability%)
 *             + RecycledOutput
 *             + (StorageDraw / 30)  ← spread over month
 *             - EvaporationLoss
 */
export function calculateWaterAvailability(zone: UrbanWaterZone): WaterAvailabilityResult {
  // Aquifer contribution (adjusted for season and long-term decline)
  const aquifer_contribution_ML = Math.max(
    0,
    zone.aquifer_recharge.base_ML_day * zone.aquifer_recharge.seasonal_multiplier -
      zone.aquifer_recharge.declining_trend_ML_year / 365
  );

  // Surface water contribution (allocation × reliability factor)
  const surface_contribution_ML =
    zone.surface_water.allocation_ML_day * (zone.surface_water.reliability_percent / 100);

  // Recycled water contribution
  const recycled_contribution_ML = zone.recycled_water.current_output_ML_day;

  // Storage: how much can be drawn today (headroom above minimum, spread over 30 days)
  const storage_headroom = Math.max(
    0,
    zone.storage.current_volume_ML - zone.storage.minimum_safe_level_ML
  );
  const storage_daily_draw_ML = storage_headroom / 30;

  // Evaporation loss from open storage surfaces
  const evaporation_loss_ML = zone.storage.evaporation_loss_ML_day;

  const total_available_ML = Math.max(
    0,
    aquifer_contribution_ML +
      surface_contribution_ML +
      recycled_contribution_ML +
      storage_daily_draw_ML -
      evaporation_loss_ML
  );

  return {
    zone_id: zone.zone_id,
    total_available_ML: Math.round(total_available_ML * 100) / 100,
    aquifer_contribution_ML: Math.round(aquifer_contribution_ML * 100) / 100,
    surface_contribution_ML: Math.round(surface_contribution_ML * 100) / 100,
    recycled_contribution_ML: Math.round(recycled_contribution_ML * 100) / 100,
    storage_daily_draw_ML: Math.round(storage_daily_draw_ML * 100) / 100,
    evaporation_loss_ML: Math.round(evaporation_loss_ML * 100) / 100,
  };
}

// ─── 2. Total Demand Calculation ─────────────────────────────

export interface DemandBreakdown {
  zone_id: string;
  residential_ML: number;
  industrial_ML: number;
  system_loss_ML: number;
  total_demand_ML: number;
}

/**
 * Calculate total daily demand including residential, industrial, and losses.
 *
 * Formula:
 *   Residential = Population × PerCapita(L) × SeasonalFactor / 1_000_000
 *   Industrial  = contracted ML/day
 *   SystemLoss  = (Residential + Industrial) × NRW%
 */
export function calculateDailyDemand(zone: UrbanWaterZone): DemandBreakdown {
  const season = zone.climate.season;
  const seasonal_factor = zone.consumption.seasonal_variation[season] ?? 1.0;

  const residential_ML =
    (zone.population.total *
      zone.consumption.per_capita_liters_day *
      seasonal_factor) /
    1_000_000;

  const industrial_ML = zone.industrial_demand.total_contracted_ML_day;

  const base_demand = residential_ML + industrial_ML;
  const system_loss_ML = base_demand * (zone.water_loss.nrw_percent / 100);

  const total_demand_ML = base_demand + system_loss_ML;

  return {
    zone_id: zone.zone_id,
    residential_ML: Math.round(residential_ML * 100) / 100,
    industrial_ML: Math.round(industrial_ML * 100) / 100,
    system_loss_ML: Math.round(system_loss_ML * 100) / 100,
    total_demand_ML: Math.round(total_demand_ML * 100) / 100,
  };
}

// ─── 3. Sustainability Projection ────────────────────────────

/**
 * Project water sustainability over N years.
 * Accounts for:
 *   - Aquifer decline trend
 *   - Rising water table depth (harder to pump)
 *   - Population growth → rising demand
 *   - Pump maximum lift limit (physical constraint)
 */
export function checkSustainability(
  zone: UrbanWaterZone,
  years_ahead = 5
): SustainabilityResult {
  const availability = calculateWaterAvailability(zone);
  const current_supply_ML = availability.total_available_ML;

  const max_pump_lift =
    zone.pumping_stations.filter((p) => p.status === "operational")[0]
      ?.max_lift_meters ?? 50;

  const projection_timeline: YearlyProjection[] = [];

  for (let year = 1; year <= years_ahead; year++) {
    // Aquifer decline
    const aquifer_capacity_ML = Math.max(
      0,
      zone.aquifer_recharge.base_ML_day -
        (zone.aquifer_recharge.declining_trend_ML_year * year) / 365
    );

    // Water table deepens over time
    const water_table_depth_m =
      zone.water_table.current_depth_meters +
      Math.abs(zone.water_table.trend_meters_per_month) * 12 * year;

    // If water table exceeds pump lift → groundwater unavailable
    const pump_feasible_this_year = water_table_depth_m < max_pump_lift;
    const effective_aquifer = pump_feasible_this_year ? aquifer_capacity_ML : 0;

    // Total supply (aquifer + surface + recycled — no storage projection over years)
    const supply_ML =
      effective_aquifer +
      zone.surface_water.allocation_ML_day *
        (zone.surface_water.reliability_percent / 100) +
      zone.recycled_water.current_output_ML_day;

    // Growing population → growing demand
    const future_population =
      zone.population.total * Math.pow(1 + zone.population.growth_rate_annual, year);
    const season = zone.climate.season;
    const seasonal_factor = zone.consumption.seasonal_variation[season] ?? 1.0;
    const residential_ML = (future_population * zone.consumption.per_capita_liters_day * seasonal_factor) / 1_000_000;
    const demand_ML =
      (residential_ML + zone.industrial_demand.total_contracted_ML_day) *
      (1 + zone.water_loss.nrw_percent / 100);

    const sustainable = supply_ML >= demand_ML;
    const deficit_ML = sustainable ? 0 : Math.round((demand_ML - supply_ML) * 100) / 100;

    projection_timeline.push({
      year,
      aquifer_capacity_ML: Math.round(aquifer_capacity_ML * 100) / 100,
      water_table_depth_m: Math.round(water_table_depth_m * 100) / 100,
      population: Math.round(future_population),
      demand_ML: Math.round(demand_ML * 100) / 100,
      supply_ML: Math.round(supply_ML * 100) / 100,
      sustainable,
      deficit_ML,
    });
  }

  // Final year state
  const final = projection_timeline[projection_timeline.length - 1];
  const final_water_table =
    zone.water_table.current_depth_meters +
    Math.abs(zone.water_table.trend_meters_per_month) * 12 * years_ahead;
  const final_aquifer =
    zone.aquifer_recharge.base_ML_day -
    (zone.aquifer_recharge.declining_trend_ML_year * years_ahead) / 365;
  const pump_feasible = final_water_table < max_pump_lift;

  // Risk level
  const unsustainable_years = projection_timeline.filter((p) => !p.sustainable).length;
  let risk_level: SustainabilityResult["risk_level"] = "LOW";
  if (!pump_feasible || unsustainable_years >= years_ahead) risk_level = "CRITICAL";
  else if (unsustainable_years >= 2) risk_level = "HIGH";
  else if (unsustainable_years >= 1 || final_aquifer < zone.aquifer_recharge.base_ML_day * 0.5)
    risk_level = "MEDIUM";

  return {
    zone_id: zone.zone_id,
    current_supply_ML,
    future_aquifer_ML: Math.round(Math.max(0, final_aquifer) * 100) / 100,
    water_table_depth_m: Math.round(final_water_table * 100) / 100,
    pump_feasible,
    sustainable: final.sustainable,
    risk_level,
    years_ahead,
    projection_timeline,
  };
}

// ─── 4. Supply Feasibility Check ─────────────────────────────

/**
 * Holistic check: can this zone supply a given demand right now?
 * Checks quantity, quality, and long-term sustainability together.
 */
export function canSupplyDemand(
  zone: UrbanWaterZone,
  demand_ML: number
): SupplyFeasibilityResult {
  const availability = calculateWaterAvailability(zone);
  const sustainability = checkSustainability(zone, 5);
  const quality = zone.water_quality;

  const quantity_met = availability.total_available_ML >= demand_ML;
  const quality_safe = quality.status === "potable";

  const risk_factors: string[] = [];
  if (!sustainability.sustainable) risk_factors.push("Aquifer depletion risk within 5 years");
  if (!sustainability.pump_feasible) risk_factors.push("Water table projected to exceed pump lift");
  if (!quality_safe) risk_factors.push(`Water quality: ${quality.status.replace("_", " ")}`);
  if (!quantity_met) risk_factors.push(`Supply deficit: ${(demand_ML - availability.total_available_ML).toFixed(1)} ML/day short`);
  if (availability.total_available_ML < demand_ML * 1.2) risk_factors.push("Buffer below 20% — low resilience");
  if (zone.water_loss.nrw_percent > 40) risk_factors.push(`High NRW: ${zone.water_loss.nrw_percent}% lost to leaks/theft`);
  if (zone.water_table.trend_meters_per_month < -0.2) risk_factors.push("Water table declining rapidly");

  return {
    zone_id: zone.zone_id,
    quantity_met,
    quantity_surplus_ML: Math.round((availability.total_available_ML - demand_ML) * 100) / 100,
    quality_safe,
    sustainable: sustainability.sustainable,
    can_supply: quantity_met && quality_safe && sustainability.sustainable,
    risk_factors,
  };
}

// ─── 5. Multi-Zone Summary ────────────────────────────────────

export interface WaterSystemSummary {
  total_zones: number;
  total_available_ML: number;
  total_demand_ML: number;
  system_fulfillment_pct: number;
  zones_at_risk: string[];
  zones_critical: string[];
  system_gini: number;
  sustainability_breakdown: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number };
}

export function summarizeWaterSystem(zones: UrbanWaterZone[]): WaterSystemSummary {
  const availabilities = zones.map(calculateWaterAvailability);
  const demands = zones.map(calculateDailyDemand);
  const sustainabilities = zones.map((z) => checkSustainability(z, 5));

  const total_available_ML = availabilities.reduce((s, a) => s + a.total_available_ML, 0);
  const total_demand_ML = demands.reduce((s, d) => s + d.total_demand_ML, 0);
  const system_fulfillment_pct =
    total_demand_ML > 0 ? Math.round((total_available_ML / total_demand_ML) * 100) : 100;

  // Gini across fulfillment percentages
  const fulfillments = zones.map((z, i) =>
    demands[i].total_demand_ML > 0
      ? availabilities[i].total_available_ML / demands[i].total_demand_ML
      : 1.0
  );
  const sortedF = [...fulfillments].sort((a, b) => a - b);
  const n = sortedF.length;
  const totalSum = sortedF.reduce((a, b) => a + b, 0);
  const weightedSum = sortedF.reduce((s, f, i) => s + (2 * (i + 1) - n - 1) * f, 0);
  const system_gini = totalSum > 0 ? Math.round((weightedSum / (n * totalSum)) * 1000) / 1000 : 0;

  const sustainability_breakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  sustainabilities.forEach((s) => sustainability_breakdown[s.risk_level]++);

  return {
    total_zones: zones.length,
    total_available_ML: Math.round(total_available_ML * 100) / 100,
    total_demand_ML: Math.round(total_demand_ML * 100) / 100,
    system_fulfillment_pct,
    zones_at_risk: sustainabilities.filter((s) => s.risk_level === "HIGH").map((s) => s.zone_id),
    zones_critical: sustainabilities.filter((s) => s.risk_level === "CRITICAL").map((s) => s.zone_id),
    system_gini,
    sustainability_breakdown,
  };
}
