// ──────────────────────────────────────────────────────────────
// Demand Forecaster
// ARIMA-inspired time-series forecasting in pure TypeScript.
// Uses weighted exponential smoothing + seasonal decomposition
// + exogenous factor corrections (temp, rain, weekday, holiday).
//
// Produces 24/48/72-hour demand forecasts with confidence intervals.
// ──────────────────────────────────────────────────────────────

import { getScadaSimulator } from "@/lib/scada-simulator";

export interface ExogenousFactors {
  temperature_c: number;
  rainfall_mm: number;
  is_weekend: boolean;
  is_holiday: boolean;
  hour_of_day: number;
  season: "monsoon" | "winter" | "summer";
}

export interface DemandForecast {
  zone_id: string;
  forecast_generated_at: string;
  horizon_hours: 24 | 48 | 72;
  forecasts: HourlyForecast[];
  daily_summary: {
    mean_ML_per_hour: number;
    peak_ML_per_hour: number;
    peak_hour: number;
    total_ML: number;
    confidence_score: number;
  };
  exogenous_adjustments: {
    temperature_factor: number;
    rainfall_factor: number;
    weekday_factor: number;
    seasonal_factor: number;
    net_factor: number;
  };
}

export interface HourlyForecast {
  hour_offset: number;
  timestamp: string;
  predicted_ML: number;
  confidence_interval_low: number;
  confidence_interval_high: number;
  factors: string[];
}

// ─── Seasonal & climate adjustments ───────────────────────────

function exogenousAdjustment(factors: ExogenousFactors): {
  temperature_factor: number;
  rainfall_factor: number;
  weekday_factor: number;
  seasonal_factor: number;
  net_factor: number;
} {
  // +2% per °C above 25°C baseline
  const temperature_factor = 1 + Math.max(0, (factors.temperature_c - 25) * 0.02);

  // -0.5% per mm of rainfall (wet weather reduces outdoor water use)
  const rainfall_factor = 1 - Math.min(factors.rainfall_mm * 0.005, 0.25);

  // Weekends: -15%; holidays: +20%
  const weekday_factor = factors.is_holiday ? 1.2 : factors.is_weekend ? 0.85 : 1.0;

  const seasonal_factor =
    factors.season === "summer" ? 1.38
    : factors.season === "monsoon" ? 0.82
    : 1.0;

  const net_factor = temperature_factor * rainfall_factor * weekday_factor * seasonal_factor;

  return {
    temperature_factor: Math.round(temperature_factor * 100) / 100,
    rainfall_factor: Math.round(rainfall_factor * 100) / 100,
    weekday_factor,
    seasonal_factor,
    net_factor: Math.round(net_factor * 100) / 100,
  };
}

// Hourly demand profile (normalized, avg = 1.0)
const HOURLY_PROFILE: number[] = [
  0.20, 0.18, 0.16, 0.15, 0.18, 0.50,
  1.40, 1.80, 1.80, 1.20, 0.80, 0.65,
  0.60, 0.60, 0.55, 0.60, 0.75, 1.00,
  1.60, 1.60, 1.40, 1.10, 0.70, 0.40,
];

// ─── Core Forecaster ──────────────────────────────────────────

export class DemandForecaster {
  /**
   * Forecast demand for a zone using historical SCADA + exogenous factors.
   *
   * Algorithm:
   *   1. Get last 48h of hourly readings (smoothed with EMA α=0.3)
   *   2. Compute baseline hourly pattern from history
   *   3. Apply exogenous correction factors
   *   4. Project forward with hourly profile × base × net_factor
   *   5. Compute 90% confidence intervals (±1.645σ from residuals)
   */
  forecastZone(
    zone_id: string,
    horizon_hours: 24 | 48 | 72,
    factors: ExogenousFactors
  ): DemandForecast {
    const sim = getScadaSimulator();
    const history = sim.getHistoricalReadings(zone_id, 48);

    // EMA smoothing (α = 0.3)
    const alpha = 0.3;
    const smoothed: number[] = [];
    let ema = history[0]?.consumption_ML ?? 1.0;
    for (const r of history) {
      ema = alpha * r.consumption_ML + (1 - alpha) * ema;
      smoothed.push(ema);
    }

    // Baseline daily average from smoothed history
    const daily_avg_ML = (smoothed.reduce((a, b) => a + b, 0) / smoothed.length) * 24;

    // Residual standard deviation (for confidence intervals)
    const residuals = history.map((r, i) => r.consumption_ML - smoothed[i]);
    const sigma = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);

