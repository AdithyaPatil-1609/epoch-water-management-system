'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
 ArrowRight,
 TrendUp,
 TrendDown,
 Minus,
 Warning,
 CheckCircle,
 XCircle,
 Scales,
 Drop,
 ArrowsClockwise,
 CaretDown,
} from '@phosphor-icons/react';
import { GiniGauge } from '@/components/charts/GiniGauge';
import { FairnessChip } from '@/components/dashboard/FairnessCard';
import type { FairnessMetrics, RedistributionProposal } from '@/lib/redistribution-engine';
import type { ProposalFairness } from '@/lib/fairness-engine';
import { FairnessImprovement } from '@/components/redistribution/FairnessImprovement';

// ─── Types ───────────────────────────────────────────────────

interface EnrichedProposal extends RedistributionProposal {
 fairness?: ProposalFairness | null;
 pressure_after_bar?: number;
 pressure_before_bar?: number;
 pressure_safe?: boolean;
 constraint_violated?: string | null;
}

interface ApiResponse {
 baseline_fairness: FairnessMetrics;
 projected_fairness: FairnessMetrics;
 gini_improvement_percent: number;
 current_gini: number;
 projected_gini: number;
 deficit_count: number;
 surplus_count: number;
 proposals: EnrichedProposal[];
}

// ─── Fairness Comparison Panel ───────────────────────────────

