'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { type ZoneSummary } from '@/lib/synthetic-data';

const MapContainer   = dynamic(() => import('react-leaflet').then(m => m.MapContainer),   { ssr: false });
const TileLayer      = dynamic(() => import('react-leaflet').then(m => m.TileLayer),      { ssr: false });
const CircleMarker   = dynamic(() => import('react-leaflet').then(m => m.CircleMarker),   { ssr: false });
const Polyline       = dynamic(() => import('react-leaflet').then(m => m.Polyline),       { ssr: false });
const Tooltip        = dynamic(() => import('react-leaflet').then(m => m.Tooltip),        { ssr: false });
import { useMap } from 'react-leaflet';

export interface NetworkConnection { zone_id: string; connected_zones: string[]; }

/** A live redistribution transfer from one zone to another */
export interface ActiveTransfer {
  source_id: string;
  dest_id:   string;
  volume_ML: number;
}

interface ZoneHeatmapProps {
  zones:          ZoneSummary[];
  onZoneSelect:   (zoneId: string) => void;
  selectedZoneId: string | null;
  connections?:   NetworkConnection[];
  routePath?:     string[];
  burstZoneIds?:  string[];
  mstEdges?:      Array<[string, string]>;
  routingMode?:   boolean;
  routeSelection?: string[];
  onRouteNodeClick?: (zoneId: string) => void;
  /** Live transfers to animate on the map */
  activeTransfers?: ActiveTransfer[];
}

const SEVERITY_COLOR: Record<string, string> = {
  Normal:    '#10b981',
  Suspicious:'#eab308',
  Probable:  '#f97316',
  Critical:  '#ef4444',
};

// ─── Animated flow dot (pure SVG overlay on canvas) ──────────────────────────
// We use a CSS keyframe animation injected via a <style> tag since Leaflet
// doesn't support React animations natively.

function FlowArrow({
  from, to, label,
}: { from: [number, number]; to: [number, number]; label: string }) {
  // We draw: thick pulsing line + a moving circle via Leaflet Polyline + CSS hack
  // The "moving dot" is simulated via a short dash array that scrolls
  const key = `flow-${from.join()}-${to.join()}`;
  return (
    <>
      {/* Glowing base line */}
      <Polyline
        key={`${key}-base`}
        positions={[from, to]}
        pathOptions={{
          color: '#3b82f6',
          weight: 4,
          opacity: 0.35,
        }}
      />
      {/* Animated dash that moves along the pipe — achieved via stroke-dashoffset animation */}
      <Polyline
        key={`${key}-animated`}
        positions={[from, to]}
        pathOptions={{
          color: '#60a5fa',
          weight: 3.5,
          opacity: 0.9,
          dashArray: '10 18',
          className: 'flow-animated',
        }}
      >
        <Tooltip sticky={false} permanent direction="center" offset={[0, -4]} opacity={0.92}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
            💧 {label}
          </span>
        </Tooltip>
      </Polyline>
    </>
  );
}

function MapZoomController({
  selectedZoneId,
  zones,
}: {
  selectedZoneId: string | null;
  zones: ZoneSummary[];
}) {
  const map = useMap();
  useEffect(() => {
    if (selectedZoneId) {
      const target = zones.find((z) => z.zone_id === selectedZoneId);
      if (target) {
        map.flyTo([target.lat, target.lng], 14, { duration: 1.5 });
      }
    }
  }, [selectedZoneId, zones, map]);
  return null;
}

