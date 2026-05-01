import { WarningCircle, CheckCircle, Warning, XCircle } from '@phosphor-icons/react/dist/ssr';

export type Severity = 'Normal' | 'Suspicious' | 'Probable' | 'Critical';

interface BadgeProps {
 severity: Severity;
 label?: string;
 className?: string;
}

const severityConfig = {
 Normal: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', icon: CheckCircle },
 Suspicious: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: Warning },
 Probable: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', icon: WarningCircle },
 Critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: XCircle },
};

export function Badge({ severity, label, className = '' }: BadgeProps) {
 const config = severityConfig[severity];
 const Icon = config.icon;
 
 return (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}>
 <Icon weight="bold" />
 {label || severity}
 </span>
 );
}

export function StatusBadge({ status }: { status: string }) {
 let styles = 'bg-slate-100 text-black border-slate-200';
 if (status === 'safe') styles = 'bg-emerald-100 text-emerald-800 border-emerald-200';
 if (status === 'borderline') styles = 'bg-orange-100 text-orange-800 border-orange-200';
 if (status === 'unsafe') styles = 'bg-red-100 text-red-800 border-red-200';
 
 return (
 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider ${styles}`}>
 {status}
 </span>
 );
}