function MetricBox({
 label,
 before,
 after,
 format,
 lowerIsBetter = false,
}: {
 label: string;
 before: number;
 after: number;
 format: (v: number) => string;
 lowerIsBetter?: boolean;
}) {
 const improved = lowerIsBetter ? after < before : after > before;
 const delta = after - before;
 const Icon = improved ? TrendDown : delta === 0 ? Minus : TrendUp;
 const color = improved ? 'text-emerald-600' : delta === 0 ? 'text-slate-800' : 'text-red-500';

 return (
 <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
 <p className="text-xs font-medium text-slate-800 uppercase tracking-wider mb-2">{label}</p>
 <div className="flex items-baseline gap-2">
 <span className="text-xl font-mono font-semibold text-slate-800 line-through">{format(before)}</span>
 <span className="text-slate-300">→</span>
 <span className="text-2xl font-mono font-bold text-slate-900">{format(after)}</span>
 </div>
 <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${color}`}>
 <Icon size={12} weight="bold" />
 <span>
 {delta === 0 ? 'No change' : `${improved ? '' : '+'}${format(Math.abs(delta))} ${improved ? 'improvement' : 'regression'}`}
 </span>
 </div>
 </div>
 );
}

function FairnessComparison({
 baseline,
 projected,
 improvementPct,
}: {
 baseline: FairnessMetrics;
 projected: FairnessMetrics;
 improvementPct: number;
}) {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <div className="flex items-center justify-between mb-5">
 <h2 className="font-semibold text-slate-900 flex items-center gap-2">
 <Scales size={18} weight="duotone" className="text-emerald-600" />
 Fairness Impact Summary
 </h2>
 {improvementPct > 0 ? (
 <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
 ↓ {improvementPct}% Gini improvement
 </span>
 ) : (
 <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-900">
 System balanced
 </span>
 )}
 </div>
 <div className="grid grid-cols-2 gap-3">
 <MetricBox
 label="Gini Coefficient"
 before={baseline.gini_coefficient}
 after={projected.gini_coefficient}
 format={v => v.toFixed(3)}
 lowerIsBetter
 />
 <MetricBox
 label="Avg Zone Fulfillment"
 before={baseline.mean_fulfillment}
 after={projected.mean_fulfillment}
 format={v => `${Math.round(v * 100)}%`}
 />
 <MetricBox
 label="Min Zone Fulfillment"
 before={baseline.min_fulfillment}
 after={projected.min_fulfillment}
 format={v => `${Math.round(v * 100)}%`}
 />
 <MetricBox
 label="Fulfillment Variance"
 before={baseline.std_dev_fulfillment}
 after={projected.std_dev_fulfillment}
 format={v => `${(v * 100).toFixed(1)}%`}
 lowerIsBetter
 />
 </div>
 </div>
 );
}

// ─── Proposal Card ───────────────────────────────────────────

function ProposalCard({
 proposal,
 onApprove,
 onReject,
}: {
 proposal: EnrichedProposal;
 onApprove: (p: EnrichedProposal) => void;
 onReject: (id: string) => void;
}) {
 const [expanded, setExpanded] = useState(false);

 const feasibilityStyle = {
 safe: 'bg-emerald-100 text-emerald-800 border-emerald-200',
 risky: 'bg-yellow-100 text-yellow-800 border-yellow-200',
 infeasible: 'bg-red-100 text-red-800 border-red-200',
 }[proposal.feasibility];

 const borderColor = {
 safe: 'border-l-emerald-500',
 risky: 'border-l-yellow-400',
 infeasible: 'border-l-red-400',
 }[proposal.feasibility];

 return (
 <motion.div
 layout
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, x: -20 }}
 transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
 className={`border-l-4 ${borderColor} border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden`}
 >
 {/* Header */}
 <div className="p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3 font-semibold text-slate-900">
 <span className="text-sm font-mono font-bold">{proposal.source_zone}</span>
 <ArrowRight size={14} className="text-slate-900 shrink-0" />
 <span className="text-sm font-mono font-bold">{proposal.dest_zone}</span>
 </div>
 <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${feasibilityStyle}`}>
 {proposal.feasibility}
 </span>
 </div>

 {/* Metrics grid */}
 <div className="grid grid-cols-3 gap-3 mb-3">
 <div className="bg-slate-50 rounded-lg p-2.5">
 <p className="text-[10px] font-medium text-slate-800 uppercase tracking-wider mb-1">Volume</p>
 <p className="text-base font-mono font-bold text-slate-900">
 {proposal.volume_ML} <span className="text-xs font-sans text-slate-800">ML/d</span>
 </p>
 </div>
 <div className="bg-slate-50 rounded-lg p-2.5">
 <p className="text-[10px] font-medium text-slate-800 uppercase tracking-wider mb-1">Pressure</p>
 <p className={`text-base font-mono font-bold ${proposal.pressure_impact >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
 {proposal.pressure_impact > 0 ? '+' : ''}{proposal.pressure_impact.toFixed(2)}
 <span className="text-xs font-sans text-slate-800"> bar</span>
 </p>
 </div>
 <div className="bg-slate-50 rounded-lg p-2.5">
 <p className="text-[10px] font-medium text-slate-800 uppercase tracking-wider mb-1">Fairness Gain</p>
 <p className="text-base font-mono font-bold text-emerald-700">
 {(proposal.fairness_gain * 100).toFixed(1)}%
 </p>
 </div>
 </div>

 {/* Pressure Gauge */}
 <div className="mb-3">
 <div className="flex items-center justify-between mb-1">
 <p className="text-[10px] font-medium text-slate-800 uppercase tracking-wider">Pressure After Transfer</p>
 <span className={`text-xs font-mono font-semibold ${
 (proposal.pressure_after_bar ?? 2) >= 2.0 ? 'text-emerald-600'
 : (proposal.pressure_after_bar ?? 2) >= 1.5 ? 'text-yellow-600'
 : 'text-red-600'
 }`}>
 {(proposal.pressure_after_bar ?? proposal.pressure_impact + 2.5).toFixed(1)} bar
 </span>
 </div>
 <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
 <div
 style={{ width: `${Math.min(((proposal.pressure_after_bar ?? 2) / 4) * 100, 100)}%` }}
 className={`h-full rounded-full transition-all ${
 (proposal.pressure_after_bar ?? 2) >= 2.0 ? 'bg-emerald-500'
 : (proposal.pressure_after_bar ?? 2) >= 1.5 ? 'bg-yellow-400'
 : 'bg-red-500'
 }`}
 />
 </div>
 {proposal.pressure_safe === false && (
 <p className="text-red-600 text-[10px] mt-1 font-medium">⚠ Below safe minimum (1.5 bar)</p>
 )}
 </div>

 {/* Reason */}
 <p className="text-xs text-slate-900 bg-blue-50 border border-blue-100 rounded-lg p-2.5 mb-3">
 {proposal.reason}
 </p>

 {/* Fairness chip from engine */}
 {proposal.fairness && (
 <div className="mb-3">
 <FairnessChip fairness={proposal.fairness} />
 </div>
 )}

 {/* Score */}
 <div className="flex items-center justify-between mb-3">
 <span className="text-xs text-slate-900 font-mono">
 Score: {proposal.multi_objective_score.toFixed(3)}
 </span>
 <button
 onClick={() => setExpanded(v => !v)}
 className="flex items-center gap-1 text-xs text-slate-800 hover:text-slate-800 transition-colors"
 >
 <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: 'spring' as const, stiffness: 200, damping: 25 }}>
 <CaretDown size={13} />
 </motion.span>
 {expanded ? 'Hide' : 'Full analysis'}
 </button>
 </div>

 {/* Action buttons */}
 <div className="flex gap-2">
 <button
 onClick={() => onApprove(proposal)}
 disabled={proposal.feasibility === 'infeasible'}
 className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-900 text-white text-sm font-semibold py-2 px-3 rounded-lg transition-colors"
 >
 <CheckCircle size={15} weight="fill" />
 Approve
 </button>
 <button
 onClick={() => onReject(proposal.proposal_id)}
 className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
 >
 <XCircle size={15} />
 Reject
 </button>
 </div>
 </div>

 {/* Expanded fairness detail */}
 <AnimatePresence>
 {expanded && proposal.fairness && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ type: 'spring' as const, stiffness: 120, damping: 22 }}
 className="overflow-hidden border-t border-slate-100 bg-slate-50/60 p-4"
 >
 <p className="text-xs font-medium text-slate-800 uppercase tracking-wider mb-2">Zone Fulfillment Impact</p>
 <div className="space-y-2">
 {proposal.fairness.zone_details
 .filter(z => Math.abs(z.delta_pct) > 0)
 .slice(0, 5)
 .map(z => (
 <div key={z.zone_id}>
 <div className="flex items-center justify-between text-xs mb-1">
 <span className="text-black font-medium truncate max-w-[140px]">{z.zone_name}</span>
 <span className={`font-mono font-semibold ${z.delta_pct > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
 {z.before_fulfillment_pct}% → {z.after_fulfillment_pct}%
 <span className="text-[10px] ml-1">({z.delta_pct > 0 ? '+' : ''}{z.delta_pct}pp)</span>
 </span>
 </div>
 <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
 <motion.div
 initial={{ width: `${z.before_fulfillment_pct}%` }}
 animate={{ width: `${z.after_fulfillment_pct}%` }}
 transition={{ type: 'spring' as const, stiffness: 80, damping: 18 }}
 className={`h-full rounded-full ${z.after_fulfillment_pct >= 90 ? 'bg-emerald-500' : z.after_fulfillment_pct >= 80 ? 'bg-yellow-400' : 'bg-orange-400'}`}
 />
 </div>
 </div>
 ))}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
}

