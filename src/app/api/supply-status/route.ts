import { NextResponse } from "next/server";
import { getUrbanWaterZones } from "@/lib/water-zone-data";
import { calculateWaterAvailability, checkSustainability } from "@/lib/water-availability";

export async function GET() {
  const zones = getUrbanWaterZones();
  const summary = zones.map((zone) => {
    const avail = calculateWaterAvailability(zone);
    const sustain = checkSustainability(zone, 5);
    return {
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      water_availability_ML: Math.round(avail.total_available_ML * 10) / 10,
      daily_demand_ML: Math.round(zone.demand_supply.total_demand_ML_day * 10) / 10,
      net_balance_ML: Math.round((avail.total_available_ML - zone.demand_supply.total_demand_ML_day) * 10) / 10,
      sustainable: sustain.sustainable,
      risk_level: sustain.risk_level,
    };
  });

  return NextResponse.json({ summary });
}
