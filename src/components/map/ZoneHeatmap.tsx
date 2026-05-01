'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { type ZoneSummary } from '@/lib/synthetic-data';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false });

export interface NetworkConnection { zone_id: string; connected_zones: string[]; }

interface ZoneHeatmapProps {
 zones: ZoneSummary[];
 onZoneSelect: (zoneId: string) => void;
 selectedZoneId: string | null;
 connections?: NetworkConnection[];
 routePath?: string[]; // Ordered zone_id array from Dijkstra
 burstZoneIds?: string[];
 mstEdges?: Array<[string, string]>;
 routingMode?: boolean;
 routeSelection?: string[]; // [source?, dest?] while user is picking
 onRouteNodeClick?: (zoneId: string) => void;
}

const SEVERITY_COLOR: Record<string, string> = {
 Normal: '#10b981',
 Suspicious: '#eab308',
 Probable: '#f97316',
 Critical: '#ef4444',
};

export function ZoneHeatmap({
 zones,
 onZoneSelect,
 selectedZoneId,
 connections = [],
 routePath = [],
 burstZoneIds = [],
 mstEdges = [],
 routingMode = false,
 routeSelection = [],
 onRouteNodeClick,
}: ZoneHeatmapProps) {
 const [mounted, setMounted] = useState(false);
 useEffect(() => { setMounted(true); }, []);

 // Build coord lookup
 const coordMap = useMemo(() => {
 const m = new Map<string, [number, number]>();
 zones.forEach(z => m.set(z.zone_id, [z.lat, z.lng]));
 return m;
 }, [zones]);

 // Unique pipe edges
 const pipeEdges = useMemo(() => {
 const seen = new Set<string>();
 const edges: Array<{ key: string; from: [number, number]; to: [number, number]; status: 'clear' | 'moderate' | 'congested' }> = [];
 for (const conn of connections) {
 for (const neighborId of conn.connected_zones) {
 const key = [conn.zone_id, neighborId].sort().join('|');
 if (seen.has(key)) continue;
 seen.add(key);
 const from = coordMap.get(conn.zone_id);
 const to = coordMap.get(neighborId);
 if (!from || !to) continue;
 const isBurst = burstZoneIds.includes(conn.zone_id) || burstZoneIds.includes(neighborId);
 const srcZone = zones.find(z => z.zone_id === conn.zone_id);
 const dstZone = zones.find(z => z.zone_id === neighborId);
 const isStressed = srcZone?.severity !== 'Normal' || dstZone?.severity !== 'Normal';
 edges.push({ key, from, to, status: isBurst ? 'congested' : isStressed ? 'moderate' : 'clear' });
 }
 }
 return edges;
 }, [connections, coordMap, zones, burstZoneIds]);

 // Route path as polyline coords
 const routeCoords = useMemo<Array<[number, number]>>(() => {
 return routePath.map(id => coordMap.get(id)).filter((c): c is [number, number] => !!c);
 }, [routePath, coordMap]);

 // MST edges as polylines
 const mstCoords = useMemo(() => {
 return mstEdges.map(([a, b]) => {
 const from = coordMap.get(a);
 const to = coordMap.get(b);
 return from && to ? { from, to } : null;
 }).filter((e): e is { from: [number, number]; to: [number, number] } => !!e);
 }, [mstEdges, coordMap]);

 const pipeColor = { clear: '#94a3b8', moderate: '#f97316', congested: '#ef4444' };

 if (!mounted) {
 return <div className="w-full h-full min-h-[400px] bg-slate-50 flex items-center justify-center text-slate-900">Loading network map…</div>;
 }

 return (
 <div className="w-full h-full min-h-[500px] relative rounded-xl overflow-hidden border border-slate-200">
 <MapContainer center={[12.97, 77.6]} zoom={11} className="w-full h-full" zoomControl>
 <TileLayer
 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
 />

 {/* Pipe connections */}
 {pipeEdges.map(edge => (
 <Polyline
 key={edge.key}
 positions={[edge.from, edge.to]}
 pathOptions={{ color: pipeColor[edge.status], weight: 2, opacity: 0.65, dashArray: edge.status === 'congested' ? '6 4' : undefined }}
 />
 ))}

 {/* MST overlay (dashed cyan) */}
 {mstEdges.length > 0 && mstCoords.map((e, i) => (
 <Polyline
 key={`mst-${i}`}
 positions={[e.from, e.to]}
 pathOptions={{ color: '#06b6d4', weight: 2.5, opacity: 0.5, dashArray: '8 5' }}
 />
 ))}

 {/* Optimal route path */}
 {routeCoords.length > 1 && (
 <Polyline
 positions={routeCoords}
 pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.9 }}
 />
 )}

 {/* Zone nodes */}
 {zones.map(zone => {
 const isSelected = selectedZoneId === zone.zone_id;
 const isBurst = burstZoneIds.includes(zone.zone_id);
 const isRouteSource = routeSelection[0] === zone.zone_id;
 const isRouteDest = routeSelection[1] === zone.zone_id;
 const isOnPath = routePath.includes(zone.zone_id);
 const color = isBurst ? '#ef4444' : SEVERITY_COLOR[zone.severity] ?? '#94a3b8';
 const outlineColor = isRouteSource ? '#6366f1' : isRouteDest ? '#a855f7' : isSelected ? '#0f172a' : color;

 return (
 <CircleMarker
 key={zone.zone_id}
 center={[zone.lat, zone.lng]}
 radius={isOnPath ? 15 : 12}
 pathOptions={{
 color: '#ffffff',
 weight: 2,
 fillColor: color,
 fillOpacity: 0.95,
 }}
 eventHandlers={{
 click: () => {
 if (routingMode && onRouteNodeClick) onRouteNodeClick(zone.zone_id);
 else onZoneSelect(zone.zone_id);
 },
 }}
 >
 <Tooltip permanent direction="top" offset={[0, -14]} opacity={0.92}>
 <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", lineHeight: 1.2 }}>
 {zone.zone_name.split(" ").slice(0, 2).join(" ")}
 </span>
 </Tooltip>
 </CircleMarker>
 );
 })}
 </MapContainer>

 {/* Legend */}
 <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur shadow-sm border border-slate-200 rounded-lg p-3 z-[400] text-xs">
 <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
 <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-400 rounded" /><span className="text-slate-900">Clear</span></div>
 <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-orange-400 rounded" /><span className="text-slate-900">Moderate</span></div>
 <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-500 rounded" style={{ borderTop: '2px dashed #ef4444', background: 'none' }} /><span className="text-slate-900">Burst</span></div>
 <div className="flex items-center gap-1.5"><span className="w-4 h-1 bg-green-500 rounded" /><span className="text-slate-900">Optimal path</span></div>
 </div>
 </div>
 </div>
 );
}
