'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Warning, SealWarning, Bug, Drop, Lightning, Factory, Gauge } from '@phosphor-icons/react';
import type { ZoneSummary } from '@/lib/synthetic-data';

interface AnomalyFeedProps {
  zones: ZoneSummary[];
  onSelectZone?: (zoneId: string) => void;
  selectedZoneId?: string | null;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Critical: { bg: 'bg-red-50/60', text: 'text-red-700', border: 'border-red-200/70', dot: 'bg-red-500' },
  Probable: { bg: 'bg-orange-50/60', text: 'text-orange-700', border: 'border-orange-200/70', dot: 'bg-orange-500' },
  Suspicious: { bg: 'bg-amber-50/60', text: 'text-amber-700', border: 'border-amber-200/70', dot: 'bg-amber-400' },
  Normal: { bg: 'bg-emerald-50/40', text: 'text-emerald-700', border: 'border-emerald-200/60', dot: 'bg-emerald-500' },
};

const ANOMALY_ICONS: Record<string, React.ReactNode> = {
  leak: <Drop size={14} weight="fill" className="text-blue-500" />,
  theft: <Bug size={14} weight="fill" className="text-purple-500" />,
  meter_fault: <Gauge size={14} weight="fill" className="text-amber-500" />,
  event: <Lightning size={14} weight="fill" className="text-yellow-500" />,
  pipe_rupture: <Warning size={14} weight="fill" className="text-red-500" />,
  industrial_misuse: <Factory size={14} weight="fill" className="text-orange-600" />,
};

function AnomalyBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const icon = ANOMALY_ICONS[type];
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-slate-100/80 text-slate-600 border border-slate-200/60 px-1.5 py-0.5 rounded-md">
      {icon} {label}
    </span>
  );
}

export function AnomalyFeed({ zones, onSelectZone, selectedZoneId }: AnomalyFeedProps) {
  const anomalies = zones
    .filter(z => z.severity !== 'Normal')
    .sort((a, b) => b.anomaly_score - a.anomaly_score);

  if (anomalies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <div className="p-3 rounded-full bg-emerald-100 border border-emerald-200">
          <Drop size={24} weight="fill" className="text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">All Clear</p>
          <p className="text-xs text-slate-400 mt-0.5">No anomalies detected across all zones.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {anomalies.length} anomalous zone{anomalies.length !== 1 ? 's' : ''} detected
        </p>
        <div className="flex items-center gap-1.5">
          {['Critical', 'Probable', 'Suspicious'].map(sev => {
            const count = anomalies.filter(a => a.severity === sev).length;
            if (count === 0) return null;
            const s = SEVERITY_STYLES[sev];
            return (
              <span key={sev} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${s.bg} ${s.text} ${s.border}`}>
                {count} {sev}
              </span>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {anomalies.map((zone, i) => {
          const style = SEVERITY_STYLES[zone.severity] ?? SEVERITY_STYLES.Normal;
          const isSelected = selectedZoneId === zone.zone_id;

          return (
            <motion.div
              key={zone.zone_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelectZone?.(zone.zone_id)}
              className={`rounded-xl border p-3 cursor-pointer transition-all duration-200 ${style.bg} ${style.border} ${
                isSelected ? 'ring-2 ring-offset-1 ring-emerald-400 shadow-md' : 'hover:shadow-sm hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${style.dot} ${zone.severity === 'Critical' ? 'animate-pulse' : ''}`} />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${style.text}`}>{zone.zone_name}</p>
                    <p className="text-[9px] text-slate-400 font-mono">{zone.zone_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <AnomalyBadge type={zone.anomaly_type} />
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border} uppercase tracking-wider`}>
                    {zone.severity}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 leading-snug mb-2 line-clamp-2">{zone.reason}</p>

              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="font-mono font-semibold">Score: {zone.anomaly_score.toFixed(2)}</span>
                <span className="text-slate-300">|</span>
                <span>Pressure: <strong className="text-slate-700">{zone.pressure_bar?.toFixed(1)} bar</strong></span>
                <span className="text-slate-300">|</span>
                <span>Supply: <strong className={zone.fulfillment_pct >= 80 ? 'text-emerald-600' : 'text-red-600'}>{zone.fulfillment_pct}%</strong></span>
              </div>

              {zone.factors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {zone.factors.map(f => (
                    <span key={f} className="text-[9px] font-semibold uppercase tracking-wider bg-white/60 border border-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
