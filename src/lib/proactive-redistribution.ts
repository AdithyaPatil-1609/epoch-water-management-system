import { analyseRisks } from "@/lib/risk-detector";
import { getUrbanWaterZones } from "@/lib/water-zone-data";
import { calculateWaterAvailability } from "@/lib/water-availability";

export interface ProactiveRedistribution {
  source_zone: string;
  dest_zone: string;
  volume_ML: number;
  scheduled_start_time: string;
  duration_hours: number;
  reason: string;
  proactive: boolean;
  pressure_after_bar: number;
}

export function generateProactiveRedistributions(): ProactiveRedistribution[] {
  const riskAnalysis = analyseRisks(24);
  const zones = getUrbanWaterZones();

  const transfers: ProactiveRedistribution[] = [];
  const atRiskZones = riskAnalysis.deficit_risks.filter(
    (r) => r.risk_level === "CRITICAL" || r.risk_level === "HIGH"
  );

  // Pick surplus zones to satisfy deficits
  for (const risk of atRiskZones) {
    const needed = risk.deficit_ML_day;
    if (needed <= 0) continue;

    // Find closest or largest surplus zone
    const surplusZones = zones
      .map((z) => {
        const avail = calculateWaterAvailability(z);
        const surplus = avail.total_available_ML - z.demand_supply.total_demand_ML_day;
        return {
          zone_id: z.zone_id,
          surplus,
        };
      })
      .filter((z) => z.surplus > needed + 1 && z.zone_id !== risk.zone_id)
      .sort((a, b) => b.surplus - a.surplus);

    if (surplusZones.length > 0) {
      const source = surplusZones[0];
      const startTime = new Date();
      // Start transfer 2 hours before the expected deficit peak
      startTime.setHours(startTime.getHours() + 1);

      transfers.push({
        source_zone: source.zone_id,
        dest_zone: risk.zone_id,
        volume_ML: Math.round(needed * 1.1 * 10) / 10, // +10% buffer
        scheduled_start_time: startTime.toISOString(),
        duration_hours: 8,
        reason: `Proactive transfer to prevent forecasted deficit of ${needed.toFixed(1)} ML/day in ${risk.zone_name}`,
        proactive: true,
        pressure_after_bar: 2.1,
      });
    }
  }

  return transfers;
}
