/**
 * Water Redistribution Optimization Engine
 * Combines fairness metrics, pressure constraints, and greedy heuristics
 */

export interface Zone {
  id: string;
  demand: number;
  current_supply: number;
  pressure: number;
  adjacent_zones: string[];
  anomaly_type?: string;
}

export interface RedistributionProposal {
  id: string;
  source_zone: string;
  dest_zone: string;
  volume: number;
  pressure_impact: number;
  fairness_gain: number;
  feasibility: "safe" | "risky" | "infeasible";
  reason: string;
  multi_objective_score: number;
}

export interface FairnessMetrics {
  gini_coefficient: number;
  mean_fulfillment: number;
  std_dev_fulfillment: number;
  min_fulfillment: number;
  max_fulfillment: number;
}

/**
 * Step 1: Compute demand fulfillment and fairness baseline
 */
export function computeFairnessMetrics(zones: Zone[]): FairnessMetrics {
  const fulfillments = zones.map(z => z.current_supply / z.demand);

  // Gini coefficient: measure of inequality (0 = perfect equality, 1 = perfect inequality)
  const sortedFulfillments = [...fulfillments].sort((a, b) => a - b);
  const n = sortedFulfillments.length;
  const mean = fulfillments.reduce((a, b) => a + b, 0) / n;

  let gini_sum = 0;
  for (let i = 0; i < n; i++) {
    gini_sum += (2 * (i + 1) - n - 1) * sortedFulfillments[i];
  }
  const gini = mean > 0 ? gini_sum / (n * n * mean) : 0;

  // Additional fairness metrics
  const mean_fulfillment = mean;
  const variance =
    fulfillments.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / n;
  const std_dev_fulfillment = Math.sqrt(variance);

  return {
    gini_coefficient: gini,
    mean_fulfillment,
    std_dev_fulfillment,
    min_fulfillment: Math.min(...fulfillments),
    max_fulfillment: Math.max(...fulfillments),
  };
}

/**
 * Step 2: Identify deficit and surplus zones
 */
function classifyZones(zones: Zone[]): {
  deficit: Zone[];
  surplus: Zone[];
} {
  const deficit: Zone[] = [];
  const surplus: Zone[] = [];

  for (const zone of zones) {
    const fulfillment_ratio = zone.current_supply / zone.demand;

    // Zones with <90% fulfillment are in deficit; >110% are surplus
    if (fulfillment_ratio < 0.9) {
      deficit.push(zone);
    } else if (fulfillment_ratio > 1.1) {
      surplus.push(zone);
    }
  }

  return { deficit, surplus };
}

/**
 * Step 3: Simulate pressure impact of a transfer
 * Uses simplified hydraulic model: pressure drops ~0.01 bar per 100m of pipe
 * For demo, we use network distance as proxy via adjacency depth
 */
function simulatePressureImpact(
  source: Zone,
  dest: Zone,
  volume: number,
  zones_map: Map<string, Zone>,
  network_distance: number
): number {
  // Simplified: pressure loss scales with volume and distance
  const base_loss = (volume / source.current_supply) * 0.1; // 10% loss per unit transferred
  const distance_factor = network_distance * 0.05; // Distance multiplier
  return -(base_loss + distance_factor);
}

/**
 * Step 4: Find shortest network path between zones (BFS)
 */
function findNetworkDistance(
  source_id: string,
  dest_id: string,
  zones_map: Map<string, Zone>
): number {
  const source = zones_map.get(source_id);
  if (!source) return Infinity;

  const visited = new Set<string>();
  const queue: [string, number][] = [[source_id, 0]];

  while (queue.length > 0) {
    const [current_id, distance] = queue.shift()!;

    if (current_id === dest_id) return distance;
    if (visited.has(current_id)) continue;

    visited.add(current_id);
    const current = zones_map.get(current_id);
    if (!current) continue;

    for (const neighbor_id of current.adjacent_zones) {
      if (!visited.has(neighbor_id)) {
        queue.push([neighbor_id, distance + 1]);
      }
    }
  }

  return Infinity; // Not connected
}

/**
 * Step 5: Generate candidate transfers from each deficit zone
 */
