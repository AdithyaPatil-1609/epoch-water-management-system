/**
 * POST /api/inject-leak
 * Injects a synthetic leak anomaly into a random non-anomalous zone
 * for demo purposes. Modifies the in-memory cache so the next call
 * to /api/anomalies immediately reflects the injected zone.
 */

import { NextResponse } from 'next/server';
import { getSummaries, setDemoSummaries } from '@/lib/data-cache';

export async function POST() {
  try {
    const summaries = getSummaries();

    // Pick a currently-normal zone to inject a leak into
    const normalZones = summaries.filter(s => s.severity === 'Normal');
    if (normalZones.length === 0) {
      return NextResponse.json({ message: 'No normal zones available to inject into.', success: false });
    }

    const target = normalZones[Math.floor(Math.random() * normalZones.length)];
    const leakMultiplier = 1.8 + Math.random() * 1.2; // 1.8x–3x over baseline

    setDemoSummaries([
      {
        zone_id: target.zone_id,
        anomaly_score: 0.78 + Math.random() * 0.15,
        severity: 'Probable',
        anomaly_type: 'leak',
        reason: `Consumption ${leakMultiplier.toFixed(1)}x normal over last 72h — probable leak detected`,
        factors: ['Slow Ramp', 'Elevated Baseline', 'Pressure Drop'],
        pressure_bar: Math.max(1.2, (target.pressure_bar ?? 2.5) - 0.6),
        fulfillment_pct: Math.max(40, target.fulfillment_pct - 25),
      }
    ]);

    return NextResponse.json({
      success: true,
      message: `Leak injected into ${target.zone_name} (${target.zone_id}) — refresh data to see anomaly.`,
      zone_id: target.zone_id,
      zone_name: target.zone_name,
    });
  } catch (error) {
    console.error('[/api/inject-leak]', error);
    return NextResponse.json({ error: 'Failed to inject leak' }, { status: 500 });
  }
}