export function ZoneHeatmap({
  zones,
  onZoneSelect,
  selectedZoneId,
  connections     = [],
  routePath       = [],
  burstZoneIds    = [],
  mstEdges        = [],
  routingMode     = false,
  routeSelection  = [],
  onRouteNodeClick,
  activeTransfers = [],
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
        const to   = coordMap.get(neighborId);
        if (!from || !to) continue;
        const isBurst   = burstZoneIds.includes(conn.zone_id) || burstZoneIds.includes(neighborId);
        const srcZone   = zones.find(z => z.zone_id === conn.zone_id);
        const dstZone   = zones.find(z => z.zone_id === neighborId);
        const isStressed = srcZone?.severity !== 'Normal' || dstZone?.severity !== 'Normal';
        edges.push({ key, from, to, status: isBurst ? 'congested' : isStressed ? 'moderate' : 'clear' });
      }
    }
    return edges;
  }, [connections, coordMap, zones, burstZoneIds]);

  // Route path polyline
  const routeCoords = useMemo<Array<[number, number]>>(() =>
    routePath.map(id => coordMap.get(id)).filter((c): c is [number, number] => !!c),
  [routePath, coordMap]);

  // MST edges
  const mstCoords = useMemo(() =>
    mstEdges.map(([a, b]) => {
      const from = coordMap.get(a);
      const to   = coordMap.get(b);
      return from && to ? { from, to } : null;
    }).filter((e): e is { from: [number, number]; to: [number, number] } => !!e),
  [mstEdges, coordMap]);

  // Resolve active transfer coords
  const transferEdges = useMemo(() =>
    activeTransfers.flatMap(t => {
      const from = coordMap.get(t.source_id);
      const to   = coordMap.get(t.dest_id);
      if (!from || !to) return [];
      return [{ from, to, label: `${t.volume_ML.toFixed(1)} ML → ${t.dest_id}` }];
    }),
  [activeTransfers, coordMap]);

  const pipeColor = { clear: '#94a3b8', moderate: '#f97316', congested: '#ef4444' };

  if (!mounted) {
    return <div className="w-full h-full min-h-[400px] bg-slate-50 flex items-center justify-center text-slate-500 text-sm">Loading network map…</div>;
  }

  return (
    <div className="w-full h-full min-h-[500px] relative rounded-xl overflow-hidden border border-slate-200">
      {/* CSS for animated flow dashes */}
      <style>{`
        .flow-animated {
          animation: flowDash 1.4s linear infinite;
        }
        @keyframes flowDash {
          to { stroke-dashoffset: -28; }
        }
      `}</style>

      <MapContainer center={[12.97, 77.6]} zoom={11} className="w-full h-full" zoomControl>
        <MapZoomController selectedZoneId={selectedZoneId} zones={zones} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Base pipe connections */}
        {pipeEdges.map(edge => (
          <Polyline
            key={edge.key}
            positions={[edge.from, edge.to]}
            pathOptions={{ color: pipeColor[edge.status], weight: 1.8, opacity: 0.55, dashArray: edge.status === 'congested' ? '6 4' : undefined }}
          />
        ))}

        {/* MST overlay */}
        {mstEdges.length > 0 && mstCoords.map((e, i) => (
          <Polyline
            key={`mst-${i}`}
            positions={[e.from, e.to]}
            pathOptions={{ color: '#06b6d4', weight: 2.5, opacity: 0.5, dashArray: '8 5' }}
          />
        ))}

        {/* Optimal route */}
        {routeCoords.length > 1 && (
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: '#22c55e', weight: 5, opacity: 0.9 }}
          />
        )}

        {/* ── Animated redistribution flow arrows ── */}
        {transferEdges.map((e, i) => (
          <FlowArrow key={i} from={e.from} to={e.to} label={e.label} />
        ))}

        {/* Zone nodes */}
        {zones.map(zone => {
          const isSelected    = selectedZoneId === zone.zone_id;
          const isBurst       = burstZoneIds.includes(zone.zone_id);
          const isRouteSource = routeSelection[0] === zone.zone_id;
          const isRouteDest   = routeSelection[1] === zone.zone_id;
          const isOnPath      = routePath.includes(zone.zone_id);
          const isTransferSrc = activeTransfers.some(t => t.source_id === zone.zone_id);
          const isTransferDst = activeTransfers.some(t => t.dest_id   === zone.zone_id);
          const color = isBurst ? '#ef4444' : SEVERITY_COLOR[zone.severity] ?? '#94a3b8';

          return (
            <CircleMarker
              key={zone.zone_id}
              center={[zone.lat, zone.lng]}
              radius={isOnPath ? 14 : isSelected ? 13 : 10}
              pathOptions={{
                color: isTransferSrc ? '#f59e0b'
                     : isTransferDst ? '#3b82f6'
                     : isSelected    ? '#0f172a'
                     : '#ffffff',
                weight: isTransferSrc || isTransferDst ? 3 : 2,
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
              <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.92}>
                <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                  {isTransferSrc ? '⬆ ' : isTransferDst ? '⬇ ' : ''}
                  {zone.zone_id}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur shadow-sm border border-slate-200 rounded-lg p-3 z-[400] text-xs space-y-1.5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-400 rounded" /><span className="text-slate-600">Clear</span></div>
          <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-orange-400 rounded" /><span className="text-slate-600">Stressed</span></div>
          <div className="flex items-center gap-1.5"><span className="w-4 h-1 bg-green-500 rounded" /><span className="text-slate-600">Route</span></div>
          <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-400 rounded" style={{ borderTop: '2px dashed #60a5fa', background: 'none' }} /><span className="text-slate-600">Flow active</span></div>
        </div>
        {activeTransfers.length > 0 && (
          <div className="pt-1.5 border-t border-slate-100 text-[10px] text-blue-600 font-bold">
            💧 {activeTransfers.length} active transfer{activeTransfers.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
