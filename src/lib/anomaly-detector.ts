export interface AnomalyContext {
  zone_id: string;
  anomaly_type: string;
  severity: string;
  reason: string;
}

export async function getLatestAnomalies(zone_ids: string[], days: number): Promise<AnomalyContext[]> {
  // Mock implementation returning empty anomalies
  return [];
}
