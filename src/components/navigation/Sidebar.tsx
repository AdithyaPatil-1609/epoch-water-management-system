'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
 Drop, MapTrifold, Scales, ClipboardText,
 ChartLineUp, List, X, Warning, ChartBar, Robot,
} from '@phosphor-icons/react';
import { useState } from 'react';

const navGroups = [
 {
  label: 'Core',
  items: [
   { href: '/dashboard',    label: 'Dashboard',    icon: MapTrifold },
   { href: '/redistribution', label: 'Redistribution', icon: Scales },
   { href: '/fairness',     label: 'Fairness',     icon: ChartLineUp },
   { href: '/audit',        label: 'Audit Trail',  icon: ClipboardText },
  ],
 },
 {
  label: 'Intelligence',
  items: [
   { href: '/anomalies',   label: 'Anomaly Feed', icon: Warning },
   { href: '/analytics',   label: 'Analytics',    icon: ChartBar },
   { href: '/ai-insights', label: 'AI Insights',  icon: Robot },
  ],
 },
];

export function Sidebar() {
 const pathname = usePathname();
 const [mobileOpen, setMobileOpen] = useState(false);

 return (
  <>
   {/* Mobile toggle */}
   <button
    onClick={() => setMobileOpen(true)}
    className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-xl text-white backdrop-blur-md"
    aria-label="Open navigation"
   >
    <List size={22} weight="bold" />
   </button>

   {mobileOpen && (
    <motion.div
     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
     onClick={() => setMobileOpen(false)}
     className="lg:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40"
    />
   )}

   <aside className={`
    fixed inset-y-0 left-0 z-50 w-[240px]
    bg-slate-950/80 backdrop-blur-xl
    border-r border-slate-800/80
    flex flex-col transition-transform duration-300 ease-out
    lg:translate-x-0 lg:static lg:z-auto shadow-2xl
    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
   `}>
    {/* Brand */}
    <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800/60">
     <Link href="/dashboard" className="flex items-center gap-3 group">
      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all duration-300">
       <Drop size={24} weight="fill" className="text-emerald-400 animate-pulse" />
      </div>
      <div>
       <span className="text-[16px] font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300 uppercase block">UrbanFlow</span>
       <span className="text-[10px] tracking-widest uppercase font-semibold text-emerald-400/80 block mt-0.5">Hydrological OS</span>
      </div>
     </Link>
     <button
      onClick={() => setMobileOpen(false)}
      className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
     >
      <X size={18} />
     </button>
    </div>

    <nav className="flex-1 px-4 py-6 overflow-y-auto">
     <div className="space-y-6">
      {navGroups.map(group => (
       <div key={group.label}>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-4 mb-2">{group.label}</p>
        <div className="space-y-1">
         {group.items.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
           <Link
            key={item.href} href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
             isActive
              ? 'text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50 hover:shadow-sm'
            }`}
           >
            {isActive && (
             <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 via-emerald-500/10 to-transparent border-l-2 border-emerald-400 rounded-r-xl rounded-l-sm"
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              style={{ zIndex: -1 }}
             />
            )}
            <Icon size={20} weight={isActive ? 'fill' : 'regular'} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
            {item.label}
           </Link>
          );
         })}
        </div>
       </div>
      ))}
     </div>
    </nav>

    {/* User footer */}
    <div className="px-5 py-5 border-t border-slate-800/60 bg-slate-900/30">
     <div className="flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-300">RK</div>
      <div className="flex-1 min-w-0">
       <p className="text-sm font-bold text-white truncate">Ramesh K.</p>
       <p className="text-[10px] tracking-wider font-bold uppercase text-emerald-400/80 mt-0.5">System Operator</p>
      </div>
     </div>
    </div>
   </aside>
  </>
 );
}
