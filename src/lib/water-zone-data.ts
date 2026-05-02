// ──────────────────────────────────────────────────────────────
// Water Zone Extended Data Generator
// Generates realistic UrbanWaterZone records for all 20 Bangalore zones.
// Values are calibrated to real Indian city ranges:
//   Water table: 3–30m, Recharge: 50–500 ML/day
//   NRW: 25–55%, Per-capita: 60–200 L/day
// ──────────────────────────────────────────────────────────────

import type { UrbanWaterZone, PumpStation } from "@/lib/types/water-zone";

// ─── Seeded PRNG (deterministic) ─────────────────────────────

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Zone Meta (matches synthetic-data.ts) ───────────────────

const ZONE_META: Record<string, {
  name: string; lat: number; lng: number;
  socio: "low_income" | "middle_income" | "high_income" | "mixed";
  surface_source: string; area_km2: number;
}> = {
  "Zone-A": { name: "Rajajinagar Central",    lat: 12.990, lng: 77.570, socio: "middle_income", surface_source: "Cauvery System", area_km2: 14.2 },
  "Zone-B": { name: "Koramangala East",        lat: 12.935, lng: 77.620, socio: "high_income",   surface_source: "Cauvery System", area_km2: 11.8 },
  "Zone-C": { name: "Whitefield Heights",      lat: 12.970, lng: 77.750, socio: "high_income",   surface_source: "TG Halli Reservoir", area_km2: 22.5 },
  "Zone-D": { name: "Westbrook District",      lat: 12.960, lng: 77.540, socio: "middle_income", surface_source: "Cauvery System", area_km2: 13.0 },
  "Zone-E": { name: "Indiranagar South",       lat: 12.975, lng: 77.640, socio: "high_income",   surface_source: "Cauvery System", area_km2: 9.5 },
  "Zone-F": { name: "Jayanagar Block III",     lat: 12.925, lng: 77.580, socio: "middle_income", surface_source: "Cauvery System", area_km2: 12.1 },
  "Zone-G": { name: "Majestic Underground",    lat: 12.980, lng: 77.575, socio: "low_income",    surface_source: "Cauvery System", area_km2: 7.8 },
  "Zone-H": { name: "Electronic City Phase I", lat: 12.850, lng: 77.680, socio: "mixed",         surface_source: "Cauvery System", area_km2: 28.4 },
  "Zone-I": { name: "Vijayanagar Main",        lat: 12.965, lng: 77.530, socio: "middle_income", surface_source: "Cauvery System", area_km2: 11.3 },
  "Zone-J": { name: "Hebbal Lake Ward",        lat: 13.040, lng: 77.600, socio: "mixed",         surface_source: "Hebbal Lake", area_km2: 16.9 },
  "Zone-K": { name: "Yeshwanthpur Industrial", lat: 13.020, lng: 77.560, socio: "mixed",         surface_source: "Cauvery System", area_km2: 19.2 },
  "Zone-L": { name: "Basavanagudi Heritage",   lat: 12.940, lng: 77.570, socio: "middle_income", surface_source: "Cauvery System", area_km2: 10.5 },
  "Zone-M": { name: "Marathahalli Stadium",    lat: 12.955, lng: 77.700, socio: "mixed",         surface_source: "TG Halli Reservoir", area_km2: 17.3 },
  "Zone-N": { name: "HSR Layout Sector 2",     lat: 12.910, lng: 77.650, socio: "high_income",   surface_source: "Cauvery System", area_km2: 13.6 },
  "Zone-O": { name: "Banashankari Temple Rd",  lat: 12.920, lng: 77.550, socio: "middle_income", surface_source: "Cauvery System", area_km2: 11.0 },
  "Zone-P": { name: "Peenya Industrial North", lat: 13.030, lng: 77.520, socio: "low_income",    surface_source: "Cauvery System", area_km2: 24.0 },
  "Zone-Q": { name: "Peenya Industrial South", lat: 13.025, lng: 77.530, socio: "low_income",    surface_source: "Cauvery System", area_km2: 21.5 },
  "Zone-R": { name: "Yelahanka Surplus Belt",  lat: 13.050, lng: 77.580, socio: "mixed",         surface_source: "Yelahanka Lake", area_km2: 31.2 },
  "Zone-S": { name: "Domlur Inner Ring",       lat: 12.960, lng: 77.630, socio: "high_income",   surface_source: "Cauvery System", area_km2: 8.2 },
  "Zone-T": { name: "Malleshwaram Circle",     lat: 12.995, lng: 77.560, socio: "middle_income", surface_source: "Cauvery System", area_km2: 10.8 },
};

const POPULATION_BASE: Record<string, number> = {
  "Zone-A": 148000, "Zone-B": 112000, "Zone-C": 95000, "Zone-D": 88000,
  "Zone-E": 78000,  "Zone-F": 105000, "Zone-G": 62000, "Zone-H": 180000,
  "Zone-I": 92000,  "Zone-J": 125000, "Zone-K": 210000, "Zone-L": 98000,
  "Zone-M": 140000, "Zone-N": 88000,  "Zone-O": 95000, "Zone-P": 195000,
  "Zone-Q": 185000, "Zone-R": 75000,  "Zone-S": 58000, "Zone-T": 120000,
};

