/**
 * API: POST /api/demo
 * Load a pre-set demo scenario into the in-memory cache.
 * Body: { scenario_id: "leak-equity" | "pipe-burst" | "reset" }
 */

import { NextRequest, NextResponse } from "next/server";
import { resetCache, setDemoSummaries } from "@/lib/data-cache";
import { createLeakAndEquityScenario, createPipeBurstScenario } from "@/lib/demo-scenarios";

export async function POST(request: NextRequest) {
  try {
    const { scenario_id } = await request.json();

    if (scenario_id === "reset") {
      resetCache();
      return NextResponse.json({ success: true, message: "Cache reset to live data." });
    }

    let scenario;
    if (scenario_id === "leak-equity") {
      scenario = createLeakAndEquityScenario();
    } else if (scenario_id === "pipe-burst") {
      scenario = createPipeBurstScenario();
    } else {
      return NextResponse.json(
        { success: false, error: "Unknown scenario_id. Use: leak-equity | pipe-burst | reset" },
        { status: 400 }
      );
    }

    // Reset then inject — ensures clean base data
    resetCache();
    setDemoSummaries(scenario.summaryOverrides, scenario.zoneOverrides as Array<{ zone_id: string; supply_capacity_ML?: number }>);

    return NextResponse.json({
      success: true,
      scenario_id,
      name: scenario.name,
      description: scenario.description,
      baseline_gini: scenario.baseline_gini,
      expected_gini_after: scenario.expected_gini_after,
      story: scenario.story,
    });
  } catch (error) {
    console.error("[/api/demo] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to load demo scenario." }, { status: 500 });
  }
}

export async function GET() {
  const { DEMO_ACTS, createLeakAndEquityScenario } = await import("@/lib/demo-scenarios");
  const scenario = createLeakAndEquityScenario();
  return NextResponse.json({
    available_scenarios: ["leak-equity", "pipe-burst"],
    demo_acts: DEMO_ACTS,
    default_scenario: {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      story: scenario.story,
    },
  });
}
