// ──────────────────────────────────────────────────────────────
// ML Proposal Ranker
// Scores redistribution proposals using a weighted multi-objective
// function (no external ML library needed):
//
//   Score = 0.40 × fairness_impact
//         + 0.30 × pressure_safety
//         + 0.20 × distance_efficiency
//         + 0.10 × source_zone_health
//
// Returns proposals sorted best → worst with score breakdown.
// ──────────────────────────────────────────────────────────────

import { getUrbanWaterZones } from "@/lib/water-zone-data";
import { calculateWaterAvailability } from "@/lib/water-availability";

export interface RankedProposal {
  // Original proposal fields
  proposal_id: string;
  source_zone: string;
  dest_zone: string;
  volume_ML: number;
  reason: string;
  pressure_after_bar: number;
  priority: string;

  // Scoring
  composite_score: number; // 0–100
  score_breakdown: {
    fairness_impact: number;     // 0–100
    pressure_safety: number;     // 0–100
    distance_efficiency: number; // 0–100
    source_health: number;       // 0–100
  };
  rank: number;
  recommendation: "HIGHLY_RECOMMENDED" | "RECOMMENDED" | "FEASIBLE" | "CAUTION";
}

interface BaseProposal {
  proposal_id?: string;
  source_zone: string;
  dest_zone: string;
  volume_ML: number;
  reason?: string;
  pressure_after_bar?: number;
  pressure_safe?: boolean;
  priority?: string;
  gini_improvement_percent?: number;
  distance_km?: number;
}

// ─── Scoring functions ────────────────────────────────────────

function scoreFairness(proposal: BaseProposal): number {
  // Higher gini improvement = better fairness score
  const gini_pct = proposal.gini_improvement_percent ?? 0;
  return Math.min(100, gini_pct * 8); // 12.5% improvement → 100 score
}

function scorePressure(proposal: BaseProposal): number {
  const p = proposal.pressure_after_bar ?? 2.0;
  if (p >= 3.0) return 100;
  if (p >= 2.5) return 90;
  if (p >= 2.0) return 75;
  if (p >= 1.5) return 45;
  return 0; // Below minimum safe
}

function scoreDistance(proposal: BaseProposal): number {
  const km = proposal.distance_km ?? 5;
  // Shorter distance = more efficient = higher score
  if (km <= 2) return 100;
  if (km <= 5) return 85;
  if (km <= 10) return 65;
  if (km <= 20) return 40;
  return 20;
}

function scoreSourceHealth(
  source_zone: string,
  volume_ML: number
): number {
  const zones = getUrbanWaterZones();
  const zone = zones.find((z) => z.zone_id === source_zone);
  if (!zone) return 50;

  const avail = calculateWaterAvailability(zone);
  const surplus = avail.total_available_ML - zone.demand_supply.total_demand_ML_day;

  // If surplus is large relative to transfer volume, source health is good
  if (surplus <= 0) return 0;
  const ratio = surplus / volume_ML;
  if (ratio >= 3) return 100;
  if (ratio >= 2) return 80;
  if (ratio >= 1.2) return 60;
  return 30;
}

// ─── Main Ranker ──────────────────────────────────────────────

export function rankProposals(proposals: BaseProposal[]): RankedProposal[] {
  const scored = proposals.map((p, idx) => {
    const fairness_impact = scoreFairness(p);
    const pressure_safety = scorePressure(p);
    const distance_efficiency = scoreDistance(p);
    const source_health = scoreSourceHealth(p.source_zone, p.volume_ML);

    const composite_score = Math.round(
      0.40 * fairness_impact +
      0.30 * pressure_safety +
      0.20 * distance_efficiency +
      0.10 * source_health
    );

    const recommendation: RankedProposal["recommendation"] =
      composite_score >= 75 ? "HIGHLY_RECOMMENDED"
      : composite_score >= 55 ? "RECOMMENDED"
      : composite_score >= 35 ? "FEASIBLE"
      : "CAUTION";

    return {
      proposal_id: p.proposal_id ?? `proposal-${idx}`,
      source_zone: p.source_zone,
      dest_zone: p.dest_zone,
      volume_ML: p.volume_ML,
      reason: p.reason ?? "",
      pressure_after_bar: p.pressure_after_bar ?? 2.0,
      priority: p.priority ?? "medium",
      composite_score,
      score_breakdown: {
        fairness_impact: Math.round(fairness_impact),
        pressure_safety: Math.round(pressure_safety),
        distance_efficiency: Math.round(distance_efficiency),
        source_health: Math.round(source_health),
      },
      rank: 0, // filled below
      recommendation,
    };
  });

  // Sort best → worst and assign ranks
  scored.sort((a, b) => b.composite_score - a.composite_score);
  scored.forEach((p, i) => { p.rank = i + 1; });

  return scored;
}
