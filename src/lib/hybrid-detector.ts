export interface HybridAnomalyResult {
 anomaly_score: number;
 severity: 'low' | 'medium' | 'high';
 reason: string;
 contributing_features: string[];
}

export interface HistoryPoint {
 timestamp: Date;
 consumption: number;
}

export function detectHybridAnomaly(
 currentConsumption: number,
 history: HistoryPoint[],
 timestamp: Date = new Date()
): HybridAnomalyResult {
 const contributing_features: string[] = [];
 
 // Statistical parameters
 const values = history.map(h => h.consumption);
 const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : currentConsumption;
 const std = values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) : 0;
 
 const zScore = std > 0 ? Math.abs(currentConsumption - mean) / std : 0;
 if (zScore > 2.0) contributing_features.push('z_score');

 // Time of Day & Demand pattern feature
 const hour = timestamp.getHours();
 const isPeakHour = hour >= 6 && hour <= 10;
 if (isPeakHour) contributing_features.push('time_of_day_peak');

 // Historical deviation
 const sameHourPoints = history.filter(h => h.timestamp.getHours() === hour);
 const sameHourMean = sameHourPoints.length
  ? sameHourPoints.reduce((s, v) => s + v.consumption, 0) / sameHourPoints.length
  : mean;

 const deviationPct = sameHourMean > 0 ? Math.abs(currentConsumption - sameHourMean) / sameHourMean : 0;
 if (deviationPct > 0.25) contributing_features.push('demand_pattern_deviation');

 // Aggregate anomaly score mapping to 0 - 1
 let score = 0.1;
 if (zScore > 3.5) score += 0.55;
 else if (zScore > 2.0) score += 0.35;

 if (deviationPct > 0.5) score += 0.25;
 else if (deviationPct > 0.25) score += 0.15;

 if (isPeakHour && currentConsumption > mean * 1.5) score += 0.15;

 score = Math.min(Math.max(score, 0), 1);

 // Map score to user format "low", "medium", "high"
 let severity: 'low' | 'medium' | 'high' = 'low';
 if (score >= 0.7) severity = 'high';
 else if (score >= 0.4) severity = 'medium';

 let reason = "No anomaly detected.";
 if (severity === 'high') {
  reason = `High anomaly detected: consumption is ${zScore.toFixed(1)} standard deviations away from the historical mean.`;
 } else if (severity === 'medium') {
  reason = `Medium anomaly detected: minor statistical deviation in consumption compared to the typical profile.`;
 }

 return {
  anomaly_score: parseFloat(score.toFixed(2)),
  severity,
  reason,
  contributing_features,
 };
}
