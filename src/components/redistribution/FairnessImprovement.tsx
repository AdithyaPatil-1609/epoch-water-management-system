'use client';

import { motion } from 'framer-motion';
import { TrendDown, TrendUp } from '@phosphor-icons/react';

interface Props {
  before: number;  // Gini coefficient before (0–1)
  after: number;   // Gini coefficient after  (0–1)
}

/**
 * Compact before→after Gini comparison badge for the redistribution view.
 * Shows raw Gini values and the percentage improvement.
 */
export function FairnessImprovement({ before, after }: Props) {
  const improvement_pct = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
  const improved = after < before;

  return (
    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl border border-blue-100">
      {/* Before */}
      <div className="text-center min-w-[64px]">
        <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-1">Before</p>
        <p className="text-2xl font-mono font-bold text-orange-600">{(before * 100).toFixed(1)}%</p>
        <p className="text-[10px] text-slate-800">Gini (unfair)</p>
      </div>

      {/* Animated arrow */}
      <motion.div
        animate={{ x: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        className="text-2xl text-blue-400 select-none"
      >
        →
      </motion.div>

      {/* After */}
      <div className="text-center min-w-[64px]">
        <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-1">After</p>
        <p className="text-2xl font-mono font-bold text-emerald-600">{(after * 100).toFixed(1)}%</p>
        <p className="text-[10px] text-slate-800">Gini (fair)</p>
      </div>

      {/* Gain badge */}
      <div className="ml-auto text-right">
        <div className={`flex items-center justify-end gap-1 text-xl font-bold ${improved ? 'text-emerald-600' : 'text-red-500'}`}>
          {improved ? <TrendDown size={18} weight="bold" /> : <TrendUp size={18} weight="bold" />}
          {improved ? '-' : '+'}{Math.abs(improvement_pct)}%
        </div>
        <p className="text-[10px] text-slate-800">
          {improved ? 'Equity gain' : 'Equity loss'}
        </p>
      </div>
    </div>
  );
}
