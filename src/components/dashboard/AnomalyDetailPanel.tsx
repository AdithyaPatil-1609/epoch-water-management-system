'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '@phosphor-icons/react/dist/ssr';
import { ZoneSummary, DailyConsumption } from '@/lib/synthetic-data';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConsumptionChart } from '../charts/ConsumptionChart';
import { useState, useEffect } from 'react';

interface AnomalyDetailPanelProps {
  zoneId: string | null;
  onClose: () => void;
}

export function AnomalyDetailPanel({ zoneId, onClose }: AnomalyDetailPanelProps) {
  const [zone, setZone] = useState<ZoneSummary | null>(null);
  const [history, setHistory] = useState<DailyConsumption[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLogged, setActionLogged] = useState<string | null>(null);

  useEffect(() => {
    if (!zoneId) return;
    
    setLoading(true);
    setActionLogged(null);
    
    // Fetch zone details and history
    Promise.all([
      fetch('/api/anomalies').then(r => r.json()),
      fetch(`/api/history?zone_id=${zoneId}`).then(r => r.json())
    ]).then(([anomaliesData, historyData]) => {
      const foundZone = anomaliesData.all_zones.find((z: any) => z.zone_id === zoneId);
      setZone(foundZone);
      if (historyData.history) {
        setHistory(historyData.history);
      }
      setLoading(false);
    });
  }, [zoneId]);

  const handleAction = async (action: string) => {
    if (!zoneId) return;
    
    await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_id: "ramesh_op",
        action,
        record_type: "anomaly",
        record_id: zoneId,
        comment: `Operator triggered ${action} on ${zone?.zone_name}`
      })
    });
    
    setActionLogged(action);
  };

  return (
    <AnimatePresence>
      {zoneId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-2xl border-l border-slate-200 z-50 overflow-y-auto flex flex-col"
          >
            {loading || !zone ? (
              <div className="p-8 text-center text-slate-500">Loading details...</div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                  <div>
                    <h2 className="text-2xl font-medium tracking-tight text-slate-900">{zone.zone_name}</h2>
                    <p className="text-sm font-mono text-slate-500 mt-1">{zone.zone_id}</p>
                  </div>
                  <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 flex-1 flex flex-col gap-8">
                  {/* Status Section */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <Badge severity={zone.severity} />
                      <span className="text-sm text-slate-500 font-medium">Score: {zone.anomaly_score.toFixed(2)}</span>
                    </div>
                    <p className="text-lg text-slate-800 leading-snug">{zone.reason}</p>
                    
                    {zone.factors.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {zone.factors.map(f => (
                          <span key={f} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md uppercase tracking-wider">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Consumption</div>
                      <div className="text-2xl font-mono text-slate-900">{zone.current_consumption_ML} <span className="text-sm font-sans text-slate-500">ML/d</span></div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Pressure</div>
                      <div className="text-2xl font-mono text-slate-900">{zone.pressure_bar.toFixed(1)} <span className="text-sm font-sans text-slate-500">bar</span></div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="h-64 mt-2">
                    <h3 className="text-sm font-medium text-slate-700 mb-4">30-Day History</h3>
                    <ConsumptionChart data={history} />
                  </div>
                </div>

                {/* Action Bar */}
                <div className="p-6 border-t border-slate-100 bg-white">
                  {actionLogged ? (
                    <div className="w-full py-3 px-4 bg-emerald-50 text-emerald-800 rounded-lg flex items-center gap-2 font-medium">
                      ✓ Action logged: {actionLogged}
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button className="flex-1" onClick={() => handleAction('Investigate')}>
                        Investigate
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => handleAction('Acknowledge')}>
                        Acknowledge
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
