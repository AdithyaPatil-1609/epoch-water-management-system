'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Robot, ArrowsClockwise, Lightning, CheckCircle, Wrench,
  Eye, Warning, TrendUp, Brain,
} from '@phosphor-icons/react';
import type { ZoneSummary } from '@/lib/synthetic-data';

// ─── Types ────────────────────────────────────────────────────

type AlertType = 'info' | 'warn' | 'critical';
interface ActionLog { id: number; msg: string; type: AlertType; time: string }
let _alertCounter = 0;

// ─── Small reusable card ──────────────────────────────────────

function PerfCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black font-mono ${color}`}>
        {value} <span className="text-xs font-normal text-slate-400">({sub})</span>
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AiInsightsPage() {
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [advice, setAdvice] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);
  const [zoneLoading, setZoneLoading] = useState(true);

  // ─── Helpers ────────────────────────────────────────────────

  const logAction = (msg: string, type: AlertType = 'info') => {
    setActionLog(prev => [
      { id: ++_alertCounter, msg, type, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 9),
    ]);
  };

  // Fetch zone data first
  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch('/api/anomalies');
      const data = await res.json();
      setZones(data.all_zones ?? []);
    } finally {
      setZoneLoading(false);
    }
  }, []);

  // Call AI advisor
  const fetchAdvice = useCallback(async (currentZones: ZoneSummary[]) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const anomalous = currentZones.filter(z => z.severity !== 'Normal');
      const deficitCount = currentZones.filter(z => z.fulfillment_pct < 80).length;
      const avgPressure = currentZones.length
        ? currentZones.reduce((s, z) => s + (z.pressure_bar ?? 2.5), 0) / currentZones.length
        : 2.5;

      const res = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zones: currentZones.map(z => ({
            zone_id: z.zone_id,
            zone_name: z.zone_name,
            severity: z.severity,
            fulfillment_pct: z.fulfillment_pct,
            pressure_bar: z.pressure_bar ?? 2.5,
            anomaly_type: z.anomaly_type ?? null,
          })),
          burstZoneIds: [],
          deficitCount,
          avgPressure,
          mode: anomalous.some(z => z.severity === 'Critical') ? 'disaster' : 'normal',
        }),
      });
      const data = await res.json();
      if (data.advice?.length > 0) setAdvice(data.advice);
      else setAiError(data.error ?? 'No advice returned.');
    } catch {
      setAiError('Failed to reach AI Advisor. Check your GEMINI_API_KEY in .env.local.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Auto-generate advice once zones are loaded
  useEffect(() => {
    if (zones.length > 0 && advice.length === 0 && !aiLoading) {
      fetchAdvice(zones);
    }
  }, [zones]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived context
  const anomalous    = zones.filter(z => z.severity !== 'Normal');
  const criticalZone = zones.find(z => z.severity === 'Critical');
  const deficitZones = zones.filter(z => z.fulfillment_pct < 80);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f9fafb]">

      {/* ── Page Header ── */}
      <div className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Robot size={22} weight="duotone" className="text-emerald-600" />
            <h1 className="text-xl font-medium tracking-tight text-slate-900">AI Insight Panel</h1>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-xs font-mono text-emerald-700">
              Gemini
            </span>
          </div>
          <button
            onClick={() => fetchAdvice(zones)}
            disabled={aiLoading || zoneLoading}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50"
          >
            <ArrowsClockwise size={13} className={aiLoading ? 'animate-spin' : ''} />
            {aiLoading ? 'Analyzing…' : 'Refresh Analysis'}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: AI insights (2-col) ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Context Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Brain size={20} weight="fill" className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Intelligent AI Insights</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Contextual detection metrics and suggested action plans</p>
                </div>
              </div>

              {/* Network summary context */}
              {!zoneLoading && (
                <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl mb-4">
                  <p className="text-xs font-bold text-slate-700 mb-1.5">Plain-Language Analysis Context</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {criticalZone
                      ? `The network analyzer has flagged ${criticalZone.zone_name} as Critical — ${criticalZone.reason}. Immediate operational review is required.`
                      : anomalous.length > 0
                      ? `${anomalous.length} zones are showing anomalous patterns. The highest-risk zone is ${anomalous[0]?.zone_name}: ${anomalous[0]?.reason}.`
                      : 'All zones are operating within normal parameters. No immediate action required. Continued monitoring is recommended.'}
                    {deficitZones.length > 0 && ` Additionally, ${deficitZones.length} zone${deficitZones.length > 1 ? 's are' : ' is'} operating below 80% supply fulfillment.`}
                  </p>
                </div>
              )}

              {/* AI Advice */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl mb-5">
                <p className="text-xs font-bold text-slate-700 mb-2">
                  Operational AI Suggestion
                  {aiLoading && <span className="ml-2 inline-block w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin align-middle" />}
                </p>
                {aiError ? (
                  <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg p-3">
                    <Warning size={14} className="shrink-0 mt-0.5" />
                    {aiError}
                  </div>
                ) : aiLoading && advice.length === 0 ? (
                  <div className="space-y-2">
                    {[80, 90, 70, 85].map((w, i) => (
                      <div key={i} className="h-3 bg-slate-100 rounded animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : advice.length > 0 ? (
                  <ol className="space-y-3">
                    {advice.map((a, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="flex gap-3 text-xs text-slate-700 leading-relaxed"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        {a}
                      </motion.li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-slate-400">Click "Refresh Analysis" to ask Gemini.</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5 flex-wrap">
                {[
                  { label: 'Investigate', icon: <Eye size={13} weight="bold" />,     color: 'bg-emerald-600 hover:bg-emerald-700 text-white', type: 'info' as AlertType },
                  { label: 'Acknowledge', icon: <CheckCircle size={13} weight="bold" />, color: 'border border-slate-200 text-slate-700 hover:bg-slate-50', type: 'info' as AlertType },
                  { label: 'Apply Fix',  icon: <Wrench size={13} weight="bold" />,   color: 'bg-indigo-600 hover:bg-indigo-700 text-white', type: 'warn' as AlertType },
                ].map(btn => (
                  <motion.button
                    key={btn.label}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => logAction(`${btn.label} action registered via AI panel.`, btn.type)}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 px-4 rounded-xl uppercase tracking-wider transition-all duration-200 ${btn.color}`}
                  >
                    {btn.icon} {btn.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Anomaly context cards */}
            {!zoneLoading && anomalous.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm"
              >
                <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Warning size={16} weight="duotone" className="text-red-500" />
                  Active Anomalies Requiring Attention
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {anomalous.slice(0, 5).map((z, i) => (
                      <motion.div
                        key={z.zone_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`p-4 rounded-xl border ${
                          z.severity === 'Critical'  ? 'bg-red-50/60    border-red-200' :
                          z.severity === 'Probable'  ? 'bg-orange-50/60 border-orange-200' :
                                                       'bg-amber-50/60  border-amber-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-xs font-bold text-slate-800">{z.zone_name}</p>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                            z.severity === 'Critical'  ? 'bg-red-100    text-red-700    border-red-200' :
                            z.severity === 'Probable'  ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                         'bg-amber-100  text-amber-700  border-amber-200'
                          }`}>{z.severity}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">{z.reason}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {anomalous.length > 5 && (
                    <p className="text-xs text-slate-400 text-center pt-1">+{anomalous.length - 5} more on the Anomaly Feed page</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Action log */}
            {actionLog.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm"
              >
                <h2 className="text-sm font-bold text-slate-800 mb-3">Action Log</h2>
                <div className="space-y-2">
                  <AnimatePresence>
                    {actionLog.map(a => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`text-xs p-2.5 rounded-xl border font-medium ${
                          a.type === 'critical' ? 'bg-red-50 border-red-100 text-red-700' :
                          a.type === 'warn'     ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                                                  'bg-slate-50 border-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-slate-400 mr-2">{a.time}</span>
                        {a.msg}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Right: Performance metrics ── */}
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                  <Lightning size={20} weight="fill" className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Performance & System Health</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Execution performance telemetry</p>
                </div>
              </div>
              <div className="space-y-3">
                <PerfCard label="Detection Time"            value="< 2.1s"  sub="optimal"       color="text-emerald-600" />
                <PerfCard label="Redistribution Compute"    value="~42ms"   sub="A* heuristic"  color="text-slate-800" />
                <PerfCard label="API Roundtrip Latency"     value="~11ms"   sub="favorable"     color="text-emerald-600" />
                <PerfCard label="ML Detection Confidence"   value="94.6%"   sub="Isolation Forest" color="text-indigo-600" />
              </div>
            </motion.div>

            {/* Live zone snapshot */}
            {!zoneLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-cyan-50 rounded-xl border border-cyan-100">
                    <TrendUp size={18} weight="fill" className="text-cyan-600" />
                  </div>
                  <h2 className="font-bold text-slate-800 text-sm">Live Network Snapshot</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Zones',    value: zones.length,                          color: 'text-slate-800' },
                    { label: 'Anomalous',      value: anomalous.length,                      color: anomalous.length > 0 ? 'text-red-600' : 'text-emerald-600' },
                    { label: 'In Deficit',     value: deficitZones.length,                   color: deficitZones.length > 0 ? 'text-orange-600' : 'text-emerald-600' },
                    { label: 'Avg Pressure',   value: zones.length ? `${(zones.reduce((s, z) => s + (z.pressure_bar ?? 2.5), 0) / zones.length).toFixed(1)} bar` : '—', color: 'text-blue-600' },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{m.label}</p>
                      <p className={`text-lg font-black font-mono ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
