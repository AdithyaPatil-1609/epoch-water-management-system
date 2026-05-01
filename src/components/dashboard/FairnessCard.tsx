'use client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Minus,
  CheckCircle,
  Warning,
  XCircle,
  DropHalf,
} from '@phosphor-icons/react';
import { ProposalFairness, interpretationLabel } from '@/lib/fairness-engine';

interface FairnessCardProps {
  fairness: ProposalFairness | null;
  sourceName: string;
  destName: string;
  volumeML: number;
}

const statusColors: Record<string, string> = {
  critical: 'text-red-700 bg-red-50 border-red-200',
  deficit: 'text-orange-700 bg-orange-50 border-orange-200',
  balanced: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  surplus: 'text-blue-700 bg-blue-50 border-blue-200',
};

const interpretColors: Record<string, { ring: string; badge: string; icon: string }> = {
  excellent: { ring: 'ring-emerald-200 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800', icon: 'text-emerald-600' },
  good:      { ring: 'ring-emerald-200 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800', icon: 'text-emerald-600' },
  fair:      { ring: 'ring-yellow-200 bg-yellow-50',   badge: 'bg-yellow-100 text-yellow-800',   icon: 'text-yellow-600' },
  poor:      { ring: 'ring-orange-200 bg-orange-50',   badge: 'bg-orange-100 text-orange-800',   icon: 'text-orange-600' },
  critical:  { ring: 'ring-red-200 bg-red-50',         badge: 'bg-red-100 text-red-800',         icon: 'text-red-600' },
};

function FairnessScore({ score }: { score: number }) {
  const color = score >= 75 ? 'text-emerald-600' : score >= 55 ? 'text-yellow-600' : score >= 35 ? 'text-orange-600' : 'text-red-600';
  return (
    <span className={`text-5xl font-mono font-semibold tracking-tighter ${color}`}>
      {score}
    </span>
  );
}

