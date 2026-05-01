'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
 Scales,
 TrendUp,
 TrendDown,
 Drop,
 Warning,
 CheckCircle,
 ArrowsClockwise,
} from '@phosphor-icons/react';
import { GiniGauge } from '@/components/charts/GiniGauge';
import { FairnessChart } from '@/components/charts/FairnessChart';
import {
 FairnessTrendPoint,
 interpretGini,
 interpretationLabel,
 interpretationColor,
 giniToFairnessScore,
} from '@/lib/fairness-engine';

interface TrendData {
 success: boolean;
 trend: FairnessTrendPoint[];
 current_gini: number;
 average_gini_30d: number;
 best_gini_30d: number;
 worst_gini_30d: number;
 zones_below_80_fulfillment: string[];
 city_avg_fulfillment_pct: number;
}

const statVariants = {
 hidden: { opacity: 0, y: 16 },
 visible: (i: number) => ({
 opacity: 1,
 y: 0,
 transition: { type: 'spring' as const, stiffness: 110, damping: 22, delay: i * 0.07 },
 }),
};

function StatCard({
 label,
 value,
 unit,
 sub,
 color,
 index,
}: {
 label: string;
 value: string | number;
 unit?: string;
 sub?: string;
 color?: string;
 index: number;
}) {
 return (
 <motion.div
 custom={index}
 variants={statVariants}
 initial="hidden"
 animate="visible"
 className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
 >
 <p className="text-xs font-medium uppercase tracking-wider text-slate-800 mb-2">{label}</p>
 <p className={`text-3xl font-mono font-semibold tracking-tight ${color ?? 'text-slate-900'}`}>
 {value}
 {unit && <span className="text-base font-sans text-slate-800 ml-1">{unit}</span>}
 </p>
 {sub && <p className="text-xs text-slate-900 mt-1">{sub}</p>}
 </motion.div>
 );
}

