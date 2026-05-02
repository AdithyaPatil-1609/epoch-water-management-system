import { NextResponse } from "next/server";
import { rankProposals } from "@/lib/ml/proposal-ranker";

export async function GET() {
  const dummyProposals = [
    {
      proposal_id: "prop-001",
      source_zone: "Zone-C",
      dest_zone: "Zone-A",
      volume_ML: 5.5,
      reason: "Alleviate summer deficit in Zone-A",
      pressure_after_bar: 2.3,
      priority: "high",
      gini_improvement_percent: 10.2,
      distance_km: 3.5,
    },
    {
      proposal_id: "prop-002",
      source_zone: "Zone-E",
      dest_zone: "Zone-D",
      volume_ML: 2.1,
      reason: "Optimize surplus redistribution",
      pressure_after_bar: 2.8,
      priority: "medium",
      gini_improvement_percent: 4.5,
      distance_km: 6.2,
    },
    {
      proposal_id: "prop-003",
      source_zone: "Zone-P",
      dest_zone: "Zone-K",
      volume_ML: 12.0,
      reason: "High demand fulfillment in industrial zone",
      pressure_after_bar: 1.8,
      priority: "medium",
      gini_improvement_percent: 8.8,
      distance_km: 12.5,
    },
  ];

  const ranked = rankProposals(dummyProposals);
  return NextResponse.json({ ranked });
}
