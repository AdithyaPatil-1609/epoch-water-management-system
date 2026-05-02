import { NextRequest, NextResponse } from "next/server";
import { analyseRisks } from "@/lib/risk-detector";
import { defaultFactors } from "@/lib/demand-forecaster";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const horizon = parseInt(searchParams.get("horizon") ?? "24", 10) as 24 | 48 | 72;

  const factors = defaultFactors();
  const riskSummary = analyseRisks(horizon, factors);

  return NextResponse.json(riskSummary);
}
