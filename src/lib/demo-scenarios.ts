// ──────────────────────────────────────────────────────────────
// Demo Scenarios — Pre-set crisis data for compelling demos
// Scenario 1: Leak + Equity Crisis  (Zone-D leak, Zone-G deficit)
// Scenario 2: Multi-zone outage     (Zone-P, Zone-Q pipe burst)
// ──────────────────────────────────────────────────────────────

import type { ZoneSummary, Zone } from "@/lib/synthetic-data";
import { computeGini } from "@/lib/fairness";

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  story: string;
  summaryOverrides: Partial<ZoneSummary>[];  // keyed by zone_id
  zoneOverrides: Partial<Zone>[];            // supply_capacity_ML patches
  baseline_gini: number;
  expected_gini_after: number;
}

// ─── Scenario 1: Leak + Equity Crisis ────────────────────────

/**
 * Zone-D has a progressive leak consuming 3× normal water.
 * Zone-G (Majestic Underground) is structurally under-served.
 * Zone-R (Yelahanka Surplus Belt) is heavily over-supplied.
 *
 * Story arc:
 *  Act 1 → Anomaly detection flags Zone-D (score 0.89)
 *  Act 2 → Fairness shows Zone-G at 54% fulfillment
 *  Act 3 → Engine proposes: Zone-R → Zone-G, 40 ML/day
 *  Act 4 → After approval, Gini drops ~11%
 *  Act 5 → Export XLSX for city council
 */
export function createLeakAndEquityScenario(): DemoScenario {
  // Override fulfillment values we'll use for Gini calculation
  const fulfillmentsBefore = [
    1.0,   // Zone-A normal
    1.07,  // Zone-B normal
    0.73,  // Zone-C slightly deficit
    0.45,  // Zone-D – leak eating supply (heavily deficit)
    1.08,  // Zone-E normal
    1.10,  // Zone-F normal
    0.54,  // Zone-G – structural deficit (demo hero)
    1.09,  // Zone-H normal
    1.11,  // Zone-I slightly surplus
    1.13,  // Zone-J slightly surplus
    1.10,  // Zone-K normal
    1.05,  // Zone-L normal
    1.08,  // Zone-M normal
    1.06,  // Zone-N normal
    1.02,  // Zone-O normal
    0.80,  // Zone-P slightly deficit
    0.82,  // Zone-Q slightly deficit
    1.60,  // Zone-R – massive surplus (redistribution source)
    1.09,  // Zone-S normal
    1.07,  // Zone-T normal
  ];

  // After: Zone-G gets +40 ML (supply goes from ~95→135), Zone-R gives 40 ML away
  const fulfillmentsAfter = fulfillmentsBefore.map((f, i) => {
    if (i === 6) return Math.min(f + 0.40, 1.0); // Zone-G: 0.54 → 0.94
    if (i === 17) return f - 0.10;                // Zone-R: 1.60 → 1.50 (still surplus)
    if (i === 3) return Math.min(f + 0.08, 1.0);  // Zone-D partial improvement
    return f;
  });

  const baseline_gini = computeGini(fulfillmentsBefore);
  const expected_gini_after = computeGini(fulfillmentsAfter);
  const giniBefore = (baseline_gini * 100).toFixed(1);
  const giniAfter = (expected_gini_after * 100).toFixed(1);
  const giniGain = ((baseline_gini - expected_gini_after) / baseline_gini * 100).toFixed(0);

  return {
    id: "leak-equity",
    name: "Leak & Equity Crisis",
    description: "Zone-D has a 3× consumption leak. Zone-G is under-served at 54%. Zone-R has massive surplus.",
    story: `SCENARIO: Leak & Equity Crisis

Zone-D (Westbrook District): A progressive pipe leak has ramped consumption to 3× the daily baseline over 6 days. Pressure has dropped to 1.3 bar.
Zone-G (Majestic Underground): Structural under-supply — only 54% of residents receive water due to network capacity limits.
Zone-R (Yelahanka Surplus Belt): Over-built infrastructure means 160% supply — water wasted in the network.

DEMO WALKTHROUGH:
① Anomaly Detection flags Zone-D (score 0.89, "Probable Leak")
② Fairness panel shows Zone-G at 54% fulfillment — city Gini: ${giniBefore}%
③ Optimization engine proposes: Zone-R → Zone-G, 40 ML/day (pressure safe: 2.1 bar)
④ Manager approves → Zone-G rises to 94%, Gini drops to ${giniAfter}% (${giniGain}% equity improvement)
⑤ Export XLSX → 5-sheet audit report downloaded for city council`,

    summaryOverrides: [
      {
        zone_id: "Zone-D",
        current_consumption_ML: 540,  // 3× baseline 180
        anomaly_score: 0.89,
        severity: "Probable" as const,
        anomaly_type: "leak",
        reason: "Consumption 3.0× normal over 6 days — probable pipe leak. Pressure dropping steadily.",
        factors: ["Slow Ramp", "Elevated Baseline", "Pressure Drop"],
        pressure_bar: 1.3,
        fulfillment_pct: 26,  // 140 supply / 540 demand
      },
      {
        zone_id: "Zone-G",
        supply_capacity_ML: 79,    // under-served
        current_consumption_ML: 147, // baseline 150
        anomaly_score: 0.0,
        severity: "Normal" as const,
        anomaly_type: null,
        reason: "Supply below demand due to network capacity constraints. 54% fulfillment.",
        factors: [],
        pressure_bar: 1.6,
        fulfillment_pct: 54,
      },
      {
        zone_id: "Zone-R",
        supply_capacity_ML: 464,   // way above baseline
        current_consumption_ML: 292, // baseline 290
        anomaly_score: 0.05,
        severity: "Normal" as const,
        anomaly_type: null,
        reason: "Over-supplied zone. 159% fulfillment — surplus available for redistribution.",
        factors: [],
        pressure_bar: 3.1,
        fulfillment_pct: 159,
      },
    ],

    zoneOverrides: [
      { zone_id: "Zone-G", supply_capacity_ML: 79 },
      { zone_id: "Zone-D", supply_capacity_ML: 140 },
      { zone_id: "Zone-R", supply_capacity_ML: 464 },
    ],

    baseline_gini,
    expected_gini_after,
  };
}