// ─── Generator ───────────────────────────────────────────────

export function generateUrbanWaterZones(): UrbanWaterZone[] {
  const rng = seededRng(2026);
  const zones: UrbanWaterZone[] = [];

  for (const [zone_id, meta] of Object.entries(ZONE_META)) {
    const pop = POPULATION_BASE[zone_id] ?? 100000;
    const r = rng; // local alias

    // Per-capita based on socioeconomic class
    const per_capita = meta.socio === "high_income" ? 155 + r() * 60
      : meta.socio === "middle_income" ? 90 + r() * 35
      : meta.socio === "low_income" ? 50 + r() * 20
      : 80 + r() * 40;

    // Water table depth (Bangalore: 5–20m typical)
    const wt_depth = 5 + r() * 14;
    const wt_trend = -(0.05 + r() * 0.25); // falling 0.05–0.3 m/month

    // Aquifer recharge
    const base_recharge = 80 + r() * 220; // 80–300 ML/day

    // Surface water allocation (higher for central zones)
    const surface_alloc = 150 + r() * 350;

    // NRW: low-income and old infrastructure have more loss
    const base_nrw = meta.socio === "low_income" ? 40 + r() * 15
      : meta.socio === "high_income" ? 20 + r() * 12
      : 28 + r() * 15;
    const physical = base_nrw * 0.55;
    const theft = base_nrw * 0.30;
    const meter_err = base_nrw * 0.15;

    // Storage
    const storage_cap = 200 + r() * 400;
    const storage_vol = storage_cap * (0.5 + r() * 0.4);
    const min_safe = storage_cap * 0.15;

    // Industrial demand
    const ind_demand = meta.socio === "high_income" ? 15 + r() * 20
      : meta.socio === "low_income" ? 5 + r() * 10
      : 10 + r() * 15;

    // Pumping stations
    const num_pumps = 2 + Math.floor(r() * 3);
    const cap_per_pump = (50 + r() * 80) / num_pumps;
    const pumping_stations: PumpStation[] = Array.from({ length: num_pumps }, (_, i) => ({
      id: `Pump-${zone_id.replace("Zone-", "")}-${i + 1}`,
      capacity_ML_day: Math.round(cap_per_pump * 10) / 10,
      max_lift_meters: 40 + r() * 30,
      status: r() < 0.15 ? "maintenance" : "operational",
    }));

    // Compute demand-supply balance
    const seasonal_factor = 1.0; // winter baseline
    const residential_ML = (pop * per_capita * seasonal_factor) / 1_000_000;
    const total_demand = (residential_ML + ind_demand) * (1 + base_nrw / 100);
    const actual_supply = Math.min(
      base_recharge * 0.9 + surface_alloc * 0.85 + 30,
      total_demand * (0.6 + r() * 0.7)
    );
    const deficit = Math.max(0, total_demand - actual_supply);
    const fulfillment = Math.round((actual_supply / Math.max(total_demand, 1)) * 100);

    // Water quality
    const tds = 250 + r() * 300;
    const ph = 6.8 + r() * 1.2;
    const turb = r() * 1.5;
    const chlorine = 0.15 + r() * 0.4;
    const quality_status =
      tds > 600 || turb > 1.2 || chlorine < 0.2
        ? "treatment_required"
        : "potable";

    const zone: UrbanWaterZone = {
      zone_id,
      zone_name: meta.name,
      lat: meta.lat,
      lng: meta.lng,

      water_table: {
        current_depth_meters: Math.round(wt_depth * 10) / 10,
        seasonal_range: { min_monsoon: wt_depth * 0.4, max_dry: wt_depth * 1.6 },
        trend_meters_per_month: Math.round(wt_trend * 100) / 100,
      },

      aquifer_recharge: {
        base_ML_day: Math.round(base_recharge * 10) / 10,
        seasonal_multiplier: 1.0, // winter baseline (monsoon=1.8, summer=0.4)
        declining_trend_ML_year: Math.round((1 + r() * 4) * 10) / 10,
      },

      surface_water: {
        source_name: meta.surface_source,
        allocation_ML_day: Math.round(surface_alloc * 10) / 10,
        seasonal_flow: {
          monsoon: Math.round(surface_alloc * 1.6 * 10) / 10,
          winter: Math.round(surface_alloc * 1.0 * 10) / 10,
          summer: Math.round(surface_alloc * 0.5 * 10) / 10,
        },
        reliability_percent: Math.round(75 + r() * 20),
      },

      recycled_water: {
        treatment_capacity_ML_day: Math.round((20 + r() * 60) * 10) / 10,
        current_output_ML_day: Math.round((15 + r() * 40) * 10) / 10,
        quality_grade: "tertiary",
        available_to_zones: [zone_id],
      },

      pipe_network: {
        max_capacity_ML_day: Math.round((actual_supply * 1.3) * 10) / 10,
        current_flow_ML_day: Math.round(actual_supply * 10) / 10,
        safety_margin_percent: 85,
        age_distribution: {
          years_0_5_pct: 0.1 + r() * 0.15,
          years_5_15_pct: 0.25 + r() * 0.2,
          years_15_30_pct: 0.25 + r() * 0.2,
          years_30_plus_pct: 0.1 + r() * 0.2,
        },
        degradation_factor: Math.round((0.78 + r() * 0.19) * 100) / 100,
      },

      pumping_stations,

      storage: {
        total_capacity_ML: Math.round(storage_cap * 10) / 10,
        current_volume_ML: Math.round(storage_vol * 10) / 10,
        minimum_safe_level_ML: Math.round(min_safe * 10) / 10,
        evaporation_loss_ML_day: Math.round((1 + r() * 4) * 10) / 10,
        facilities: [
          {
            name: `Overhead Tank-${zone_id.replace("Zone-", "")}1`,
            capacity_ML: Math.round(storage_cap * 0.4 * 10) / 10,
            elevation_meters: 18 + Math.round(r() * 12),
            age_years: Math.round(5 + r() * 20),
          },
          {
            name: `Ground Reservoir-${zone_id.replace("Zone-", "")}2`,
            capacity_ML: Math.round(storage_cap * 0.6 * 10) / 10,
            elevation_meters: 0,
            age_years: Math.round(3 + r() * 15),
          },
        ],
      },

      population: {
        total: pop,
        area_km2: meta.area_km2,
        density_per_km2: Math.round(pop / meta.area_km2),
        growth_rate_annual: 0.02 + r() * 0.03,
      },

      consumption: {
        per_capita_liters_day: Math.round(per_capita),
        socioeconomic_class: meta.socio,
        seasonal_variation: { monsoon: 0.82, winter: 1.0, summer: 1.38 },
        time_of_day_profile: { morning_peak: 1.8, midday: 0.6, evening_peak: 1.6, night: 0.2 },
      },

      industrial_demand: {
        consumers: [
          { name: `Industries (${meta.name})`, contract_ML_day: Math.round(ind_demand * 0.6 * 10) / 10, peak_hours: "9am-6pm", critical: false },
          { name: `Hospitals & Essential (${meta.name})`, contract_ML_day: Math.round(ind_demand * 0.4 * 10) / 10, peak_hours: "24h", critical: true },
        ],
        total_contracted_ML_day: Math.round(ind_demand * 10) / 10,
      },

      demand_supply: {
        total_demand_ML_day: Math.round(total_demand * 10) / 10,
        actual_supply_ML_day: Math.round(actual_supply * 10) / 10,
        deficit_ML_day: Math.round(deficit * 10) / 10,
        fulfillment_percent: fulfillment,
        hours_supply_per_day: fulfillment >= 100 ? 24 : Math.round((fulfillment / 100) * 24),
        affected_population: fulfillment >= 100 ? 0 : Math.round(pop * (1 - fulfillment / 100)),
      },

      water_loss: {
        nrw_percent: Math.round(base_nrw * 10) / 10,
        physical_leaks_percent: Math.round(physical * 10) / 10,
        theft_percent: Math.round(theft * 10) / 10,
        meter_error_percent: Math.round(meter_err * 10) / 10,
      },

      water_quality: {
        source: `${meta.surface_source} + groundwater`,
        pH: Math.round(ph * 10) / 10,
        TDS_mg_L: Math.round(tds),
        turbidity_NTU: Math.round(turb * 10) / 10,
        residual_chlorine_mg_L: Math.round(chlorine * 100) / 100,
        microbial_load_CFU: Math.random() < 0.1 ? Math.round(r() * 50) : 0,
        hardness_mg_L: Math.round(80 + r() * 160),
        status: quality_status,
        last_tested: "2026-04-28",
      },

      climate: {
        current_temperature_c: Math.round(24 + r() * 12),
        rainfall_mm_month: Math.round(r() * 80),
        evaporation_mm_day: Math.round((3 + r() * 6) * 10) / 10,
        humidity_percent: Math.round(45 + r() * 40),
        season: "winter",
      },

      equity: {
        fulfillment_percent: fulfillment,
        gini_contribution: Math.round((1 - fulfillment / 100) * 100) / 100,
        socioeconomic_class: meta.socio,
        price_per_kiloliter_rs: meta.socio === "high_income" ? 45 : meta.socio === "low_income" ? 20 : 32,
        affordability_index: Math.round(((per_capita * 30 / 1000) / (meta.socio === "low_income" ? 8000 : meta.socio === "high_income" ? 80000 : 30000)) * 100 * 100) / 100,
      },
    };

    zones.push(zone);
  }

  return zones;
}

// Singleton cache
let _waterZones: UrbanWaterZone[] | null = null;

export function getUrbanWaterZones(): UrbanWaterZone[] {
  if (!_waterZones) _waterZones = generateUrbanWaterZones();
  return _waterZones;
}

export function resetWaterZoneCache(): void {
  _waterZones = null;
}
