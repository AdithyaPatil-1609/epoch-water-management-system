'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Drop, MapTrifold, Scales, ClipboardText,
  ChartLineUp, List, X,
} from '@phosphor-icons/react';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',     icon: MapTrifold   },
  { href: '/redistribution',  label: 'Redistribution',icon: Scales        },
  { href: '/fairness',        label: 'Fairness',      icon: ChartLineUp  },
  { href: '/audit',           label: 'Audit Trail',   icon: ClipboardText },
];

export function Sidebar() {
  const pathname   = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-300"
        aria-label="Open navigation"
      >
        <List size={20} weight="bold" />
      </button>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[240px]
        bg-white dark:bg-slate-900
        border-r border-slate-200 dark:border-slate-700/60
        flex flex-col transition-transform duration-300 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <Drop size={22} weight="fill" className="text-emerald-500 group-hover:text-emerald-400 transition-colors" />
            <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">UrbanFlow</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <div className="space-y-1">
            {navItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href} href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">R</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">Ramesh K.</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">Operator</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