// ─── Scenario 2: Multi-Zone Pipe Burst ───────────────────────

export function createPipeBurstScenario(): DemoScenario {
  const fulfillmentsBefore = Array(20).fill(1.0);
  // Zone-P and Zone-Q both go critical
  fulfillmentsBefore[15] = 0.30; // Zone-P
  fulfillmentsBefore[16] = 0.25; // Zone-Q

  const baseline_gini = computeGini(fulfillmentsBefore);
  const fulfillmentsAfter = [...fulfillmentsBefore];
  fulfillmentsAfter[15] = 0.65;
  fulfillmentsAfter[16] = 0.60;
  const expected_gini_after = computeGini(fulfillmentsAfter);

  return {
    id: "pipe-burst",
    name: "Emergency: Multi-Zone Pipe Burst",
    description: "Simultaneous pipe rupture at Zone-P and Zone-Q. Emergency rerouting activated.",
    story: `EMERGENCY SCENARIO: Multi-Zone Pipe Burst

Zone-P (Peenya Industrial North) and Zone-Q (Peenya Industrial South) have both suffered a simultaneous pipe rupture. Supply has dropped 70%. Thousands of residents are without water.

Emergency engine automatically routes from Zone-K (Yeshwanthpur) and Zone-R (Yelahanka) to restore partial supply.`,

    summaryOverrides: [
      {
        zone_id: "Zone-P",
        current_consumption_ML: 400,
        anomaly_score: 0.95,
        severity: "Critical" as const,
        anomaly_type: "pipe_rupture",
        reason: "Sudden supply collapse (-70%). Simultaneous multi-zone drop — pipe rupture confirmed.",
        factors: ["Multi-Zone", "Sudden Drop", "Pressure Loss"],
        pressure_bar: 0.9,
        fulfillment_pct: 30,
      },
      {
        zone_id: "Zone-Q",
        current_consumption_ML: 380,
        anomaly_score: 0.93,
        severity: "Critical" as const,
        anomaly_type: "pipe_rupture",
        reason: "Simultaneous failure with Zone-P. Pressure at 0.8 bar — below safe minimum.",
        factors: ["Multi-Zone", "Sudden Drop", "Pressure Loss"],
        pressure_bar: 0.8,
        fulfillment_pct: 25,
      },
    ],

    zoneOverrides: [
      { zone_id: "Zone-P", supply_capacity_ML: 120 },
      { zone_id: "Zone-Q", supply_capacity_ML: 95 },
    ],

    baseline_gini,
    expected_gini_after,
  };
}

// ─── 5-Act Demo Walkthrough Script ───────────────────────────

export const DEMO_ACTS = [
  {
    act: 1,
    title: "Problem Statement",
    duration_seconds: 30,
    narration: "In Indian cities, 50% of water is lost to leaks and inequity. But even detected water isn't distributed fairly.",
    action: "Click 'Load Demo Scenario'",
    what_to_show: "Map shows 20 zones. Zone-D is red (leak). Zone-G is orange (deficit). Zone-R is green (surplus). Gini: high.",
  },
  {
    act: 2,
    title: "Anomaly Detection",
    duration_seconds: 45,
    narration: "Zone-D has been leaking for days. ML model detects this by analyzing 7 engineered features — rolling mean, rate of change, hour baseline.",
    action: "Click Zone-D (red) to open anomaly card",
    what_to_show: "Card shows: 'Consumption 3.0× normal over 6 days. Probable leak.' Score: 0.89",
  },
  {
    act: 3,
    title: "Fairness Analysis",
    duration_seconds: 45,
    narration: "Zone-G residents only get 54% of their water. Zone-R is at 159%. This is a fairness crisis.",
    action: "Navigate to Redistribution tab",
    what_to_show: "Deficit zones in orange, surplus in green, Gini coefficient shown before optimization.",
  },
  {
    act: 4,
    title: "Equity Optimization",
    duration_seconds: 60,
    narration: "We generate proposals that maximize fairness while respecting 1.5 bar pressure constraints.",
    action: "Click Approve on Zone-R → Zone-G proposal",
    what_to_show: "Pressure gauge shows 2.1 bar (safe). Fairness gain: +8%. Gini drops 11%.",
  },
  {
    act: 5,
    title: "Audit & Governance",
    duration_seconds: 30,
    narration: "Every decision is logged with operator ID and timestamp. City managers export for council review.",
    action: "Navigate to Audit page, click Export XLSX",
    what_to_show: "XLSX with 5 sheets: Anomaly Summary, Redistribution Log, Decisions, Fairness Metrics, Zone Fulfillment.",
  },
];
