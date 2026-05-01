// ──────────────────────────────────────────────────────────────
// Shared data cache — generates once, reuses across API calls
// ──────────────────────────────────────────────────────────────

import { generateZones, generateTimeSeries, getLatestZoneSummaries, getZoneHistory, type Zone, type ZoneRecord, type ZoneSummary, type DailyConsumption } from "./synthetic-data";

let _zones: Zone[] | null = null;
let _records: ZoneRecord[] | null = null;
let _summaries: ZoneSummary[] | null = null;

export function getZones(): Zone[] {
  if (!_zones) _zones = generateZones();
  return _zones;
}

export function getRecords(): ZoneRecord[] {
  if (!_records) _records = generateTimeSeries(getZones());
  return _records;
}

export function getSummaries(): ZoneSummary[] {
  if (!_summaries) _summaries = getLatestZoneSummaries(getZones(), getRecords());
  return _summaries;
}

export function getHistory(zoneId: string): DailyConsumption[] {
  return getZoneHistory(zoneId, getRecords());
}