function generateCandidateTransfers(
  deficit_zone: Zone,
  surplus_zones: Zone[],
  zones_map: Map<string, Zone>,
  baseline_gini: number
): RedistributionProposal[] {
  const candidates: RedistributionProposal[] = [];

  // For each surplus zone, calculate how much can be transferred
  for (const surplus of surplus_zones) {
    const network_distance = findNetworkDistance(
      surplus.id,
      deficit_zone.id,
      zones_map
    );

    // Skip if not connected
    if (network_distance === Infinity) continue;

    // Calculate transferable volume: min of available surplus and needed deficit
    const available_surplus =
      surplus.current_supply - 1.1 * surplus.demand; // Keep 10% buffer
    const needed_deficit = 0.9 * deficit_zone.demand - deficit_zone.current_supply;

    if (available_surplus <= 0) continue;

    const max_transfer = Math.min(available_surplus, needed_deficit);

    // Generate proposals at different transfer volumes
    const volumes = [
      max_transfer * 0.25,
      max_transfer * 0.5,
      max_transfer * 0.75,
    ];

    for (const volume of volumes) {
      if (volume < 0.01) continue; // Skip trivial transfers

      // Calculate pressure impact
      const pressure_impact = simulatePressureImpact(
        surplus,
        deficit_zone,
        volume,
        zones_map,
        network_distance
      );

      // Estimate fairness gain
      const new_deficit_fulfillment =
        (deficit_zone.current_supply + volume) / deficit_zone.demand;
      const new_surplus_fulfillment =
        (surplus.current_supply - volume) / surplus.demand;

      // Simple fairness gain: reduction in fulfillment gap
      const old_gap = Math.abs(1 - deficit_zone.current_supply / deficit_zone.demand);
      const new_gap = Math.abs(1 - new_deficit_fulfillment);
      const fairness_gain = old_gap - new_gap;

      // Feasibility check
      const dest_pressure = deficit_zone.pressure + pressure_impact;
      const is_feasible = dest_pressure >= 1.5; // Minimum pressure requirement
      const feasibility = is_feasible ? "safe" : "risky";

      const proposal: RedistributionProposal = {
        id: `${surplus.id}->${deficit_zone.id}-${volume.toFixed(2)}`,
        source_zone: surplus.id,
        dest_zone: deficit_zone.id,
        volume,
        pressure_impact,
        fairness_gain,
        feasibility,
        reason: `Transfer ${volume.toFixed(2)} units from ${surplus.id} (surplus) to ${deficit_zone.id} (deficit). Pressure change: ${pressure_impact.toFixed(2)} bar.`,
        multi_objective_score: 0, // Will be calculated after all proposals
      };

      candidates.push(proposal);
    }
  }

  return candidates;
}

/**
 * Step 6: Score and rank proposals using multi-objective criteria
 * Higher weight on fairness gain; penalty for pressure loss
 */
function rankProposals(
  proposals: RedistributionProposal[],
  fairness_priority: number = 0.7 // 70% weight on fairness, 30% on pressure
): RedistributionProposal[] {
  const max_fairness_gain = Math.max(
    ...proposals.map(p => p.fairness_gain),
    0.001
  );
  const min_pressure_impact = Math.min(
    ...proposals.map(p => p.pressure_impact),
    -0.1
  );

  // Normalize scores to [0, 1]
  for (const proposal of proposals) {
    const fairness_score = proposal.fairness_gain / max_fairness_gain;
    const pressure_penalty = Math.max(
      0,
      -proposal.pressure_impact / -min_pressure_impact
    );

    // Multi-objective: weighted combination
    const base_score =
      fairness_priority * fairness_score +
      (1 - fairness_priority) * (1 - pressure_penalty);

    // Penalize risky/infeasible proposals
    const feasibility_multiplier =
      proposal.feasibility === "safe"
        ? 1.0
        : proposal.feasibility === "risky"
          ? 0.6
          : 0.0;

    proposal.multi_objective_score = base_score * feasibility_multiplier;
  }

  // Sort by score (descending)
  return proposals.sort(
    (a, b) => b.multi_objective_score - a.multi_objective_score
  );
}

/**
 * Step 7: Select non-conflicting proposals (greedy selection)
 * Once a zone transfers/receives, don't include it in further transfers
 */
function selectNonConflictingProposals(
  ranked: RedistributionProposal[],
  max_proposals: number = 5
): RedistributionProposal[] {
  const selected: RedistributionProposal[] = [];
  const used_zones = new Set<string>();

  for (const proposal of ranked) {
    // Skip if source or destination already involved
    if (used_zones.has(proposal.source_zone) || used_zones.has(proposal.dest_zone)) {
      continue;
    }

    selected.push(proposal);
    used_zones.add(proposal.source_zone);
    used_zones.add(proposal.dest_zone);

    if (selected.length >= max_proposals) break;
  }

  return selected;
}

/**
 * Main orchestration: Generate, rank, and select redistribution proposals
 */
export function generateRedistributionProposals(
  zones: Zone[],
  fairness_priority: number = 0.7
): {
  proposals: RedistributionProposal[];
  baseline_fairness: FairnessMetrics;
  projected_fairness: FairnessMetrics;
} {
  const zones_map = new Map(zones.map(z => [z.id, z]));

  // Step 1: Measure baseline fairness
  const baseline_fairness = computeFairnessMetrics(zones);

  // Step 2: Classify zones
  const { deficit, surplus } = classifyZones(zones);

  // Step 3: Generate candidates
  const all_candidates: RedistributionProposal[] = [];
  for (const deficit_zone of deficit) {
    const candidates = generateCandidateTransfers(
      deficit_zone,
      surplus,
      zones_map,
      baseline_fairness.gini_coefficient
    );
    all_candidates.push(...candidates);
  }

  // Step 4: Rank all candidates
  const ranked = rankProposals(all_candidates, fairness_priority);

  // Step 5: Select non-conflicting proposals
  const selected = selectNonConflictingProposals(ranked, 5);

  // Step 6: Simulate projected fairness after selected proposals
  const zones_after = zones.map(z => {
    let supply = z.current_supply;
    for (const proposal of selected) {
      if (proposal.source_zone === z.id) {
        supply -= proposal.volume;
      }
      if (proposal.dest_zone === z.id) {
        supply += proposal.volume;
      }
    }
    return { ...z, current_supply: supply };
  });
  const projected_fairness = computeFairnessMetrics(zones_after);

  return {
    proposals: selected,
    baseline_fairness,
    projected_fairness,
  };
}
