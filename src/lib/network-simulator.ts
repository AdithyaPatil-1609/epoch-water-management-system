// ──────────────────────────────────────────────────────────────
// Network Pressure Simulator
// Physical model: ΔP ≈ 0.1 bar/km (simplified Darcy-Weisbach)
// Source pump pressure: 3.5 bar
// Minimum operating pressure: 1.5 bar
// ──────────────────────────────────────────────────────────────

import type { Zone } from "@/lib/synthetic-data";
import type { EngineProposal } from "@/lib/redistribution-engine";

// ─── Haversine Distance ───────────────────────────────────────

/**
 * Haversine great-circle distance between two lat/lng points (km).
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Core Pressure Engine ─────────────────────────────────────

/**
 * Compute realistic pressure at every zone using a simplified
 * Darcy-Weisbach hydraulic model:
 *
 *   P(zone) = SOURCE_PRESSURE - distance_km * DROP_PER_KM - flow_factor
 *
 * The first zone in the array is treated as the primary pump source.
 * Active redistribution proposals shift flow and therefore shift pressure.
 */
export function calculateNetworkPressures(
  zones: Zone[],
  proposals: Pick<EngineProposal, "source_zone" | "dest_zone" | "volume_ML">[] = []
): Map<string, number> {
  const SOURCE_PRESSURE_BAR = 3.5;
  const DROP_PER_KM = 0.08;          // bar / km
  const FLOW_DROP_FACTOR = 0.002;    // bar / ML transferred

  const pressures = new Map<string, number>();
  if (zones.length === 0) return pressures;

  // Primary pump source: zone with highest supply capacity
  const sourceZone = [...zones].sort(
    (a, b) => b.supply_capacity_ML - a.supply_capacity_ML
  )[0];

  // Build a net-flow adjustment map from active proposals
  const netFlow = new Map<string, number>(); // positive = gaining ML
  for (const p of proposals) {
    netFlow.set(p.source_zone, (netFlow.get(p.source_zone) ?? 0) - p.volume_ML);
    netFlow.set(p.dest_zone, (netFlow.get(p.dest_zone) ?? 0) + p.volume_ML);
  }

  for (const zone of zones) {
    const distKm = haversineDistance(
      sourceZone.lat, sourceZone.lng,
      zone.lat, zone.lng
    );

    // Pressure drop due to pipe distance
    const distanceDrop = distKm * DROP_PER_KM;

    // Pressure adjustment due to extra flow (transfers add/remove demand)
    const flowDelta = netFlow.get(zone.zone_id) ?? 0;
    const flowDrop = Math.abs(flowDelta) * FLOW_DROP_FACTOR * (flowDelta < 0 ? 1 : -0.5);

    const finalPressure = Math.max(
      0.3, // physical minimum
      SOURCE_PRESSURE_BAR - distanceDrop + flowDrop
    );

    pressures.set(zone.zone_id, Math.round(finalPressure * 100) / 100);
  }

  return pressures;
}

/**
 * Check whether a single proposal violates the minimum pressure constraint
 * at the source zone after the transfer is applied.
 */
export function checkPressureConstraint(
  zones: Zone[],
  proposal: Pick<EngineProposal, "source_zone" | "dest_zone" | "volume_ML">,
  minPressureBar = 1.5
): { feasible: boolean; pressure_after: number } {
  const pressures = calculateNetworkPressures(zones, [proposal]);
  const pressure_after = pressures.get(proposal.source_zone) ?? 2.0;
  return {
    feasible: pressure_after >= minPressureBar,
    pressure_after,
  };
}

/**
 * Backward-compatible stub (previously used as async).
 * Returns zone_data unchanged — pressure now flows through
 * calculateNetworkPressures / ZoneSummary.pressure_bar.
 */
export async function simulatePressures(zone_data: unknown[]): Promise<unknown[]> {
  return zone_data;
}
