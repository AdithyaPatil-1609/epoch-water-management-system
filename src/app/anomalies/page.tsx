'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Warning, ArrowsClockwise, FunnelSimple, MagnifyingGlass,
  Drop, Lightning, Bug, Gauge, Factory, SealWarning,
  DownloadSimple, SpinnerGap, CheckCircle,
} from '@phosphor-icons/react';
import type { ZoneSummary } from '@/lib/synthetic-data';

// ─── Severity / type config ───────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Critical:  { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  Probable:  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  Suspicious:{ bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-400' },
};

const ANOMALY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  leak:              { label: 'Leak',              icon: <Drop size={14} weight="fill" />,        color: 'text-blue-600' },
  theft:             { label: 'Theft',             icon: <Bug size={14} weight="fill" />,         color: 'text-purple-600' },
  meter_fault:       { label: 'Meter Fault',       icon: <Gauge size={14} weight="fill" />,       color: 'text-amber-600' },
  event:             { label: 'Event Spike',       icon: <Lightning size={14} weight="fill" />,   color: 'text-yellow-600' },
  pipe_rupture:      { label: 'Pipe Rupture',      icon: <Warning size={14} weight="fill" />,     color: 'text-red-600' },
  industrial_misuse: { label: 'Industrial Misuse', icon: <Factory size={14} weight="fill" />,     color: 'text-orange-600' },
};

// ─── Sub-components ───────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${color}`}>
      <span className="text-lg font-black font-mono">{value}</span>
      <span className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</span>
    </div>
  );
}

type SeverityFilter = 'all' | 'Critical' | 'Probable' | 'Suspicious';
type TypeFilter = 'all' | 'leak' | 'theft' | 'meter_fault' | 'event' | 'pipe_rupture' | 'industrial_misuse';

// ─── Page ─────────────────────────────────────────────────────

