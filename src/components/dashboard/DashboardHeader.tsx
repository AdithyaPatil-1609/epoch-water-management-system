'use client';
import { WarningCircle, Drop, Gauge } from '@phosphor-icons/react/dist/ssr';

interface DashboardHeaderProps {
 criticalCount: number;
 totalZones: number;
 deficitCount: number;
}

export function DashboardHeader({ criticalCount, totalZones, deficitCount }: DashboardHeaderProps) {
 return (
 <div className="w-full border-b border-slate-200 bg-white">
 <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
 <div className="flex items-center gap-6">
 <h1 className="text-xl font-medium tracking-tight text-slate-900 flex items-center gap-2">
 <Drop weight="fill" className="text-emerald-600" />
 UrbanFlow
 </h1>
 
 <div className="hidden md:flex items-center gap-4 border-l border-slate-200 pl-6">
 <div className={`flex items-center gap-2 text-sm font-medium ${criticalCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
 <WarningCircle weight="bold" />
 {criticalCount} Critical {criticalCount === 1 ? 'Zone' : 'Zones'}
 </div>
 <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
 <Gauge weight="bold" />
 {deficitCount} Zones in Deficit
 </div>
 </div>
 </div>
 
 <div className="flex items-center gap-4 text-sm text-slate-800">
 <span className="hidden sm:inline">Last scan: 2 min ago</span>
 <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 font-medium">
 R
 </div>
 </div>
 </div>
 </div>
 );
}
