/**
 * API Route: /api/redistribute
 * Combines anomaly detection with redistribution optimization
 * Returns proposals ranked by fairness impact
 */

import { generateRedistributionProposals, Zone, RedistributionProposal, FairnessMetrics } from "@/lib/redistribution-engine";
import { getLatestAnomalies, AnomalyContext } from "@/lib/anomaly-detector";
import { simulatePressures } from "@/lib/network-simulator";
import { insertProposals } from "@/lib/database";
import { getZones, getSummaries } from "@/lib/data-cache";

interface RedistributeRequest {
  zone_data: Zone[];
  fairness_priority?: number; // 0.0 to 1.0, default 0.7
  include_anomaly_context?: boolean;
}

interface RedistributeResponse {
  proposals: RedistributionProposal[];
  baseline_fairness: FairnessMetrics;
  projected_fairness: FairnessMetrics;
  gini_improvement_percent: number;
  current_gini: number;
  projected_gini: number;
  deficit_count: number;
  surplus_count: number;
  anomaly_context?: AnomalyContext[];
  timestamp: string;
}

/**
 * POST /api/redistribute
 * Generate redistribution proposals with fairness analysis
 */
export async function POST(request: Request) {
  const start_time = Date.now();

  try {
    const body: RedistributeRequest = await request.json();
    const {
      zone_data,
      fairness_priority = 0.7,
      include_anomaly_context = true,
    } = body;

    // Validate input
    if (!zone_data || zone_data.length === 0) {
      return new Response(
        JSON.stringify({ error: "zone_data is required" }),
        { status: 400 }
      );
    }

    // Simulate current pressures based on network topology
    const zones_with_pressure = await simulatePressures(zone_data);

    // Generate redistribution proposals
    const {
      proposals,
      baseline_fairness,
      projected_fairness,
    } = generateRedistributionProposals(zones_with_pressure, fairness_priority);

    // Calculate fairness improvement
    const gini_improvement_percent =
      baseline_fairness.gini_coefficient > 0 ?
      ((baseline_fairness.gini_coefficient -
        projected_fairness.gini_coefficient) /
        baseline_fairness.gini_coefficient) *
      100 : 0;

    // Optional: Attach anomaly context to proposals
    let anomaly_context;
    if (include_anomaly_context) {
      const anomalies = await getLatestAnomalies(
        zone_data.map(z => z.id),
        7 // Last 7 days
      );
      anomaly_context = anomalies.map(a => ({
        zone_id: a.zone_id,
        anomaly_type: a.anomaly_type,
        severity: a.severity,
        reason: a.reason,
      }));
    }

    // Calculate deficit and surplus counts
    let deficit_count = 0;
    let surplus_count = 0;
    zone_data.forEach(z => {
      const fulfillment = z.current_supply / z.demand;
      if (fulfillment < 0.9) deficit_count++;
      else if (fulfillment > 1.1) surplus_count++;
    });

    const response: RedistributeResponse = {
      proposals,
      baseline_fairness,
      projected_fairness,
      gini_improvement_percent,
      current_gini: baseline_fairness.gini_coefficient,
      projected_gini: projected_fairness.gini_coefficient,
      deficit_count,
      surplus_count,
      anomaly_context,
      timestamp: new Date().toISOString(),
    };

    // Log the request and response for audit trail
    await logRedistributionRequest({
      zone_count: zone_data.length,
      proposal_count: proposals.length,
      baseline_gini: baseline_fairness.gini_coefficient,
      projected_gini: projected_fairness.gini_coefficient,
      response_time_ms: Date.now() - start_time,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Response-Time": `${Date.now() - start_time}ms`,
      },
    });
  } catch (error) {
    console.error("Redistribution error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate redistribution proposals",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}

/**
 * GET /api/redistribute
 * Returns last cached redistribution results (optional caching for performance)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const zone_ids = url.searchParams.getAll("zone_ids");
  const use_cache = url.searchParams.get("cache") === "true";

  try {
    if (use_cache) {
      // Try to fetch from Redis/cache
      const cached = await getRedistributionCache(zone_ids);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { "X-Cache": "HIT" },
        });
      }
    }

    // Fetch zone data from database (mocked via synthetic data)
    const zones = await fetchZoneData(zone_ids);
    
    const {
      proposals,
      baseline_fairness,
      projected_fairness,
    } = generateRedistributionProposals(zones, 0.7);

    const gini_improvement_percent =
      baseline_fairness.gini_coefficient > 0 ?
      ((baseline_fairness.gini_coefficient -
        projected_fairness.gini_coefficient) /
        baseline_fairness.gini_coefficient) *
      100 : 0;

    let deficit_count = 0;
    let surplus_count = 0;
    zones.forEach(z => {
      const fulfillment = z.current_supply / z.demand;
      if (fulfillment < 0.9) deficit_count++;
      else if (fulfillment > 1.1) surplus_count++;
    });

    const response: RedistributeResponse = {
      proposals,
      baseline_fairness,
      projected_fairness,
      gini_improvement_percent,
      current_gini: baseline_fairness.gini_coefficient,
      projected_gini: projected_fairness.gini_coefficient,
      deficit_count,
      surplus_count,
      timestamp: new Date().toISOString(),
    };

    // Store in cache if requested
    if (use_cache) {
      await setRedistributionCache(zone_ids, response, 300); // 5 min TTL
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch redistribution data" }),
      { status: 500 }
    );
  }
}

/**
 * Audit logging for redistribution requests
 */
async function logRedistributionRequest(metadata: {
  zone_count: number;
  proposal_count: number;
  baseline_gini: number;
  projected_gini: number;
  response_time_ms: number;
}) {
  try {
    await insertProposals({
      timestamp: new Date(),
      event_type: "redistribution_request",
      metadata,
    });
  } catch (e) {
    console.warn("Failed to log redistribution request", e);
  }
}

// Helper stubs (implement based on your DB/cache setup)
async function fetchZoneData(zone_ids: string[]): Promise<Zone[]> {
  const synthZones = getZones();
  const summaries = getSummaries();
  
  return synthZones.map(z => {
    const summary = summaries.find(s => s.zone_id === z.zone_id);
    return {
      id: z.zone_id,
      demand: Math.max(summary?.current_consumption_ML || 1, 1),
      current_supply: z.supply_capacity_ML,
      pressure: summary?.pressure_bar || 2.5,
      adjacent_zones: z.connected_zones,
      anomaly_type: summary?.anomaly_type || undefined,
    };
  });
}

async function getRedistributionCache(
  zone_ids: string[]
): Promise<RedistributeResponse | null> {
  // Query Redis or in-memory cache
  return null;
}

async function setRedistributionCache(
  zone_ids: string[],
  data: any,
  ttl_seconds: number
): Promise<void> {
  // Set in Redis with TTL
}
