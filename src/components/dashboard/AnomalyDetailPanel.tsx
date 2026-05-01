'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Warning, CheckCircle, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { ZoneSummary, DailyConsumption } from '@/lib/synthetic-data';
import { Badge } from '../ui/Badge';
import { ConsumptionChart } from '../charts/ConsumptionChart';
import { useState, useEffect } from 'react';

interface AnomalyDetailPanelProps {
 zoneId: string | null;
 onClose: () => void;
}

const SEVERITY_BG: Record<string, string> = {
 Critical: 'bg-red-50 border-red-200',
 Probable: 'bg-orange-50 border-orange-200',
 Suspicious: 'bg-yellow-50 border-yellow-200',
 Normal: 'bg-emerald-50 border-emerald-200',
};

export function AnomalyDetailPanel({ zoneId, onClose }: AnomalyDetailPanelProps) {
 const [zone, setZone] = useState<ZoneSummary | null>(null);
 const [history, setHistory] = useState<DailyConsumption[]>([]);
 const [loading, setLoading] = useState(false);
 const [actionLogged, setActionLogged] = useState<string | null>(null);

 useEffect(() => {
 if (!zoneId) { setZone(null); return; }

 setLoading(true);
 setActionLogged(null);

 Promise.all([
 fetch('/api/anomalies').then(r => r.json()),
 fetch(`/api/history?zone_id=${zoneId}`).then(r => r.json()),
 ]).then(([anomaliesData, historyData]) => {
 const foundZone = anomaliesData.all_zones.find((z: any) => z.zone_id === zoneId);
 setZone(foundZone ?? null);
 setHistory(historyData.history ?? []);
 setLoading(false);
 });
 }, [zoneId]);

 const handleAction = async (action: string) => {
 if (!zoneId) return;
 await fetch('/api/decisions', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 operator_id: 'ramesh_op',
 action,
 record_type: 'anomaly',
 record_id: zoneId,
 comment: `Operator triggered ${action} on ${zone?.zone_name}`,
 }),
 });
 setActionLogged(action);
 };

 return (
 <AnimatePresence>
 {zoneId && (
 <>
 {/* Dark backdrop — covers whole viewport but sits BELOW the sidebar (sidebar is z-30) */}
 <motion.div
 key="backdrop"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={onClose}
 className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40"
 />

 {/* Modal — centered in viewport below the top bars (~160px) */}
 <motion.div
 key="panel"
 initial={{ opacity: 0, scale: 0.95, y: 16 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 16 }}
 transition={{ type: 'spring', stiffness: 320, damping: 30 }}
 className="fixed z-50 left-0 right-0 flex justify-center pointer-events-none"
 style={{ top: '168px', bottom: '16px' }}
 >
 <div
 className="pointer-events-auto w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
 style={{ maxHeight: '88vh' }}
 onClick={e => e.stopPropagation()}
 >
 {/* Header */}
 <div className={`px-6 py-4 border-b flex items-start justify-between ${zone ? SEVERITY_BG[zone.severity] ?? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
 <div>
 <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-0.5">
 {loading ? '…' : zone?.zone_id}
 </p>
 <h2 className="text-xl font-semibold text-slate-900">
 {loading ? 'Loading…' : zone?.zone_name ?? 'Zone not found'}
 </h2>
 </div>
 <button
 onClick={onClose}
 className="p-1.5 rounded-full hover:bg-slate-200/70 text-slate-800 hover:text-slate-800 transition-colors"
 >
 <X size={18} />
 </button>
 </div>

 {/* Body — scrollable */}
 <div className="overflow-y-auto flex-1">
 {loading || !zone ? (
 <div className="flex items-center justify-center h-48 text-slate-900 text-sm">
 Loading zone data…
 </div>
 ) : (
 <div className="p-6 flex flex-col gap-6">
 {/* Status row */}
 <div className="flex items-start gap-4">
 <Badge severity={zone.severity} />
 <div className="flex-1">
 <p className="text-sm text-slate-900 mb-1">
 Anomaly score: <span className="font-mono font-semibold text-black">{zone.anomaly_score.toFixed(2)}</span>
 </p>
 <p className="text-sm text-slate-800 leading-relaxed">{zone.reason}</p>
 </div>
 </div>

 {/* Factor tags */}
 {zone.factors.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {zone.factors.map(f => (
 <span
 key={f}
 className="px-2.5 py-1 bg-slate-100 text-slate-900 text-xs font-semibold rounded-full uppercase tracking-wider"
 >
 {f}
 </span>
 ))}
 </div>
 )}

 {/* Key metrics */}
 <div className="grid grid-cols-3 gap-3">
 <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
 <p className="text-[10px] font-semibold text-slate-900 uppercase tracking-wider mb-1">Consumption</p>
 <p className="text-2xl font-mono font-bold text-slate-900">
 {zone.current_consumption_ML}
 <span className="text-xs font-sans text-slate-900 ml-1">ML/d</span>
 </p>
 </div>
 <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
 <p className="text-[10px] font-semibold text-slate-900 uppercase tracking-wider mb-1">Pressure</p>
 <p className="text-2xl font-mono font-bold text-slate-900">
 {zone.pressure_bar.toFixed(1)}
 <span className="text-xs font-sans text-slate-900 ml-1">bar</span>
 </p>
 </div>
 <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
 <p className="text-[10px] font-semibold text-slate-900 uppercase tracking-wider mb-1">Supplied</p>
 <p className={`text-2xl font-mono font-bold ${zone.fulfillment_pct >= 80 ? 'text-emerald-700' : 'text-red-600'}`}>
 {zone.fulfillment_pct}
 <span className="text-xs font-sans text-slate-900 ml-0.5">%</span>
 </p>
 </div>
 </div>

 {/* 30-day chart */}
 <div>
 <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">30-Day Consumption History</h3>
 <div className="h-48">
 <ConsumptionChart data={history} />
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Action bar */}
 {!loading && zone && (
 <div className="px-6 py-4 border-t border-slate-100 bg-white flex gap-3">
 {actionLogged ? (
 <div className="flex-1 flex items-center gap-2 py-2.5 px-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium border border-emerald-100">
 <CheckCircle size={16} weight="fill" />
 Action logged: <strong>{actionLogged}</strong>
 </div>
 ) : (
 <>
 <button
 onClick={() => handleAction('Investigate')}
 className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
 >
 <MagnifyingGlass size={15} />
 Investigate
 </button>
 <button
 onClick={() => handleAction('Acknowledge')}
 className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-black text-sm font-semibold rounded-xl transition-colors"
 >
 <Warning size={15} />
 Acknowledge
 </button>
 </>
 )}
 </div>
 )}
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 );
}
