// ──────────────────────────────────────────────────────────────
// Water Redistribution Optimization Engine v2
// Combines fairness metrics, pressure constraints, BFS pathfinding,
// and greedy multi-objective proposal generation.
// Adapted from user-provided reference implementation to use
// the existing Zone / ZoneSummary types from synthetic-data.ts
// ──────────────────────────────────────────────────────────────

import type { Zone, ZoneSummary } from "./synthetic-data";

// ─── Internal Engine Zone (flat representation) ───────────────

interface EngineZone {
 id: string;
 name: string;
 demand: number; // current_consumption_ML
 current_supply: number; // supply_capacity_ML
 pressure: number; // pressure_bar
 adjacent_zones: string[]; // connected_zones
 anomaly_type?: string | null;
}

// ─── Public Types ─────────────────────────────────────────────

export interface FairnessMetrics {
 gini_coefficient: number;
 mean_fulfillment: number;
 std_dev_fulfillment: number;
 min_fulfillment: number;
 max_fulfillment: number;
}

export interface EngineProposal {
 proposal_id: string;
 source_zone: string;
 source_name: string;
 dest_zone: string;
 dest_name: string;
 volume_ML: number;
 pressure_impact: number;
 fairness_gain: number;
 feasibility: "safe" | "risky" | "infeasible";
 reason: string;
 multi_objective_score: number;
 // Kept for backwards compat with existing ProposalQueue
 gini_improvement: number;
 score: number;
}

export interface RedistributionResult {
 proposals: EngineProposal[];
 baseline_fairness: FairnessMetrics;
 projected_fairness: FairnessMetrics;
 gini_improvement_percent: number;
 current_gini: number;
 projected_gini: number;
 deficit_count: number;
 surplus_count: number;
}

// ─── Mapper: existing Zone+ZoneSummary → EngineZone ──────────

function toEngineZone(zone: Zone, summary: ZoneSummary): EngineZone {
 return {
 id: zone.zone_id,
 name: zone.zone_name,
 demand: Math.max(summary.current_consumption_ML, 1),
 current_supply: zone.supply_capacity_ML,
 pressure: summary.pressure_bar,
 adjacent_zones: zone.connected_zones,
 anomaly_type: summary.anomaly_type,
 };
}

// ─── Step 1: Fairness Metrics ─────────────────────────────────

export function computeFairnessMetrics(zones: EngineZone[]): FairnessMetrics {
 const fulfillments = zones.map(z => Math.min(z.current_supply / z.demand, 1.5));
 const sortedFulfillments = [...fulfillments].sort((a, b) => a - b);
 const n = sortedFulfillments.length;
 const mean = fulfillments.reduce((a, b) => a + b, 0) / n;

 let gini_sum = 0;
 for (let i = 0; i < n; i++) {
 gini_sum += (2 * (i + 1) - n - 1) * sortedFulfillments[i];
 }
 const gini = mean > 0 ? Math.abs(gini_sum / (n * n * mean)) : 0;

 const variance = fulfillments.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / n;

 return {
 gini_coefficient: Math.round(gini * 1000) / 1000,
 mean_fulfillment: Math.round(mean * 1000) / 1000,
 std_dev_fulfillment: Math.round(Math.sqrt(variance) * 1000) / 1000,
 min_fulfillment: Math.round(Math.min(...fulfillments) * 1000) / 1000,
 max_fulfillment: Math.round(Math.min(Math.max(...fulfillments), 1.5) * 1000) / 1000,
 };
}

// ─── Step 2: Classify Zones ───────────────────────────────────

function classifyEngineZones(zones: EngineZone[]): { deficit: EngineZone[]; surplus: EngineZone[] } {
 const deficit: EngineZone[] = [];
 const surplus: EngineZone[] = [];

 for (const zone of zones) {
 const ratio = zone.current_supply / zone.demand;
 if (ratio < 0.9) deficit.push(zone);
 else if (ratio > 1.1) surplus.push(zone);
 }

 // Sort deficit by most undersupplied first; surplus by most oversupplied first
 deficit.sort((a, b) => (a.current_supply / a.demand) - (b.current_supply / b.demand));
 surplus.sort((a, b) => (b.current_supply / b.demand) - (a.current_supply / a.demand));

 return { deficit, surplus };
}

