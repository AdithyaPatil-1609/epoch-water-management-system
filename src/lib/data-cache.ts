// ──────────────────────────────────────────────────────────────
// Shared data cache — generates once, reuses across API calls
// ──────────────────────────────────────────────────────────────

import { generateZones, generateTimeSeries, getLatestZoneSummaries, getZoneHistory, type Zone, type ZoneRecord, type ZoneSummary, type DailyConsumption } from "./synthetic-data";

let _zones: Zone[] | null = null;
let _records: ZoneRecord[] | null = null;
let _summaries: ZoneSummary[] | null = null;
let _demoActive = false;

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
 _demoActive = false;
}

/**
 * Inject demo summaries directly into the cache (overrides generated data).
 * Zone supply overrides are applied to the zone objects as well.
 */
export function setDemoSummaries(
 overrides: Partial<ZoneSummary>[],
 zoneOverrides: Array<{ zone_id: string; supply_capacity_ML?: number }> = []
): void {
 // Ensure base data is generated
 const zones = getZones();
 const summaries = getSummaries();

 // Apply zone supply capacity overrides
 for (const zo of zoneOverrides) {
 const zone = zones.find(z => z.zone_id === zo.zone_id);
 if (zone && zo.supply_capacity_ML !== undefined) {
 zone.supply_capacity_ML = zo.supply_capacity_ML;
 }
 }

 // Rebuild summaries with overrides merged in
 _summaries = summaries.map(s => {
 const override = overrides.find(o => o.zone_id === s.zone_id);
 if (!override) return s;
 return { ...s, ...override };
 });

 _demoActive = true;
}

export function isDemoActive(): boolean {
 return _demoActive;
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