export default function AnomaliesPage() {
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [injectingLeak, setInjectingLeak] = useState(false);
  const [injectDone, setInjectDone] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/anomalies');
      const data = await res.json();
      setZones(data.all_zones ?? []);
    } catch (e) {
      console.error('Failed to fetch anomalies:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleInjectLeak = async () => {
    setInjectingLeak(true);
    setInjectDone(false);
    try {
      const res = await fetch('/api/inject-leak', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        setInjectDone(true);
        setTimeout(() => setInjectDone(false), 3000);
      }
    } finally {
      setInjectingLeak(false);
    }
  };

  // Derive anomalous zones
  const anomalous = zones.filter(z => z.severity !== 'Normal');

  // Apply filters
  const filtered = anomalous.filter(z => {
    if (severityFilter !== 'all' && z.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && z.anomaly_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        z.zone_name.toLowerCase().includes(q) ||
        z.zone_id.toLowerCase().includes(q) ||
        (z.reason ?? '').toLowerCase().includes(q) ||
        (z.anomaly_type ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const critical  = anomalous.filter(z => z.severity === 'Critical').length;
  const probable  = anomalous.filter(z => z.severity === 'Probable').length;
  const suspicious = anomalous.filter(z => z.severity === 'Suspicious').length;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } },
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f9fafb]">

      {/* ── Page Header ── */}
      <div className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Warning size={22} weight="duotone" className="text-red-500" />
            <h1 className="text-xl font-medium tracking-tight text-slate-900">Anomaly Feed</h1>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs font-mono text-slate-600">
              {filtered.length} of {anomalous.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Inject Leak button */}
            <button
              onClick={handleInjectLeak}
              disabled={injectingLeak}
              className={`flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider shadow-sm transition-all duration-200 ${
                injectDone
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
              } disabled:opacity-60`}
            >
              {injectingLeak ? <SpinnerGap size={13} className="animate-spin" /> : injectDone ? <CheckCircle size={13} weight="fill" /> : <Lightning size={13} weight="fill" />}
              {injectingLeak ? 'Injecting…' : injectDone ? 'Injected!' : 'Inject Leak'}
            </button>
            {/* Refresh button */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50"
            >
              <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="w-full border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <StatPill label="Critical"   value={critical}   color="bg-red-50    text-red-700    border-red-200" />
          <StatPill label="Probable"   value={probable}   color="bg-orange-50 text-orange-700 border-orange-200" />
          <StatPill label="Suspicious" value={suspicious} color="bg-amber-50  text-amber-700  border-amber-200" />
          <div className="ml-auto text-xs text-slate-400 font-mono">
            {zones.length} total zones monitored
          </div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="w-full border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search zone, type, or reason…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
            />
          </div>

          {/* Severity tabs */}
          <div className="flex items-center gap-1">
            <FunnelSimple size={14} className="text-slate-400 mr-1" />
            {(['all', 'Critical', 'Probable', 'Suspicious'] as SeverityFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all duration-200 ${
                  severityFilter === s
                    ? s === 'Critical'   ? 'bg-red-600 text-white'
                    : s === 'Probable'  ? 'bg-orange-500 text-white'
                    : s === 'Suspicious'? 'bg-amber-500 text-white'
                    : 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Anomaly type select */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as TypeFilter)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="all">All Types</option>
            {Object.entries(ANOMALY_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading anomaly data…</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="p-5 rounded-full bg-emerald-100 border border-emerald-200">
              <Drop size={32} weight="fill" className="text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-700">
                {anomalous.length === 0 ? 'All zones are normal' : 'No matching anomalies'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {anomalous.length === 0
                  ? 'The network is operating within expected parameters.'
                  : 'Try adjusting the filters or search query.'}
              </p>
            </div>
            {anomalous.length === 0 && (
              <button
                onClick={handleInjectLeak}
                className="mt-2 flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                <Lightning size={15} weight="fill" /> Inject a test leak
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${severityFilter}-${typeFilter}-${search}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {filtered
                .sort((a, b) => b.anomaly_score - a.anomaly_score)
                .map(zone => {
                  const style = SEVERITY_STYLES[zone.severity];
                  const meta  = zone.anomaly_type ? ANOMALY_META[zone.anomaly_type] : null;

                  return (
                    <motion.div
                      key={zone.zone_id}
                      variants={cardVariants}
                      className={`rounded-2xl border ${style.bg} ${style.border} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}
                    >
                      {/* Card header */}
                      <div className={`px-5 py-3.5 border-b ${style.border} flex items-start justify-between gap-3`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${style.dot} ${zone.severity === 'Critical' ? 'animate-pulse' : ''}`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-bold truncate ${style.text}`}>{zone.zone_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{zone.zone_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {meta && (
                            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/70 border border-slate-200/80 px-1.5 py-0.5 rounded-md ${meta.color}`}>
                              {meta.icon} {meta.label}
                            </span>
                          )}
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-white/70 ${style.text} ${style.border}`}>
                            {zone.severity}
                          </span>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-5 py-4 space-y-3">
                        {/* Reason */}
                        <p className="text-xs text-slate-600 leading-relaxed">{zone.reason}</p>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Score',    value: zone.anomaly_score.toFixed(2), bold: true },
                            { label: 'Pressure', value: `${zone.pressure_bar?.toFixed(1)} bar` },
                            { label: 'Supply',   value: `${zone.fulfillment_pct}%`, colorClass: zone.fulfillment_pct >= 80 ? 'text-emerald-600' : 'text-red-600' },
                          ].map(m => (
                            <div key={m.label} className="bg-white/60 rounded-lg border border-white/80 px-2.5 py-2 text-center">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{m.label}</p>
                              <p className={`text-sm font-black font-mono ${m.colorClass ?? style.text}`}>{m.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Factor chips */}
                        {zone.factors.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {zone.factors.map(f => (
                              <span key={f} className="text-[9px] font-semibold uppercase tracking-wider bg-white/70 border border-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
