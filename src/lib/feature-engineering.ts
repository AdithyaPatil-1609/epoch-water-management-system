/**
 * Feature Engineering Module for Water Consumption Anomaly Detection
 * Computes statistical and temporal features from time-series water data.
 */

export interface Reading {
  timestamp: Date;
  consumption: number;
}

export interface EngineeredFeatures {
  rolling_mean_7d: number;
  rolling_std_7d: number;
  same_hour_baseline: number;
  day_of_week: number;
  is_weekday: number;
  consumption_ratio: number;
  rate_of_change: number;
}

/**
 * Computes anomaly detection features for a given reading using its historical context.
 * 
 * @param currentReading The reading to compute features for.
 * @param historicalData Chronologically sorted array of previous readings (e.g., last 7 days).
 * @returns Computed features ready for normalization or inference.
 */
export function computeFeatures(
  currentReading: Reading,
  historicalData: Reading[]
): EngineeredFeatures {
  const currentCons = currentReading.consumption;
  const currentTs = currentReading.timestamp;

  // Temporal Features
  const day_of_week = currentTs.getDay(); // 0 (Sun) to 6 (Sat)
  const is_weekday = (day_of_week >= 1 && day_of_week <= 5) ? 1 : 0;

  let total = 0;
  let count = 0;
  let sameHourTotal = 0;
  let sameHourCount = 0;
  
  const currentHour = currentTs.getHours();
  
  // Default previous consumption to current if history is empty
  let prevCons = currentCons;
  if (historicalData.length > 0) {
    prevCons = historicalData[historicalData.length - 1].consumption;
  }

  // Iterate over history once (O(N) complexity for <1ms performance)
  for (let i = 0; i < historicalData.length; i++) {
    const r = historicalData[i];
    
    // Skip invalid readings safely
    if (r.consumption == null || isNaN(r.consumption) || !r.timestamp) continue; 

    total += r.consumption;
    count++;

    // Check same hour AND same weekday for historical baseline pattern
    const rTs = r.timestamp;
    if (rTs.getHours() === currentHour && rTs.getDay() === day_of_week) {
      sameHourTotal += r.consumption;
      sameHourCount++;
    }
  }

  // Statistical Features
  const rolling_mean_7d = count > 0 ? total / count : currentCons;
  
  let varianceSum = 0;
  for (let i = 0; i < historicalData.length; i++) {
    const r = historicalData[i];
    if (r.consumption != null && !isNaN(r.consumption)) {
      varianceSum += Math.pow(r.consumption - rolling_mean_7d, 2);
    }
  }
  const rolling_std_7d = count > 1 ? Math.sqrt(varianceSum / (count - 1)) : 0;
  
  const same_hour_baseline = sameHourCount > 0 ? sameHourTotal / sameHourCount : rolling_mean_7d;

  // Relational Features (Avoid Division by Zero)
  const safe_rolling_mean = Math.max(rolling_mean_7d, 0.001);
  const consumption_ratio = currentCons / safe_rolling_mean;
  
  const safe_prev = Math.max(prevCons, 0.001);
  const rate_of_change = (currentCons - prevCons) / safe_prev;

  return {
    rolling_mean_7d,
    rolling_std_7d,
    same_hour_baseline,
    day_of_week,
    is_weekday,
    consumption_ratio: clamp(consumption_ratio, -100, 100),
    rate_of_change: clamp(rate_of_change, -100, 100)
  };
}

/**
 * Utility to clamp extreme anomalous values to prevent model saturation.
 */
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Normalizes computed features using Z-score and outputs a flat Float32Array 
 * directly compatible with ONNX Runtime inference inputs.
 * 
 * @param features The computed raw features.
 * @param means Pre-computed population means for each feature.
 * @param stds Pre-computed population standard deviations for each feature.
 * @returns Float32Array for ONNX Tensor consumption.
 */
export function normalizeForONNX(
  features: EngineeredFeatures,
  means: Record<keyof EngineeredFeatures, number>,
  stds: Record<keyof EngineeredFeatures, number>
): Float32Array {
  // Define strict feature order expected by the Isolation Forest model
  const keys: (keyof EngineeredFeatures)[] = [
    'rolling_mean_7d',
    'rolling_std_7d',
    'same_hour_baseline',
    'day_of_week',
    'is_weekday',
    'consumption_ratio',
    'rate_of_change'
  ];

  const normalizedArray = keys.map(k => {
    const val = features[k];
    const mean = means[k];
    const std = stds[k] === 0 ? 1 : stds[k]; // Fallback to 1 to prevent NaN
    
    return (val - mean) / std;
  });

  return new Float32Array(normalizedArray);
}