export function FairnessCard({ fairness, sourceName, destName, volumeML }: FairnessCardProps) {
  if (!fairness) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-400 flex items-center gap-2">
        <Warning size={18} />
        Fairness metrics unavailable — ranking by pressure efficiency
      </div>
    );
  }

  const interp = fairness.fairness_interpretation;
  const colors = interpretColors[interp] ?? interpretColors.fair;
  const improvPct = fairness.gini_improvement_pct;
  const improved = improvPct > 0;
  const noChange = improvPct === 0;

  const ImprovIcon = improved ? ArrowDown : noChange ? Minus : ArrowUp;
  const impovColor = improved ? 'text-emerald-600' : noChange ? 'text-slate-500' : 'text-red-500';

  // Top 5 zones with largest fulfillment change for the bar chart
  const highlightZones = [...fairness.zone_details]
    .filter(z => Math.abs(z.delta_pct) > 0 || z.before_fulfillment_pct < 100)
    .sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
    .slice(0, 6);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring' as const, stiffness: 120, damping: 22 }}
        className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between ring-1 ${colors.ring}`}>
          <div className="flex items-center gap-2.5">
            <DropHalf size={20} weight="duotone" className={colors.icon} />
            <span className="font-medium text-slate-900">Fairness Impact</span>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${colors.badge}`}>
            {interpretationLabel(interp)}
          </span>
        </div>

        {/* Main metrics row */}
        <div className="px-5 py-5 grid grid-cols-3 gap-4 border-b border-slate-100">
          {/* Fairness score */}
          <div className="flex flex-col items-center justify-center text-center">
            <FairnessScore score={fairness.fairness_score} />
            <span className="text-xs uppercase tracking-widest text-slate-500 mt-1">Fairness Score</span>
          </div>

          {/* Gini before → after */}
          <div className="flex flex-col items-center justify-center text-center border-x border-slate-100 px-3">
            <div className="flex items-center gap-2 text-slate-700 font-mono text-sm">
              <span className="text-slate-500">{fairness.gini_before.toFixed(3)}</span>
              <ImprovIcon size={14} className={impovColor} />
              <span className="font-semibold text-slate-900">{fairness.gini_after.toFixed(3)}</span>
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500 mt-1">Gini Coefficient</span>
            {improved && (
              <span className="mt-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                +{improvPct}% improvement
              </span>
            )}
          </div>

          {/* City avg fulfillment */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-2xl font-mono font-semibold text-slate-900">
              {fairness.city_avg_fulfillment_after}
              <span className="text-base font-sans text-slate-500">%</span>
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500 mt-1">City Avg Fulfillment</span>
            {fairness.city_avg_fulfillment_after > fairness.city_avg_fulfillment_before && (
              <span className="mt-1.5 text-xs text-emerald-700 font-medium">
                +{fairness.city_avg_fulfillment_after - fairness.city_avg_fulfillment_before}pp
              </span>
            )}
          </div>
        </div>

        {/* Zone fulfillment bar chart */}
        {highlightZones.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Demand Fulfillment — Affected Zones
            </p>
            <div className="space-y-2.5">
              {highlightZones.map((z) => (
                <div key={z.zone_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]" title={z.zone_name}>
                      {z.zone_name}
                    </span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-xs font-mono text-slate-400">{z.before_fulfillment_pct}%</span>
                      <span className="text-xs text-slate-300">→</span>
                      <span className={`text-xs font-mono font-semibold ${z.delta_pct > 0 ? 'text-emerald-700' : z.delta_pct < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {z.after_fulfillment_pct}%
                      </span>
                      {z.delta_pct !== 0 && (
                        <span className={`text-[10px] font-mono ${z.delta_pct > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          ({z.delta_pct > 0 ? '+' : ''}{z.delta_pct}pp)
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Bar track */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: `${z.before_fulfillment_pct}%` }}
                      animate={{ width: `${z.after_fulfillment_pct}%` }}
                      transition={{ type: 'spring' as const, stiffness: 80, damping: 18, delay: 0.1 }}
                      className={`h-full rounded-full ${
                        z.after_fulfillment_pct >= 90 ? 'bg-emerald-500' :
                        z.after_fulfillment_pct >= 80 ? 'bg-yellow-400' :
                        z.after_fulfillment_pct >= 60 ? 'bg-orange-400' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zones below threshold */}
        {fairness.zones_below_80_after.length > 0 && (
          <div className="px-5 pb-4">
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-lg">
              <Warning size={16} className="text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-800">
                <span className="font-semibold">{fairness.zones_below_80_after.length} zone{fairness.zones_below_80_after.length > 1 ? 's' : ''} still below 80% fulfillment</span>
                {' '}after transfer: {fairness.zones_below_80_after.slice(0, 3).join(', ')}{fairness.zones_below_80_after.length > 3 ? ` +${fairness.zones_below_80_after.length - 3} more` : ''}
              </p>
            </div>
          </div>
        )}

        {fairness.zones_below_80_after.length === 0 && fairness.zones_below_80_before.length > 0 && (
          <div className="px-5 pb-4">
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
              <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-800 font-medium">
                All zones reach ≥80% fulfillment after this transfer
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Compact inline variant for proposal queue cards
export function FairnessChip({ fairness }: { fairness: ProposalFairness | null }) {
  if (!fairness) {
    return (
      <div className="flex items-center gap-1 text-xs text-slate-400">
        <Warning size={12} />
        <span>Fairness: N/A</span>
      </div>
    );
  }

  const improved = fairness.gini_improvement_pct > 0;
  const Icon = improved ? ArrowDown : fairness.gini_improvement_pct < 0 ? ArrowUp : Minus;
  const color = improved ? 'text-emerald-700' : fairness.gini_improvement_pct < 0 ? 'text-red-600' : 'text-slate-500';

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icon size={12} weight="bold" />
      <span>
        {improved ? '+' : ''}{fairness.gini_improvement_pct}% fairness
      </span>
      <span className="text-slate-300">·</span>
      <span className="font-mono text-slate-500">
        {fairness.gini_before.toFixed(2)} → {fairness.gini_after.toFixed(2)}
      </span>
    </div>
  );
}
