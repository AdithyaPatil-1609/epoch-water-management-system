// ──────────────────────────────────────────────────────────────
// Mock SCADA Simulator
// Generates realistic sensor readings using:
//   - Hourly demand profiles (peak 6-9am / 6-10pm)
//   - Seasonal multipliers (monsoon/winter/summer)
//   - Sensor noise (±4%)
//   - Anomaly modes: leak progression, night theft, meter fault
// ──────────────────────────────────────────────────────────────

export interface ScadaReading {
  zone_id: string;
  timestamp: Date;
  consumption_ML: number;
  flow_rate_ML_per_hour: number;
  pressure_bar: number;
  sensor_confidence: number; // 0.75–1.0
  source: "scada_api" | "mock";
  flags: string[]; // e.g. ["night_spike", "low_pressure"]
}

export interface PressureReading {
  zone_id: string;
  timestamp: Date;
  pressure_bar: number;
  flow_ML_per_hour: number;
  sensor_id: string;
}

// ─── Hourly Demand Profile (normalized, avg = 1.0) ────────────
const HOURLY_PROFILE: number[] = [
  0.20, 0.18, 0.16, 0.15, 0.18, 0.50, // 0–5 AM
  1.40, 1.80, 1.80, 1.20, 0.80, 0.65, // 6–11 AM
  0.60, 0.60, 0.55, 0.60, 0.75, 1.00, // 12–5 PM
  1.60, 1.60, 1.40, 1.10, 0.70, 0.40, // 6–11 PM
];

const SEASONAL_MULTIPLIER: Record<string, number> = {
  monsoon: 0.82,
  winter: 1.00,
  summer: 1.38,
};

// Base daily consumption (ML) per zone — seeded realistic
const BASE_ZONE_DAILY_ML: Record<string, number> = {
  "Zone-A": 28.5, "Zone-B": 18.2, "Zone-C": 15.4, "Zone-D": 14.1,
  "Zone-E": 12.8, "Zone-F": 17.3, "Zone-G": 8.9,  "Zone-H": 38.0,
  "Zone-I": 15.0, "Zone-J": 22.1, "Zone-K": 45.0, "Zone-L": 16.5,
  "Zone-M": 24.8, "Zone-N": 14.6, "Zone-O": 16.0, "Zone-P": 42.0,
  "Zone-Q": 40.2, "Zone-R": 12.5, "Zone-S": 9.2,  "Zone-T": 20.8,
};

const BASE_PRESSURE: Record<string, number> = {
  "Zone-A": 2.4, "Zone-B": 2.7, "Zone-C": 2.1, "Zone-D": 2.3,
  "Zone-E": 2.9, "Zone-F": 2.5, "Zone-G": 1.9, "Zone-H": 2.0,
  "Zone-I": 2.6, "Zone-J": 2.2, "Zone-K": 1.8, "Zone-L": 2.5,
  "Zone-M": 2.3, "Zone-N": 2.8, "Zone-O": 2.4, "Zone-P": 1.7,
  "Zone-Q": 1.8, "Zone-R": 3.1, "Zone-S": 2.9, "Zone-T": 2.6,
};

// ─── Seeded noise ─────────────────────────────────────────────

