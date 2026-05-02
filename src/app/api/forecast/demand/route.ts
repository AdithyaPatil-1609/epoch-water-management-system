import { NextRequest, NextResponse } from "next/server";
import { getForecaster, defaultFactors } from "@/lib/demand-forecaster";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const horizon = parseInt(searchParams.get("horizon") ?? "24", 10) as 24 | 48 | 72;
  const zone_id = searchParams.get("zone_id");

  const forecaster = getForecaster();
  const factors = defaultFactors();

  if (zone_id) {
    const forecast = forecaster.forecastZone(zone_id, horizon, factors);
    return NextResponse.json(forecast);
  }

  const allForecasts = forecaster.forecastAll(horizon, factors);
  return NextResponse.json({ forecasts: allForecasts });
}