// ─── Step 3: BFS Network Distance ────────────────────────────

function findNetworkDistance(
 sourceId: string,
 destId: string,
 zonesMap: Map<string, EngineZone>
): number {
 if (sourceId === destId) return 0;
 const visited = new Set<string>();
 const queue: [string, number][] = [[sourceId, 0]];

 while (queue.length > 0) {
 const [currentId, distance] = queue.shift()!;
 if (currentId === destId) return distance;
 if (visited.has(currentId)) continue;

 visited.add(currentId);
 const current = zonesMap.get(currentId);
 if (!current) continue;

 for (const neighborId of current.adjacent_zones) {
 if (!visited.has(neighborId)) {
 queue.push([neighborId, distance + 1]);
 }
 }
 }
 return Infinity;
}

// ─── Step 4: Pressure Impact Simulation ──────────────────────

function simulatePressureImpact(
 source: EngineZone,
 volume: number,
 networkDistance: number
): number {
 const baseLoss = (volume / source.current_supply) * 0.1;
 const distanceFactor = networkDistance * 0.05;
 return -(baseLoss + distanceFactor);
}

// ─── Step 5: Generate Candidate Transfers ────────────────────

function generateCandidates(
 deficitZone: EngineZone,
 surplusZones: EngineZone[],
 zonesMap: Map<string, EngineZone>
): EngineProposal[] {
 const candidates: EngineProposal[] = [];

 for (const surplus of surplusZones) {
 const networkDistance = findNetworkDistance(surplus.id, deficitZone.id, zonesMap);
 if (networkDistance === Infinity || networkDistance > 4) continue; // Max 4 hops

 const availableSurplus = surplus.current_supply - 1.1 * surplus.demand;
 const neededDeficit = 0.9 * deficitZone.demand - deficitZone.current_supply;

 if (availableSurplus <= 0 || neededDeficit <= 0) continue;

 const maxTransfer = Math.min(availableSurplus, neededDeficit);

 // Three candidate volumes: 25%, 50%, 75% of max transfer
 for (const fraction of [0.25, 0.5, 0.75]) {
 const volume = maxTransfer * fraction;
 if (volume < 5) continue; // Skip trivial transfers

 const pressureImpact = simulatePressureImpact(surplus, volume, networkDistance);
 const destPressureAfter = deficitZone.pressure + pressureImpact;

 const newDeficitFulfill = (deficitZone.current_supply + volume) / deficitZone.demand;
 const oldGap = Math.abs(1 - deficitZone.current_supply / deficitZone.demand);
 const newGap = Math.abs(1 - newDeficitFulfill);
 const fairnessGain = Math.max(oldGap - newGap, 0);

 const isSafe = destPressureAfter >= 1.5;
 const isRisky = destPressureAfter >= 1.2 && destPressureAfter < 1.5;
 const feasibility: EngineProposal["feasibility"] = isSafe ? "safe" : isRisky ? "risky" : "infeasible";

 candidates.push({
 proposal_id: `${surplus.id}->${deficitZone.id}-${Math.round(volume)}`,
 source_zone: surplus.id,
 source_name: surplus.name,
 dest_zone: deficitZone.id,
 dest_name: deficitZone.name,
 volume_ML: Math.round(volume),
 pressure_impact: Math.round(pressureImpact * 100) / 100,
 fairness_gain: Math.round(fairnessGain * 1000) / 1000,
 feasibility,
 reason: `Transfer ${Math.round(volume)} ML/d from ${surplus.name} (${Math.round(surplus.current_supply / surplus.demand * 100)}% supplied) to ${deficitZone.name} (${Math.round(deficitZone.current_supply / deficitZone.demand * 100)}% supplied). Network distance: ${networkDistance} hop${networkDistance !== 1 ? "s" : ""}.`,
 multi_objective_score: 0, // Filled in rankProposals
 gini_improvement: fairnessGain,
 score: 0,
 });
 }
 }

 return candidates;
}

// ─── Step 6: Multi-Objective Ranking ─────────────────────────

