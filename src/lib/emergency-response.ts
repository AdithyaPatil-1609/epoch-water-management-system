// ──────────────────────────────────────────────────────────────
// Emergency Response Engine
// Generates automatic failover proposals when pipe bursts occur
// ──────────────────────────────────────────────────────────────

import type { ZoneSummary } from "@/lib/synthetic-data";
import { haversineDistance } from "@/lib/network-simulator";

export interface EmergencyProposal {
  id: string;
  source_zone: string;
  source_name: string;
  dest_zone: string;
  dest_name: string;
  volume_ML: number;
  distance_km: number;
  feasibility: "immediate" | "feasible" | "stretch";
  reason: string;
}

/**
 * For each burst zone, find nearby surplus zones and generate
 * emergency transfer proposals ranked by proximity + available surplus.
 *
 * Feasibility tiers:
 *  - immediate: < 5 km AND surplus > 50 ML
 *  - feasible:  < 10 km AND surplus > 20 ML
 *  - stretch:   > 10 km (long-haul, pressure risk)
 */
export function generateEmergencyRedistribution(
  summaries: ZoneSummary[],
  burstZoneIds: string[]
): EmergencyProposal[] {
  const proposals: EmergencyProposal[] = [];
  const usedSources = new Set<string>();

  // Build a quick lookup
  const summaryMap = new Map(summaries.map(s => [s.zone_id, s]));

  for (const burstId of burstZoneIds) {
    const burst = summaryMap.get(burstId);
    if (!burst) continue;

    // Surplus zones: supply > demand by at least 20%
    const surplusZones = summaries
      .filter(s =>
        s.zone_id !== burstId &&
        !burstZoneIds.includes(s.zone_id) &&
        !usedSources.has(s.zone_id) &&
        s.supply_capacity_ML > s.current_consumption_ML * 1.2
      )
      .map(s => ({
        ...s,
        availableSurplus: (s.supply_capacity_ML - s.current_consumption_ML) * 0.6,
        distKm: haversineDistance(burst.lat, burst.lng, s.lat, s.lng),
      }))
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 4); // Max 4 sources per burst zone

    for (const source of surplusZones) {
      // Emergency transfer: up to 50% of burst zone baseline demand
      const emergencyNeed = (burst.current_consumption_ML || 100) * 0.5;
      const transferVol = Math.min(source.availableSurplus, emergencyNeed);

      if (transferVol < 5) continue;

      let feasibility: EmergencyProposal["feasibility"] = "stretch";
      if (source.distKm < 5 && source.availableSurplus > 50) feasibility = "immediate";
      else if (source.distKm < 10 && source.availableSurplus > 20) feasibility = "feasible";

      proposals.push({
        id: `emergency-${source.zone_id}-to-${burstId}`,
        source_zone: source.zone_id,
        source_name: source.zone_name,
        dest_zone: burstId,
        dest_name: burst.zone_name,
        volume_ML: Math.round(transferVol),
        distance_km: Math.round(source.distKm * 10) / 10,
        feasibility,
        reason: `Closest surplus zone (${source.distKm.toFixed(1)} km). Available: ${Math.round(source.availableSurplus)} ML.`,
      });

      usedSources.add(source.zone_id);
    }
  }

  // Sort: immediate first, then by distance
  return proposals.sort((a, b) => {
    const order = { immediate: 0, feasible: 1, stretch: 2 };
    const diff = order[a.feasibility] - order[b.feasibility];
    return diff !== 0 ? diff : a.distance_km - b.distance_km;
  });
}
