/**
 * POST /api/ingest/scada
 * Receive SCADA sensor readings, deduplicate (zone + timestamp ±5 min), cache.
 *
 * GET /api/ingest/scada
 * Return last N readings from cache.
 */
import { NextRequest, NextResponse } from "next/server";

interface StoredReading {
  zone_id: string;
  timestamp: string;
  consumption_ML: number;
  pressure_bar: number;
  sensor_confidence: number;
  flags: string[];
  inserted_at: number; // Date.now()
}

// In-memory ring buffer (last 200 readings)
const INGEST_CACHE: StoredReading[] = [];
const MAX_CACHE = 200;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isDuplicate(zone_id: string, timestamp: string): boolean {
  const ts = new Date(timestamp).getTime();
  return INGEST_CACHE.some(
    (r) =>
      r.zone_id === zone_id &&
      Math.abs(new Date(r.timestamp).getTime() - ts) < DEDUP_WINDOW_MS
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const readings = Array.isArray(body.readings) ? body.readings : [body];

  let inserted = 0;
  let duplicates_skipped = 0;

  for (const r of readings) {
    const ts = r.timestamp ?? new Date().toISOString();
    if (isDuplicate(r.zone_id, ts)) {
      duplicates_skipped++;
      continue;
    }
    INGEST_CACHE.push({
      zone_id: r.zone_id,
      timestamp: ts,
      consumption_ML: r.consumption_ML ?? (r.consumption_liters !== undefined ? r.consumption_liters / 1000 : 0),
      pressure_bar: r.pressure_bar ?? 2.0,
      sensor_confidence: r.sensor_confidence ?? 0.9,
      flags: r.flags ?? [],
      inserted_at: Date.now(),
    });
    inserted++;
  }

  // Trim to ring buffer size
  while (INGEST_CACHE.length > MAX_CACHE) INGEST_CACHE.shift();

  return NextResponse.json({
    success: true,
    inserted,
    duplicates_skipped,
    cache_size: INGEST_CACHE.length,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
  const zone = request.nextUrl.searchParams.get("zone_id");
  let readings = [...INGEST_CACHE].reverse(); // newest first
  if (zone) readings = readings.filter((r) => r.zone_id === zone);
  return NextResponse.json({ readings: readings.slice(0, limit), total: readings.length });
}
