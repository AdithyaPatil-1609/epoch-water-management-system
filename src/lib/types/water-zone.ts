// ──────────────────────────────────────────────────────────────
// UrbanWaterZone — Complete multi-variable data model
// Covers all 6 tiers: Hydrological, Infrastructure, Demand,
// Operational, Environmental, and Governance/Equity variables.
// ──────────────────────────────────────────────────────────────

export interface WaterTable {
  current_depth_meters: number;
  seasonal_range: { min_monsoon: number; max_dry: number };
  trend_meters_per_month: number; // negative = falling
}

export interface AquiferRecharge {
  base_ML_day: number;
  seasonal_multiplier: number; // current season factor (monsoon=1.8, summer=0.4)
  declining_trend_ML_year: number; // how much recharge shrinks per year
}

export interface SurfaceWaterSource {
  source_name: string;
  allocation_ML_day: number;
  seasonal_flow: { monsoon: number; winter: number; summer: number };
  reliability_percent: number; // 0–100: % of allocation actually available
}

export interface RecycledWater {
  treatment_capacity_ML_day: number;
  current_output_ML_day: number;
  quality_grade: "primary" | "secondary" | "tertiary";
  available_to_zones: string[];
}

export interface PipeNetwork {
  max_capacity_ML_day: number;
  current_flow_ML_day: number;
  safety_margin_percent: number; // operate at this % of capacity
  age_distribution: {
    years_0_5_pct: number;
    years_5_15_pct: number;
    years_15_30_pct: number;
    years_30_plus_pct: number;
  };
  degradation_factor: number; // 0–1, capacity remaining after aging
}

export interface PumpStation {
  id: string;
  capacity_ML_day: number;
  max_lift_meters: number;
  status: "operational" | "maintenance" | "failed";
}

export interface StorageFacility {
  name: string;
  capacity_ML: number;
  elevation_meters: number;
  age_years: number;
}

export interface WaterStorage {
  total_capacity_ML: number;
  current_volume_ML: number;
  minimum_safe_level_ML: number;
  evaporation_loss_ML_day: number;
  facilities: StorageFacility[];
}

export interface ZonePopulation {
  total: number;
  area_km2: number;
  density_per_km2: number;
  growth_rate_annual: number; // e.g. 0.03 = 3%
}

export interface ConsumptionProfile {
  per_capita_liters_day: number;
  socioeconomic_class: "low_income" | "middle_income" | "high_income" | "mixed";
  seasonal_variation: { monsoon: number; winter: number; summer: number };
  time_of_day_profile: {
    morning_peak: number;
    midday: number;
    evening_peak: number;
    night: number;
  };
}

export interface IndustrialConsumer {
  name: string;
  contract_ML_day: number;
  peak_hours: string;
  critical: boolean; // hospitals, fire stations — cannot be cut
}

export interface IndustrialDemand {
  consumers: IndustrialConsumer[];
  total_contracted_ML_day: number;
}

export interface WaterLoss {
  nrw_percent: number; // non-revenue water total
  physical_leaks_percent: number;
  theft_percent: number;
  meter_error_percent: number;
}

export interface DemandSupplyBalance {
  total_demand_ML_day: number;
  actual_supply_ML_day: number;
  deficit_ML_day: number;
  fulfillment_percent: number;
  hours_supply_per_day: number;
  affected_population: number;
}

export interface WaterQuality {
  source: string;
  pH: number;             // ideal 6.5–8.5
  TDS_mg_L: number;       // total dissolved solids, ideal <500
  turbidity_NTU: number;  // cloudiness, ideal <1
  residual_chlorine_mg_L: number; // ideal 0.2–0.5
  microbial_load_CFU: number;     // bacteria count, ideal 0
  hardness_mg_L: number;  // ideal <100
  status: "potable" | "treatment_required" | "unfit";
  last_tested: string;
}

export interface ClimateData {
  current_temperature_c: number;
  rainfall_mm_month: number;
  evaporation_mm_day: number;
  humidity_percent: number;
  season: "monsoon" | "winter" | "summer";
}

export interface EquityData {
  fulfillment_percent: number;
  gini_contribution: number;
  socioeconomic_class: string;
  price_per_kiloliter_rs: number;
  affordability_index: number; // <1 = affordable, >1 = unaffordable
}

// ─── Master Interface ─────────────────────────────────────────

export interface UrbanWaterZone {
  // Identity
  zone_id: string;
  zone_name: string;
  lat: number;
  lng: number;

  // Tier 1: Hydrological
  water_table: WaterTable;
  aquifer_recharge: AquiferRecharge;
  surface_water: SurfaceWaterSource;
  recycled_water: RecycledWater;

  // Tier 2: Infrastructure
  pipe_network: PipeNetwork;
  pumping_stations: PumpStation[];
  storage: WaterStorage;

  // Tier 3: Demand
  population: ZonePopulation;
  consumption: ConsumptionProfile;
  industrial_demand: IndustrialDemand;

  // Tier 4: Operational
  demand_supply: DemandSupplyBalance;
  water_loss: WaterLoss;

  // Tier 5: Environmental
  water_quality: WaterQuality;
  climate: ClimateData;

  // Tier 6: Governance & Equity
  equity: EquityData;
}

// ─── Result types ─────────────────────────────────────────────

export interface WaterAvailabilityResult {
  zone_id: string;
  total_available_ML: number;
  aquifer_contribution_ML: number;
  surface_contribution_ML: number;
  recycled_contribution_ML: number;
  storage_daily_draw_ML: number;
  evaporation_loss_ML: number;
}

export interface SustainabilityResult {
  zone_id: string;
  current_supply_ML: number;
  future_aquifer_ML: number;
  water_table_depth_m: number;
  pump_feasible: boolean;
  sustainable: boolean;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  years_ahead: number;
  projection_timeline: YearlyProjection[];
}

export interface YearlyProjection {
  year: number;
  aquifer_capacity_ML: number;
  water_table_depth_m: number;
  population: number;
  demand_ML: number;
  supply_ML: number;
  sustainable: boolean;
  deficit_ML: number;
}

export interface SupplyFeasibilityResult {
  zone_id: string;
  quantity_met: boolean;
  quantity_surplus_ML: number;
  quality_safe: boolean;
  sustainable: boolean;
  can_supply: boolean;
  risk_factors: string[];
}
