'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CaretDown } from '@phosphor-icons/react/dist/ssr';
import { RedistributionProposal } from '@/lib/fairness';
import { ProposalFairness } from '@/lib/fairness-engine';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FairnessCard, FairnessChip } from './FairnessCard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } }
};

// Enriched proposal type returned from /api/redistribute
export interface EnrichedProposal extends RedistributionProposal {
  fairness?: ProposalFairness | null;
}

interface ProposalQueueProps {
  proposals: EnrichedProposal[];
  onApprove?: (prop: EnrichedProposal) => void;
}

function ProposalCard({ prop, onApprove }: { prop: EnrichedProposal; onApprove?: (prop: EnrichedProposal) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      variants={itemVariants}
      className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden group"
    >
      {/* Card header */}
      <div className="p-4 relative">
        {prop.feasibility === 'safe' && (
          <div className="absolute inset-0 bg-emerald-50/0 group-hover:bg-emerald-50/20 transition-colors pointer-events-none" />
        )}

        <div className="flex justify-between items-start mb-3 relative z-10">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-900">
            <span className="truncate max-w-[120px]" title={prop.source_name}>{prop.source_zone}</span>
            <ArrowRight className="text-slate-400 shrink-0" />
            <span className="truncate max-w-[120px]" title={prop.dest_name}>{prop.dest_zone}</span>
          </div>
          <StatusBadge status={prop.feasibility} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Volume</div>
            <div className="text-lg font-mono text-slate-900">+{prop.volume_ML} <span className="text-sm font-sans text-slate-500">ML/d</span></div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Fairness Gain</div>
            <div className="text-lg font-mono text-emerald-600">{(prop.gini_improvement * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* Fairness chip */}
        {prop.fairness !== undefined && (
          <div className="mb-3 relative z-10">
            <FairnessChip fairness={prop.fairness ?? null} />
          </div>
        )}

        <div className="flex gap-2 relative z-10">
          {onApprove && (
            <Button size="sm" onClick={() => onApprove(prop)} className="flex-1">
              Approve
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="px-3 flex items-center gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring' as const, stiffness: 200, damping: 25 }}
            >
              <CaretDown size={14} />
            </motion.span>
            {expanded ? 'Hide' : 'Fairness'}
          </Button>
        </div>
      </div>

      {/* Expandable fairness card */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring' as const, stiffness: 120, damping: 22 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="p-4 bg-slate-50/60">
              <FairnessCard
                fairness={prop.fairness ?? null}
                sourceName={prop.source_name}
                destName={prop.dest_name}
                volumeML={prop.volume_ML}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ProposalQueue({ proposals, onApprove }: ProposalQueueProps) {
  if (proposals.length === 0) {
    return <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg">No active proposals. System is balanced.</div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {proposals.map((prop) => (
        <ProposalCard key={prop.proposal_id} prop={prop} onApprove={onApprove} />
      ))}
    </motion.div>
  );
}
