'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { type ZoneSummary } from '@/lib/synthetic-data';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

interface ZoneHeatmapProps {
  zones: ZoneSummary[];
  onZoneSelect: (zoneId: string) => void;
  selectedZoneId: string | null;
}

export function ZoneHeatmap({ zones, onZoneSelect, selectedZoneId }: ZoneHeatmapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full h-full min-h-[400px] bg-slate-50 flex items-center justify-center text-slate-400">Loading map...</div>;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Normal': return '#10b981'; // emerald-500
      case 'Suspicious': return '#eab308'; // yellow-500
      case 'Probable': return '#f97316'; // orange-500
      case 'Critical': return '#ef4444'; // red-500
      default: return '#94a3b8'; // slate-400
    }
  };

  return (
    <div className="w-full h-full min-h-[500px] relative rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        center={[12.97, 77.6]} // Center of fictional city
        zoom={12}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" // Clean light map for data
        />
        
        {zones.map((zone) => {
          const isSelected = selectedZoneId === zone.zone_id;
          const color = getSeverityColor(zone.severity);
          
          return (
            <CircleMarker
              key={zone.zone_id}
              center={[zone.lat, zone.lng]}
              radius={isSelected ? 16 : 12}
              pathOptions={{
                color: isSelected ? '#0f172a' : color,
                weight: isSelected ? 3 : 1,
                fillColor: color,
                fillOpacity: isSelected ? 0.9 : 0.7,
              }}
              eventHandlers={{
                click: () => onZoneSelect(zone.zone_id),
              }}
            >
              <Popup>
                <div className="font-sans">
                  <h3 className="font-medium text-slate-900">{zone.zone_name}</h3>
                  <p className="text-sm text-slate-600 capitalize mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }}></span>
                    {zone.severity}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      
      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur shadow-sm border border-slate-200 rounded-lg p-3 z-[400] text-sm">
        <h4 className="font-medium text-slate-900 mb-2">Zone Status</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span><span className="text-slate-600">Normal</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500"></span><span className="text-slate-600">Suspicious</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span><span className="text-slate-600">Probable</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-slate-600">Critical</span></div>
        </div>
      </div>
    </div>
  );
}
