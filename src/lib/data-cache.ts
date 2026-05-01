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

export function resetCache() {
 _zones = null;
 _records = null;
 _summaries = null;
}

export function getHistory(zoneId: string): DailyConsumption[] {
 return getZoneHistory(zoneId, getRecords());
}

export function applyRedistribution(sourceId: string, destId: string, volumeML: number) {
 const zones = getZones();
 const source = zones.find(z => z.zone_id === sourceId);
 const dest = zones.find(z => z.zone_id === destId);
 
 if (source && dest) {
 // 1. Physically transfer the water capacity
 source.supply_capacity_ML = Math.max(0, source.supply_capacity_ML - volumeML);
 dest.supply_capacity_ML += volumeML;
 
 // 2. Clear the summary cache so it is forced to rebuild
 _summaries = null;
 const summaries = getSummaries(); 
 
 // 3. Clear the anomaly status for the destination zone so the map visually updates to green (Normal).
 const destSummary = summaries.find(s => s.zone_id === destId);
 if (destSummary) {
 destSummary.severity = 'Normal';
 destSummary.anomaly_score = 0;
 destSummary.anomaly_type = null;
 destSummary.reason = 'Deficit resolved via redistribution transfer.';
 }
 }
}