function rankProposals(proposals: EngineProposal[], fairnessPriority: number): EngineProposal[] {
 const maxFairnessGain = Math.max(...proposals.map(p => p.fairness_gain), 0.001);
 const minPressureImpact = Math.min(...proposals.map(p => p.pressure_impact), -0.1);

 for (const p of proposals) {
 const fairnessScore = p.fairness_gain / maxFairnessGain;
 const pressurePenalty = Math.max(0, -p.pressure_impact / -minPressureImpact);
 const baseScore = fairnessPriority * fairnessScore + (1 - fairnessPriority) * (1 - pressurePenalty);
 const feasibilityMult = p.feasibility === "safe" ? 1.0 : p.feasibility === "risky" ? 0.6 : 0.0;
 p.multi_objective_score = Math.round(baseScore * feasibilityMult * 1000) / 1000;
 p.score = p.multi_objective_score; // alias
 }

 return proposals.sort((a, b) => b.multi_objective_score - a.multi_objective_score);
}

// ─── Step 7: Greedy Non-Conflicting Selection ─────────────────

function selectNonConflicting(ranked: EngineProposal[], maxProposals = 5): EngineProposal[] {
 const selected: EngineProposal[] = [];
 const usedZones = new Set<string>();

 for (const p of ranked) {
 if (usedZones.has(p.source_zone) || usedZones.has(p.dest_zone)) continue;
 selected.push(p);
 usedZones.add(p.source_zone);
 usedZones.add(p.dest_zone);
 if (selected.length >= maxProposals) break;
 }

 return selected;
}

// ─── Main Orchestrator ────────────────────────────────────────

export function generateRedistributionProposals(
 summaries: ZoneSummary[],
 zones: Zone[],
 fairnessPriority = 0.7
): RedistributionResult {
 // Map to engine format
 const engineZones: EngineZone[] = zones
 .map(zone => {
 const summary = summaries.find(s => s.zone_id === zone.zone_id);
 if (!summary) return null;
 return toEngineZone(zone, summary);
 })
 .filter((z): z is EngineZone => z !== null);

 const zonesMap = new Map(engineZones.map(z => [z.id, z]));

 // Baseline fairness
 const baselineFairness = computeFairnessMetrics(engineZones);

 // Classify zones
 const { deficit, surplus } = classifyEngineZones(engineZones);

 // Generate all candidates
 const allCandidates: EngineProposal[] = [];
 for (const deficitZone of deficit) {
 allCandidates.push(...generateCandidates(deficitZone, surplus, zonesMap));
 }

 if (allCandidates.length === 0) {
 return {
 proposals: [],
 baseline_fairness: baselineFairness,
 projected_fairness: baselineFairness,
 gini_improvement_percent: 0,
 current_gini: baselineFairness.gini_coefficient,
 projected_gini: baselineFairness.gini_coefficient,
 deficit_count: deficit.length,
 surplus_count: surplus.length,
 };
 }

 // Rank and select
 const ranked = rankProposals(allCandidates, fairnessPriority);
 const selected = selectNonConflicting(ranked, 5);

 // Projected fairness after selected transfers
 const zonesAfter = engineZones.map(z => {
 let supply = z.current_supply;
 for (const p of selected) {
 if (p.source_zone === z.id) supply -= p.volume_ML;
 if (p.dest_zone === z.id) supply += p.volume_ML;
 }
 return { ...z, current_supply: Math.max(supply, 0) };
 });
 const projectedFairness = computeFairnessMetrics(zonesAfter);

 const giniImprovementPct =
 baselineFairness.gini_coefficient > 0
 ? Math.round(
 ((baselineFairness.gini_coefficient - projectedFairness.gini_coefficient) /
 baselineFairness.gini_coefficient) *
 100
 )
 : 0;

 return {
 proposals: selected,
 baseline_fairness: baselineFairness,
 projected_fairness: projectedFairness,
 gini_improvement_percent: giniImprovementPct,
 current_gini: baselineFairness.gini_coefficient,
 projected_gini: projectedFairness.gini_coefficient,
 deficit_count: deficit.length,
 surplus_count: surplus.length,
 };
}