export default function FairnessPage() {
 const [data, setData] = useState<TrendData | null>(null);
 const [loading, setLoading] = useState(true);
 const [showFulfillment, setShowFulfillment] = useState(false);

 const fetchData = () => {
 setLoading(true);
 fetch('/api/fairness/trend?days=30')
 .then((r) => r.json())
 .then((d) => {
 setData(d);
 setLoading(false);
 })
 .catch(() => setLoading(false));
 };

 useEffect(() => {
 fetchData();
 }, []);

 if (loading) {
 return (
 <div className="flex min-h-[100dvh] items-center justify-center bg-[#f9fafb]">
 <div className="flex flex-col items-center gap-3 text-slate-900">
 <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
 <span className="text-sm font-medium">Loading Fairness Engine…</span>
 </div>
 </div>
 );
 }

 if (!data) {
 return (
 <div className="flex min-h-[100dvh] items-center justify-center bg-[#f9fafb]">
 <div className="text-sm text-red-500">Failed to load fairness data</div>
 </div>
 );
 }

 const interp = interpretGini(data.current_gini);
 const interpColor = interpretationColor(interp);
 const colorMap: Record<string, string> = {
 emerald: 'text-emerald-600',
 yellow: 'text-yellow-600',
 orange: 'text-orange-600',
 red: 'text-red-600',
 };

 const trend30d =
 data.trend.length >= 2
 ? data.trend[data.trend.length - 1].gini - data.trend[0].gini
 : 0;
 const TrendIcon = trend30d < -0.005 ? TrendDown : trend30d > 0.005 ? TrendUp : null;

 return (
 <div className="flex flex-col min-h-[100dvh] bg-[#f9fafb]">
 {/* Page Header */}
 <div className="w-full border-b border-slate-200 bg-white">
 <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Scales size={22} weight="duotone" className="text-emerald-600" />
 <h1 className="text-xl font-medium tracking-tight text-slate-900">Fairness Dashboard</h1>
 <span
 className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
 interp === 'excellent' || interp === 'good'
 ? 'bg-emerald-100 text-emerald-800'
 : interp === 'fair'
 ? 'bg-yellow-100 text-yellow-800'
 : interp === 'poor'
 ? 'bg-orange-100 text-orange-800'
 : 'bg-red-100 text-red-800'
 }`}
 >
 {interpretationLabel(interp)} Fairness
 </span>
 </div>
 <button
 onClick={fetchData}
 className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
 >
 <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
 Refresh
 </button>
 </div>
 </div>

 <main className="flex-1 w-full max-w-7xl mx-auto p-6 space-y-6">
 {/* Stats row */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <StatCard
 label="Current Gini"
 value={data.current_gini.toFixed(3)}
 sub={interpretationLabel(interp)}
 color={colorMap[interpColor]}
 index={0}
 />
 <StatCard
 label="Fairness Score"
 value={giniToFairnessScore(data.current_gini)}
 unit="/100"
 sub="Higher = more equitable"
 color={giniToFairnessScore(data.current_gini) >= 70 ? 'text-emerald-600' : 'text-orange-600'}
 index={1}
 />
 <StatCard
 label="City Avg Fulfillment"
 value={data.city_avg_fulfillment_pct}
 unit="%"
 sub="Across all 20 zones"
 color={data.city_avg_fulfillment_pct >= 90 ? 'text-emerald-600' : 'text-orange-600'}
 index={2}
 />
 <StatCard
 label="Zones Below 80%"
 value={data.zones_below_80_fulfillment.length}
 unit="zones"
 sub={
 data.zones_below_80_fulfillment.length === 0
 ? 'All zones well-served'
 : data.zones_below_80_fulfillment.slice(0, 2).join(', ') +
 (data.zones_below_80_fulfillment.length > 2
 ? ` +${data.zones_below_80_fulfillment.length - 2}`
 : '')
 }
 color={data.zones_below_80_fulfillment.length === 0 ? 'text-emerald-600' : 'text-orange-600'}
 index={3}
 />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 {/* Gini Gauge + interpretation */}
 <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
 <h2 className="text-sm font-semibold text-black uppercase tracking-wider mb-4">
 Network Equality Index
 </h2>

 <div className="h-48 w-full max-w-xs mx-auto">
 <GiniGauge value={data.current_gini} />
 </div>

 {/* 30d trend summary */}
 <div className="mt-6 space-y-2 text-sm">
 <div className="flex justify-between items-center py-2 border-b border-slate-100">
 <span className="text-slate-800">30d Average</span>
 <span className="font-mono font-medium text-slate-800">{data.average_gini_30d.toFixed(3)}</span>
 </div>
 <div className="flex justify-between items-center py-2 border-b border-slate-100">
 <span className="text-slate-800">Best (lowest)</span>
 <span className="font-mono font-medium text-emerald-700">{data.best_gini_30d.toFixed(3)}</span>
 </div>
 <div className="flex justify-between items-center py-2 border-b border-slate-100">
 <span className="text-slate-800">Worst (highest)</span>
 <span className="font-mono font-medium text-orange-600">{data.worst_gini_30d.toFixed(3)}</span>
 </div>
 <div className="flex justify-between items-center py-2">
 <span className="text-slate-800">30d Trend</span>
 <span
 className={`flex items-center gap-1 font-mono font-medium ${
 trend30d < 0 ? 'text-emerald-700' : trend30d > 0 ? 'text-red-600' : 'text-slate-800'
 }`}
 >
 {TrendIcon && <TrendIcon size={14} weight="bold" />}
 {trend30d < 0 ? 'Improving' : trend30d > 0 ? 'Worsening' : 'Stable'}
 </span>
 </div>
 </div>
 </div>

 {/* Trend Chart */}
 <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-sm font-semibold text-black uppercase tracking-wider">
 30-Day Gini Trend
 </h2>
 <button
 onClick={() => setShowFulfillment(!showFulfillment)}
 className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
 showFulfillment
 ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
 : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'
 }`}
 >
 {showFulfillment ? 'Hide' : 'Show'} Fulfillment overlay
 </button>
 </div>

 <div className="flex-1 min-h-[220px]">
 <FairnessChart data={data.trend} showFulfillment={showFulfillment} />
 </div>

 <div className="mt-4 flex items-center gap-4 text-xs text-slate-800">
 <div className="flex items-center gap-1.5">
 <div className="w-4 h-0.5 bg-emerald-500 rounded" />
 <span>Gini coefficient (left axis)</span>
 </div>
 {showFulfillment && (
 <div className="flex items-center gap-1.5">
 <div className="w-4 h-0.5 border-t-2 border-dashed border-indigo-400" />
 <span>Avg fulfillment % (right axis)</span>
 </div>
 )}
 <div className="flex items-center gap-1.5">
 <div className="w-4 h-0.5 border-t-2 border-dashed border-yellow-400" />
 <span>Fair threshold (0.25)</span>
 </div>
 </div>
 </div>
 </div>

 {/* Zones below 80% / alert panel */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Deficit zone list */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <h2 className="text-sm font-semibold text-black uppercase tracking-wider mb-4 flex items-center gap-2">
 <Drop size={16} weight="duotone" className="text-orange-500" />
 Zones Below 80% Fulfillment
 </h2>
 {data.zones_below_80_fulfillment.length === 0 ? (
 <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
 <CheckCircle size={16} weight="fill" />
 All zones are receiving ≥80% of baseline demand
 </div>
 ) : (
 <div className="space-y-2">
 {data.zones_below_80_fulfillment.map((zoneId, i) => (
 <motion.div
 key={zoneId}
 initial={{ opacity: 0, x: -8 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: i * 0.05 }}
 className="flex items-center justify-between px-3 py-2.5 bg-orange-50 border border-orange-100 rounded-lg"
 >
 <div className="flex items-center gap-2">
 <Warning size={14} className="text-orange-500" />
 <span className="text-sm font-medium text-orange-900">{zoneId}</span>
 </div>
 <span className="text-xs text-orange-700 font-mono">Below 80%</span>
 </motion.div>
 ))}
 </div>
 )}
 </div>

 {/* Gini interpretation guide */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <h2 className="text-sm font-semibold text-black uppercase tracking-wider mb-4">
 Fairness Interpretation Guide
 </h2>
 <div className="space-y-2.5 text-sm">
 {[
 { range: '0.00 – 0.15', label: 'Excellent', desc: 'Near-perfect equity across all zones', color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
 { range: '0.15 – 0.25', label: 'Good', desc: 'Minor inequality; most zones well-served', color: 'border-emerald-300 bg-emerald-50/60 text-emerald-700' },
 { range: '0.25 – 0.35', label: 'Fair', desc: 'Moderate inequality; redistribution recommended', color: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
 { range: '0.35 – 0.45', label: 'Poor', desc: 'Significant inequality; prioritize transfers', color: 'border-orange-400 bg-orange-50 text-orange-800' },
 { range: '> 0.45', label: 'Critical', desc: 'Severe inequality; immediate action required', color: 'border-red-400 bg-red-50 text-red-800' },
 ].map((row) => (
 <div key={row.range} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${row.color}`}>
 <span className="font-mono text-xs shrink-0 w-20">{row.range}</span>
 <span className="font-semibold text-xs shrink-0 w-14">{row.label}</span>
 <span className="text-xs opacity-80">{row.desc}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </main>
 </div>
 );
}
