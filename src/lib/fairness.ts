// ──────────────────────────────────────────────────────────────
// Fairness Engine — Gini coefficient + redistribution optimizer
// ──────────────────────────────────────────────────────────────

import { Zone, ZoneSummary } from "./synthetic-data";

export interface RedistributionProposal {
 proposal_id: string;
 source_zone: string;
 source_name: string;
 dest_zone: string;
 dest_name: string;
 volume_ML: number;
 pressure_change_bar: number;
 gini_improvement: number;
 feasibility: "safe" | "borderline" | "unsafe";
 score: number;
}

// ─── Gini Coefficient ────────────────────────────────────────

export function computeGini(fulfillments: number[]): number {
 if (fulfillments.length === 0) return 0;
 const sorted = [...fulfillments].sort((a, b) => a - b);
 const n = sorted.length;
 const totalSum = sorted.reduce((a, b) => a + b, 0);
 if (totalSum === 0) return 0;

 let weightedSum = 0;
 for (let i = 0; i < n; i++) {
 weightedSum += (2 * (i + 1) - n - 1) * sorted[i];
 }
 return Math.round((weightedSum / (n * totalSum)) * 1000) / 1000;
}

// ─── Compute Fulfillment for All Zones ───────────────────────

export function computeFulfillments(summaries: ZoneSummary[], zones: Zone[]): Map<string, number> {
 const map = new Map<string, number>();
 for (const s of summaries) {
 const zone = zones.find((z) => z.zone_id === s.zone_id);
 if (!zone) continue;
 const demand = Math.max(s.current_consumption_ML, 1);
 const fulfillment = Math.min(zone.supply_capacity_ML / demand, 1.0);
 map.set(s.zone_id, fulfillment);
 }
 return map;
}

// ─── Identify Surplus and Deficit Zones ──────────────────────

export interface ZoneBalance {
 zone_id: string;
 zone_name: string;
 fulfillment: number;
 surplus_ML: number; // Positive = surplus, negative = deficit
 category: "surplus" | "deficit" | "balanced";
}

export function classifyZones(
 summaries: ZoneSummary[],
 zones: Zone[]
): ZoneBalance[] {
 return summaries.map((s) => {
 const zone = zones.find((z) => z.zone_id === s.zone_id)!;
 const demand = s.current_consumption_ML;
 const supply = zone.supply_capacity_ML;
 const fulfillment = Math.min(supply / Math.max(demand, 1), 1.5);
 const surplus = supply - demand;

 let category: ZoneBalance["category"] = "balanced";
 if (fulfillment > 1.1) category = "surplus";
 else if (fulfillment < 0.8) category = "deficit";

 return {
 zone_id: s.zone_id,
 zone_name: s.zone_name,
 fulfillment: Math.round(fulfillment * 100) / 100,
 surplus_ML: Math.round(surplus * 100) / 100,
 category,
 };
 });
}

// ─── Pressure Simulation (Simplified Prim's MST) ────────────

function simulatePressureAfterTransfer(
 sourceZone: Zone,
 destZone: Zone,
 volume: number,
 currentPressure: number
): { newPressure: number; safe: boolean } {
 // Simplified: pressure drop proportional to transfer volume / capacity
 const pressureDrop = (volume / sourceZone.supply_capacity_ML) * 1.2;
 const newPressure = Math.max(currentPressure - pressureDrop, 0.5);
 return {
 newPressure: Math.round(newPressure * 100) / 100,
 safe: newPressure >= destZone.min_operating_pressure,
 };
}

// ─── Greedy Redistribution Optimizer ─────────────────────────

