'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightning, Trash, DownloadSimple, CheckCircle, SpinnerGap } from '@phosphor-icons/react';

interface ActionButtonsProps {
  onInjectLeak: () => void;
  onDismissAll: () => void;
}

export function ActionButtons({ onInjectLeak, onDismissAll }: ActionButtonsProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadDone(false);
    try {
      const res = await fetch('/api/reports/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `epoch-water-audit-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 3000);
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Inject Leak */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onInjectLeak}
        title="Inject a simulated leak anomaly for demo purposes"
        className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold uppercase tracking-wider shadow-sm transition-all duration-200"
      >
        <Lightning size={13} weight="fill" />
        Inject Leak
      </motion.button>

      {/* Dismiss All */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onDismissAll}
        title="Dismiss all current alerts"
        className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold uppercase tracking-wider transition-all duration-200"
      >
        <Trash size={13} weight="bold" />
        Dismiss
      </motion.button>

      {/* Download Report */}
      <motion.button
        whileHover={{ scale: downloading ? 1 : 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleDownload}
        disabled={downloading}
        title="Download full audit report as XLSX"
        className={`flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider shadow-sm transition-all duration-200 ${
          downloadDone
            ? 'bg-emerald-600 text-white border-emerald-500'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        } disabled:opacity-60`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {downloading ? (
            <motion.span key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SpinnerGap size={13} className="animate-spin" />
            </motion.span>
          ) : downloadDone ? (
            <motion.span key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <CheckCircle size={13} weight="fill" />
            </motion.span>
          ) : (
            <motion.span key="dl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DownloadSimple size={13} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
        {downloading ? 'Generating…' : downloadDone ? 'Downloaded!' : 'Download Report'}
      </motion.button>
    </div>
  );
}