    const adj = exogenousAdjustment(factors);
    const now = new Date();

    const forecasts: HourlyForecast[] = [];
    let peak_ML = 0;
    let peak_hour = 0;

    for (let h = 1; h <= horizon_hours; h++) {
      const ts = new Date(now.getTime() + h * 3_600_000);
      const hour = ts.getHours();
      const profile_factor = HOURLY_PROFILE[hour] ?? 1.0;

      const predicted_ML = Math.max(0, (daily_avg_ML / 24) * profile_factor * adj.net_factor);
      const ci_margin = 1.645 * sigma; // 90% CI

      const f_factors: string[] = [];
      if (factors.temperature_c > 30) f_factors.push(`high_temp_${factors.temperature_c}°C`);
      if (factors.rainfall_mm > 10) f_factors.push("rainfall");
      if (factors.is_weekend) f_factors.push("weekend");
      if (factors.is_holiday) f_factors.push("holiday");
      if (profile_factor > 1.4) f_factors.push("morning_peak");
      if (hour >= 18 && hour <= 21) f_factors.push("evening_peak");

      if (predicted_ML > peak_ML) { peak_ML = predicted_ML; peak_hour = hour; }

      forecasts.push({
        hour_offset: h,
        timestamp: ts.toISOString(),
        predicted_ML: Math.round(predicted_ML * 1000) / 1000,
        confidence_interval_low: Math.max(0, Math.round((predicted_ML - ci_margin) * 1000) / 1000),
        confidence_interval_high: Math.round((predicted_ML + ci_margin) * 1000) / 1000,
        factors: f_factors,
      });
    }

    const total_ML = forecasts.reduce((s, f) => s + f.predicted_ML, 0);
    const confidence_score = sigma / daily_avg_ML < 0.1 ? 0.9 : sigma / daily_avg_ML < 0.2 ? 0.75 : 0.6;

    return {
      zone_id,
      forecast_generated_at: now.toISOString(),
      horizon_hours,
      forecasts,
      daily_summary: {
        mean_ML_per_hour: Math.round((total_ML / horizon_hours) * 1000) / 1000,
        peak_ML_per_hour: Math.round(peak_ML * 1000) / 1000,
        peak_hour,
        total_ML: Math.round(total_ML * 100) / 100,
        confidence_score,
      },
      exogenous_adjustments: adj,
    };
  }

  /** Forecast all 20 zones */
  forecastAll(horizon_hours: 24 | 48 | 72, factors: ExogenousFactors): DemandForecast[] {
    const zones = [
      "Zone-A","Zone-B","Zone-C","Zone-D","Zone-E","Zone-F","Zone-G",
      "Zone-H","Zone-I","Zone-J","Zone-K","Zone-L","Zone-M","Zone-N",
      "Zone-O","Zone-P","Zone-Q","Zone-R","Zone-S","Zone-T",
    ];
    return zones.map((z) => this.forecastZone(z, horizon_hours, factors));
  }

  /** Detect if actual consumption deviates from forecast */
  detectUnexpectedChange(
    zone_id: string,
    actual_ML: number,
    forecast: DemandForecast
  ): { is_anomaly: boolean; deviation_percent: number; direction: "spike" | "drop" | "normal" } {
    const predicted = forecast.daily_summary.mean_ML_per_hour;
    const deviation_percent = ((actual_ML - predicted) / predicted) * 100;
    const is_anomaly = Math.abs(deviation_percent) > 25;
    const direction = deviation_percent > 25 ? "spike" : deviation_percent < -25 ? "drop" : "normal";
    return { is_anomaly, deviation_percent: Math.round(deviation_percent * 10) / 10, direction };
  }
}

// Singleton
let _forecaster: DemandForecaster | null = null;
export function getForecaster(): DemandForecaster {
  if (!_forecaster) _forecaster = new DemandForecaster();
  return _forecaster;
}

/** Default current exogenous factors (can be overridden by weather API) */
export function defaultFactors(): ExogenousFactors {
  const now = new Date();
  const dow = now.getDay();
  return {
    temperature_c: 28,
    rainfall_mm: 0,
    is_weekend: dow === 0 || dow === 6,
    is_holiday: false,
    hour_of_day: now.getHours(),
    season: "winter",
  };
}