function gaussianNoise(mean: number, stddev: number, seed: number): number {
  // Box-Muller transform (deterministic via seed)
  const u1 = ((seed * 16807) % 2147483647) / 2147483647;
  const u2 = ((seed * 1103515245 + 12345) % 2147483647) / 2147483647;
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

// ─── Main Simulator ───────────────────────────────────────────

export class MockScadaSimulator {
  private season: string;
  private leakZones: Map<string, number>; // zone_id → severity (0–1)
  private theftZones: Set<string>;
  private faultZones: Set<string>;

  constructor(season: "monsoon" | "winter" | "summer" = "winter") {
    this.season = season;
    this.leakZones = new Map();
    this.theftZones = new Set();
    this.faultZones = new Set();
  }

  /** Get a single zone reading at a given time */
  getReading(zone_id: string, at: Date = new Date()): ScadaReading {
    const hour = at.getHours();
    const seed = at.getTime() + zone_id.charCodeAt(5);
    const base_daily = BASE_ZONE_DAILY_ML[zone_id] ?? 20;
    const seasonal = SEASONAL_MULTIPLIER[this.season] ?? 1.0;
    const hourly = HOURLY_PROFILE[hour] ?? 1.0;

    // Base flow (ML/hour)
    let flow = (base_daily * seasonal * hourly) / 24;

    const flags: string[] = [];

    // Leak progression
    if (this.leakZones.has(zone_id)) {
      const severity = this.leakZones.get(zone_id)!;
      flow *= 1 + severity * 2; // up to 3× baseline
      flags.push(`leak_active_${Math.round(severity * 100)}pct`);
    }

    // Night theft (11pm–4am spike)
    if (this.theftZones.has(zone_id) && (hour >= 23 || hour <= 4)) {
      flow *= 1.6;
      flags.push("night_spike");
    }

    // Meter fault — random readings
    if (this.faultZones.has(zone_id)) {
      flow *= 0.3 + Math.abs(Math.sin(seed)) * 1.4;
      flags.push("meter_fault");
    }

    // Add ±4% Gaussian noise
    const noise_factor = 1 + gaussianNoise(0, 0.04, seed);
    const consumption_ML = Math.max(0, flow * noise_factor);
    const sensor_confidence = this.faultZones.has(zone_id) ? 0.55 : 0.88 + Math.random() * 0.12;

    // Pressure drops when flow is high
    const base_p = BASE_PRESSURE[zone_id] ?? 2.3;
    const pressure_bar = Math.max(0.5, base_p - (consumption_ML / (base_daily / 24)) * 0.2 + gaussianNoise(0, 0.05, seed + 1));
    if (pressure_bar < 1.5) flags.push("low_pressure");

    return {
      zone_id,
      timestamp: at,
      consumption_ML: Math.round(consumption_ML * 1000) / 1000,
      flow_rate_ML_per_hour: Math.round(consumption_ML * 1000) / 1000,
      pressure_bar: Math.round(pressure_bar * 100) / 100,
      sensor_confidence: Math.round(sensor_confidence * 100) / 100,
      source: "mock",
      flags,
    };
  }

  /** Get latest readings for all 20 zones */
  getLatestReadings(at: Date = new Date()): ScadaReading[] {
    return Object.keys(BASE_ZONE_DAILY_ML).map((z) => this.getReading(z, at));
  }

  /** Get hourly readings for a zone over the last N hours */
  getHistoricalReadings(zone_id: string, hours: number = 48): ScadaReading[] {
    const now = new Date();
    const readings: ScadaReading[] = [];
    for (let h = hours; h >= 0; h--) {
      const t = new Date(now.getTime() - h * 3600_000);
      readings.push(this.getReading(zone_id, t));
    }
    return readings;
  }

  /** Simulate a leak: severity 0.0–1.0 */
  simulateLeak(zone_id: string, severity = 0.5): void {
    this.leakZones.set(zone_id, severity);
  }

  /** Progress a leak over N days */
  simulateLeakProgression(zone_id: string, days: number): ScadaReading[] {
    const readings: ScadaReading[] = [];
    for (let day = 0; day < days; day++) {
      const severity = Math.min(1.0, day * 0.15); // grows 15%/day
      this.leakZones.set(zone_id, severity);
      const t = new Date(Date.now() - (days - day) * 86_400_000);
      readings.push(this.getReading(zone_id, t));
    }
    return readings;
  }

  simulateNightTheft(zone_id: string): void { this.theftZones.add(zone_id); }
  simulateMeterFault(zone_id: string): void { this.faultZones.add(zone_id); }
  clearAll(): void { this.leakZones.clear(); this.theftZones.clear(); this.faultZones.clear(); }
}

// ─── Singleton ────────────────────────────────────────────────

let _simulator: MockScadaSimulator | null = null;

export function getScadaSimulator(): MockScadaSimulator {
  if (!_simulator) _simulator = new MockScadaSimulator("winter");
  return _simulator;
}
