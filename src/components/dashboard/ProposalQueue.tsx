'use client';
import { motion } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { RedistributionProposal } from '@/lib/fairness';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } }
};

interface ProposalQueueProps {
  proposals: RedistributionProposal[];
  onApprove?: (id: string) => void;
}

export function ProposalQueue({ proposals, onApprove }: ProposalQueueProps) {
  if (proposals.length === 0) {
    return <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg">No active proposals. System is balanced.</div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {proposals.map((prop) => (
        <motion.div 
          key={prop.proposal_id} 
          variants={itemVariants}
          className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          {/* Subtle green tint on hover for safe proposals */}
          {prop.feasibility === 'safe' && (
            <div className="absolute inset-0 bg-emerald-50/0 group-hover:bg-emerald-50/30 transition-colors pointer-events-none" />
          )}

          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-900">
              <span className="truncate max-w-[120px]" title={prop.source_name}>{prop.source_zone}</span>
              <ArrowRight className="text-slate-400" />
              <span className="truncate max-w-[120px]" title={prop.dest_name}>{prop.dest_zone}</span>
            </div>
            <StatusBadge status={prop.feasibility} />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 relative z-10">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Volume</div>
              <div className="text-lg font-mono text-slate-900">+{prop.volume_ML} <span className="text-sm font-sans text-slate-500">ML/d</span></div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Fairness Gain</div>
              <div className="text-lg font-mono text-emerald-600">{(prop.gini_improvement * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div className="flex gap-2 relative z-10">
            {onApprove && (
              <Button size="sm" onClick={() => onApprove(prop.proposal_id)} className="w-full">
                Approve
              </Button>
            )}
            <Button size="sm" variant="outline" className="px-3">
              View
            </Button>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