// ─── Main Page ────────────────────────────────────────────────

export default function RedistributionPage() {
 const searchParams = useSearchParams();
 const investigateZone = searchParams.get('zone'); // e.g. "Zone-A"
 const investigateRef = useRef<HTMLDivElement>(null);

 const [fairnessWeight, setFairnessWeight] = useState(0.7);
 const [data, setData] = useState<ApiResponse | null>(null);
 const [loading, setLoading] = useState(true);

 const fetchProposals = useCallback((weight: number) => {
 setLoading(true);
 fetch(`/api/redistribute?fairness_weight=${weight}`)
 .then(res => res.json())
 .then(d => { setData(d); setLoading(false); })
 .catch(() => setLoading(false));
 }, []);

 useEffect(() => { fetchProposals(fairnessWeight); }, []);

 // Scroll to investigate section after data loads
 useEffect(() => {
  if (investigateZone && investigateRef.current && data) {
   setTimeout(() => investigateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }
 }, [investigateZone, data]);

 const handleApprove = async (prop: EnrichedProposal) => {
 await fetch('/api/decisions', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 operator_id: 'manager_demo',
 action: 'Approve',
 record_type: 'proposal',
 record_id: prop.proposal_id,
 source_zone: prop.source_zone,
 dest_zone: prop.dest_zone,
 volume_ML: prop.volume_ML,
 comment: 'Approved via Redistribution Dashboard',
 }),
 });
 setData(prev => prev ? { ...prev, proposals: prev.proposals.filter(p => p.proposal_id !== prop.proposal_id) } : null);
 setTimeout(() => fetchProposals(fairnessWeight), 600);
 };

 const handleReject = (id: string) => {
 setData(prev => prev ? { ...prev, proposals: prev.proposals.filter(p => p.proposal_id !== id) } : null);
 };

 const handleBulkApprove = async () => {
 if (!data) return;
 const safe = data.proposals.filter(p => p.feasibility === 'safe');
 for (const p of safe) await handleApprove(p);
 };

 if (!data && loading) {
 return (
 <div className="flex min-h-[100dvh] items-center justify-center bg-[#f9fafb]">
 <div className="flex flex-col items-center gap-3 text-slate-900">
 <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
 <span className="text-sm font-medium">Loading Optimization Engine…</span>
 </div>
 </div>
 );
 }

 if (!data) return null;

 const safeCount = data.proposals.filter(p => p.feasibility === 'safe').length;

 // Proposals involving the investigated zone (pinned to top)
 const zoneProposals = investigateZone
  ? data.proposals.filter(p => p.source_zone === investigateZone || p.dest_zone === investigateZone)
  : [];
 const otherProposals = investigateZone
  ? data.proposals.filter(p => p.source_zone !== investigateZone && p.dest_zone !== investigateZone)
  : data.proposals;

 return (
 <div className="flex flex-col min-h-[100dvh] bg-[#f9fafb]">
 {/* Page header */}
 <div className="w-full border-b border-slate-200 bg-white">
 <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Drop size={20} weight="duotone" className="text-emerald-600" />
 <h1 className="text-xl font-medium tracking-tight text-slate-900">Fairness Optimization</h1>
   {investigateZone && (
    <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
     🔍 Investigating {investigateZone}
    </span>
   )}
 {data.deficit_count > 0 && (
 <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
 {data.deficit_count} Deficit Zone{data.deficit_count !== 1 ? 's' : ''}
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 {safeCount > 1 && (
 <button
 onClick={handleBulkApprove}
 className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
 >
 <CheckCircle size={15} weight="fill" />
 Approve All Safe ({safeCount})
 </button>
 )}
 <button
 onClick={() => fetchProposals(fairnessWeight)}
 className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
 >
 <ArrowsClockwise size={15} className={loading ? 'animate-spin' : ''} />
 Refresh
 </button>
 </div>
 </div>
 </div>

 <main className="flex-1 w-full max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

 {/* Left Column */}
 <section className="lg:col-span-5 flex flex-col gap-6">
 {/* Gini Gauge */}
 <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
 <h2 className="text-sm font-semibold text-black uppercase tracking-wider self-start mb-4">Network Equality</h2>
 <div className="h-48 w-full max-w-xs">
 <GiniGauge value={data.current_gini} />
 </div>
 {data.projected_gini < data.current_gini && (
 <div className="mt-4 w-full py-3 px-4 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-800 flex justify-between items-center">
 <span>Projected Gini after proposals</span>
 <span className="font-mono font-semibold">{data.projected_gini.toFixed(3)}</span>
 </div>
 )}
 </div>

 {/* Fairness Comparison */}
 {data.baseline_fairness && (
 <FairnessComparison
 baseline={data.baseline_fairness}
 projected={data.projected_fairness}
 improvementPct={data.gini_improvement_percent}
 />
 )}

 {/* Fairness Improvement Badge */}
 {data.baseline_fairness && data.projected_fairness && data.gini_improvement_percent > 0 && (
 <FairnessImprovement
 before={data.baseline_fairness.gini_coefficient}
 after={data.projected_fairness.gini_coefficient}
 />
 )}

 {/* Capacity Status + Weight Slider */}
 <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
 <h3 className="font-semibold text-slate-900 mb-4">Capacity Status</h3>
 <div className="flex justify-between items-center mb-6">
 <div className="text-center">
 <div className="text-3xl font-mono text-emerald-600">{data.surplus_count}</div>
 <div className="text-xs uppercase tracking-widest text-slate-800 mt-1">Surplus Zones</div>
 </div>
 <div className="w-px h-12 bg-slate-200" />
 <div className="text-center">
 <div className="text-3xl font-mono text-orange-600">{data.deficit_count}</div>
 <div className="text-xs uppercase tracking-widest text-slate-800 mt-1">Deficit Zones</div>
 </div>
 </div>

 <div className="pt-4 border-t border-slate-100">
 <div className="flex justify-between items-center mb-2">
 <label className="text-sm font-medium text-black">Optimization Weight</label>
 <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-900">{fairnessWeight.toFixed(2)}</span>
 </div>
 <input
 type="range" min="0" max="1" step="0.1"
 value={fairnessWeight}
 onChange={e => { const w = parseFloat(e.target.value); setFairnessWeight(w); fetchProposals(w); }}
 className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
 />
 <div className="flex justify-between text-xs text-slate-800 mt-2">
 <span>Pressure Safety</span>
 <span>Fairness / Equity</span>
 </div>
 </div>
 </div>
 </section>

 {/* Right Column — Proposals */}
 <section className="lg:col-span-7">
 <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-full">
 <h2 className="text-lg font-semibold text-slate-900 mb-5">
 Recommended Actions
 {data.proposals.length > 0 && (
 <span className="ml-2 text-sm font-normal text-slate-800">
 ({data.proposals.length} proposal{data.proposals.length !== 1 ? 's' : ''})
 </span>
 )}
 </h2>

    {/* Investigated zone proposals pinned at top */}
    {investigateZone && zoneProposals.length > 0 && (
     <div ref={investigateRef} className="mb-5">
      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
       <Warning size={15} weight="fill" className="text-amber-600" />
       <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
        Active redistributions involving {investigateZone}
       </span>
      </div>
      <div className="space-y-3 border-l-4 border-amber-400 pl-3">
       <AnimatePresence mode="popLayout">
        {zoneProposals.map(p => (
         <ProposalCard key={p.proposal_id} proposal={p} onApprove={handleApprove} onReject={handleReject} />
        ))}
       </AnimatePresence>
      </div>
     </div>
    )}

    {otherProposals.length === 0 && zoneProposals.length === 0 ? (
 <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
 <CheckCircle size={16} weight="fill" />
 No active proposals. All zones are balanced.
 </div>
 ) : (
 <AnimatePresence mode="popLayout">
 <div className="space-y-4">
 {otherProposals.map(p => (
 <ProposalCard
 key={p.proposal_id}
 proposal={p}
 onApprove={handleApprove}
 onReject={handleReject}
 />
 ))}
 </div>
 </AnimatePresence>
 )}
 </div>
 </section>
 </main>
 </div>
 );
}