export function generateProposals(
 summaries: ZoneSummary[],
 zones: Zone[],
 fairnessWeight = 0.7
): { proposals: RedistributionProposal[]; currentGini: number; projectedGini: number } {
 const balances = classifyZones(summaries, zones);
 const fulfillments = computeFulfillments(summaries, zones);
 const currentGini = computeGini(Array.from(fulfillments.values()));

 const surplusZones = balances
 .filter((b) => b.category === "surplus")
 .sort((a, b) => b.surplus_ML - a.surplus_ML);
 const deficitZones = balances
 .filter((b) => b.category === "deficit")
 .sort((a, b) => a.surplus_ML - b.surplus_ML); // Most deficit first

 const proposals: RedistributionProposal[] = [];
 let proposalCounter = 1;

 for (const deficit of deficitZones) {
 const destZone = zones.find((z) => z.zone_id === deficit.zone_id)!;

 for (const surplus of surplusZones) {
 const sourceZone = zones.find((z) => z.zone_id === surplus.zone_id)!;

 // Check if connected (or within 2 hops)
 const isConnected =
 sourceZone.connected_zones.includes(deficit.zone_id) ||
 sourceZone.connected_zones.some((cz) => {
 const connZone = zones.find((z) => z.zone_id === cz);
 return connZone?.connected_zones.includes(deficit.zone_id);
 });
 if (!isConnected) continue;

 // Max transfer: 70% of surplus (safety margin)
 const maxTransfer = Math.abs(surplus.surplus_ML) * 0.7;
 const needed = Math.abs(deficit.surplus_ML);
 const volume = Math.min(maxTransfer, needed);

 if (volume < 10) continue; // Skip trivial transfers

 // Simulate pressure
 const sourceSummary = summaries.find((s) => s.zone_id === surplus.zone_id);
 const pressureSim = simulatePressureAfterTransfer(
 sourceZone,
 destZone,
 volume,
 sourceSummary?.pressure_bar ?? 2.5
 );

 // Compute Gini improvement
 const testFulfillments = new Map(fulfillments);
 const newSourceFulfill = Math.max(
 (testFulfillments.get(surplus.zone_id) ?? 1) - volume / sourceZone.supply_capacity_ML,
 0
 );
 const newDestFulfill = Math.min(
 (testFulfillments.get(deficit.zone_id) ?? 0) + volume / destZone.supply_capacity_ML,
 1.0
 );
 testFulfillments.set(surplus.zone_id, newSourceFulfill);
 testFulfillments.set(deficit.zone_id, newDestFulfill);
 const newGini = computeGini(Array.from(testFulfillments.values()));
 const giniImprovement = Math.max(currentGini - newGini, 0);

 // Feasibility
 let feasibility: RedistributionProposal["feasibility"] = "safe";
 if (!pressureSim.safe) feasibility = "unsafe";
 else if (pressureSim.newPressure < 1.8) feasibility = "borderline";

 // Combined score
 const pressureSafety = pressureSim.safe ? 1 : 0;
 const score =
 giniImprovement * fairnessWeight + pressureSafety * (1 - fairnessWeight);

 proposals.push({
 proposal_id: `prop-${String(proposalCounter++).padStart(3, "0")}`,
 source_zone: surplus.zone_id,
 source_name: surplus.zone_name,
 dest_zone: deficit.zone_id,
 dest_name: deficit.zone_name,
 volume_ML: Math.round(volume),
 pressure_change_bar: -(Math.round((2.5 - pressureSim.newPressure) * 100) / 100),
 gini_improvement: Math.round(giniImprovement * 1000) / 1000,
 feasibility,
 score: Math.round(score * 1000) / 1000,
 });
 }
 }

 // Sort by score descending, take top 5
 proposals.sort((a, b) => b.score - a.score);
 const topProposals = proposals.slice(0, 5);

 // Projected Gini after all top proposals
 const projectedFulfillments = new Map(fulfillments);
 for (const p of topProposals.filter((p) => p.feasibility !== "unsafe")) {
 const sourceZone = zones.find((z) => z.zone_id === p.source_zone)!;
 const destZone = zones.find((z) => z.zone_id === p.dest_zone)!;
 projectedFulfillments.set(
 p.source_zone,
 Math.max((projectedFulfillments.get(p.source_zone) ?? 1) - p.volume_ML / sourceZone.supply_capacity_ML, 0)
 );
 projectedFulfillments.set(
 p.dest_zone,
 Math.min((projectedFulfillments.get(p.dest_zone) ?? 0) + p.volume_ML / destZone.supply_capacity_ML, 1.0)
 );
 }
 const projectedGini = computeGini(Array.from(projectedFulfillments.values()));

 return {
 proposals: topProposals,
 currentGini: Math.round(currentGini * 100) / 100,
 projectedGini: Math.round(projectedGini * 100) / 100,
 };
}
