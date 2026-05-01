'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drop, Warning, Gauge, Broadcast, Robot, BellRinging,
  ArrowsClockwise, Shuffle, Lightning, CheckCircle, ArrowRight,
} from '@phosphor-icons/react';
import { ZoneHeatmap, type NetworkConnection } from '@/components/map/ZoneHeatmap';
import { aStar, primsMST, type GraphNode } from '@/lib/graph-algorithms';
import type { ZoneSummary } from '@/lib/synthetic-data';

// ─── Types ────────────────────────────────────────────────────

interface Alert { id: string; time: string; msg: string; type: 'info' | 'warn' | 'critical'; }
type AppMode = 'normal' | 'disaster';

// ─── Helper: build Dijkstra graph ────────────────────────────

function buildGraph(zones: ZoneSummary[], connections: NetworkConnection[]): Map<string, GraphNode> {
  const coordMap = new Map(zones.map(z => [z.zone_id, { lat: z.lat, lng: z.lng }]));
  const connMap = new Map(connections.map(c => [c.zone_id, c.connected_zones]));
  const graph = new Map<string, GraphNode>();
  for (const zone of zones) {
    const coord = coordMap.get(zone.zone_id);
    if (!coord) continue;
    graph.set(zone.zone_id, {
      id: zone.zone_id,
      lat: coord.lat,
      lng: coord.lng,
      adjacent: connMap.get(zone.zone_id) ?? [],
    });
  }
  return graph;
}

// ─── Sub-components ───────────────────────────────────────────

const SEVERITY_COLOR_TEXT: Record<string, string> = {
  Critical:   'text-red-600',
  Probable:   'text-orange-500',
  Suspicious: 'text-yellow-600',
  Normal:     'text-emerald-600',
};
const SEVERITY_BG: Record<string, string> = {
  Critical:   'bg-red-100 text-red-700',
  Probable:   'bg-orange-100 text-orange-700',
  Suspicious: 'bg-yellow-100 text-yellow-700',
  Normal:     'bg-emerald-100 text-emerald-700',
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-mono font-bold ${color}`}>{value}</p>
      <span className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
        sub === 'Normal' || sub === 'OK' || sub === 'All Clear' ? 'bg-emerald-100 text-emerald-800'
        : sub === "Prim's" ? 'bg-cyan-100 text-cyan-800'
        : 'bg-orange-100 text-orange-800'
      }`}>{sub}</span>
    </div>
  );
}

function PressureBar({ zone, pressure }: { zone: string; pressure: number }) {
  const pct = Math.min((pressure / 4.0) * 100, 100);
  const color = pressure >= 2.5 ? 'bg-blue-500' : pressure >= 1.5 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-6 text-slate-500 font-mono shrink-0">{zone.replace('Zone-', '')}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="w-12 text-right font-mono text-slate-700">{pressure.toFixed(1)} bar</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────

export default function Dashboard() {
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);
  const [deficitCount, setDeficitCount] = useState(0);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Network / routing state
  const [mode, setMode] = useState<AppMode>('normal');
  const [routingMode, setRoutingMode] = useState(false);
  const [routeSelection, setRouteSelection] = useState<string[]>([]);
  const [routePath, setRoutePath] = useState<string[]>([]);
  const [burstZoneIds, setBurstZoneIds] = useState<string[]>([]);
  const [mstEdges, setMstEdges] = useState<Array<[string, string]>>([]);
  const [showMST, setShowMST] = useState(false);

  // UI state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const addAlert = useCallback((msg: string, type: Alert['type'] = 'info') => {
    setAlerts(prev => [
      { id: Date.now().toString(), time: new Date().toLocaleTimeString(), msg, type },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const fetchData = useCallback(async () => {
    const [anomRes, redisRes] = await Promise.all([
      fetch('/api/anomalies').then(r => r.json()),
      fetch('/api/redistribute').then(r => r.json()),
    ]);
    setZones(anomRes.all_zones ?? []);
    setConnections(anomRes.network_connections ?? []);
    setCriticalCount(anomRes.critical_count ?? 0);
    setDeficitCount(redisRes.deficit_count ?? 0);
  }, []);

  // ─── Gemini AI Advisor ────────────────────────────────────────

  const fetchAiAdvice = useCallback(async (
    currentZones: typeof zones,
    currentBurstIds: string[],
    currentDeficit: number,
    currentPressure: string,
    currentMode: AppMode
  ) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zones: currentZones.map(z => ({
            zone_id: z.zone_id,
            zone_name: z.zone_name,
            severity: z.severity,
            fulfillment_pct: z.fulfillment_pct,
            pressure_bar: z.pressure_bar ?? 2.5,
            anomaly_type: z.anomaly_type ?? null,
          })),
          burstZoneIds: currentBurstIds,
          deficitCount: currentDeficit,
          avgPressure: parseFloat(currentPressure) || 2.5,
          mode: currentMode,
        }),
      });
      const data = await res.json();
      if (data.advice?.length > 0) setAiAdvice(data.advice);
      else setAiError(data.error ?? 'No advice returned.');
    } catch (e) {
      setAiError('Failed to reach AI Advisor.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build graph once zones+connections are ready
  const graph = useMemo(() => buildGraph(zones, connections), [zones, connections]);

  // Compute MST
  const computedMST = useMemo(() => primsMST(graph), [graph]);

  // AI Advisor — reactive to zone states
  useEffect(() => {
    if (zones.length === 0) return;
    const anomalous = zones.filter(z => z.severity !== 'Normal');
    const lowPressure = zones.filter(z => (z.pressure_bar ?? 3) < 2.0);
    const advice: string[] = [];
    if (burstZoneIds.length > 0) advice.push(`🚨 Isolate burst in ${burstZoneIds.map(id => id.replace('Zone-', '')).join(', ')} and reroute via adjacent nodes.`);
    if (anomalous.length > 0) advice.push(`Prioritise inspection of ${anomalous.slice(0, 2).map(z => z.zone_name).join(' & ')} — anomalies detected.`);
    if (lowPressure.length > 0) advice.push(`Deploy pressure boosters in ${lowPressure.slice(0, 2).map(z => z.zone_id.replace('Zone-', '')).join(', ')} — below 2.0 bar.`);
    if (deficitCount > 0) advice.push(`Run redistribution engine — ${deficitCount} deficit zone${deficitCount > 1 ? 's' : ''} detected.`);
    advice.push('Monitor MST coverage — ensure all zones remain connected after any transfer.');
    setAiAdvice(advice.slice(0, 4));
  }, [zones, burstZoneIds, deficitCount]);

  // Compute stats
  const avgPressure = zones.length ? (zones.reduce((s, z) => s + (z.pressure_bar ?? 2.5), 0) / zones.length).toFixed(1) : '2.5';
  const activePipes = useMemo(() => {
    const total = connections.reduce((s, c) => s + c.connected_zones.length, 0) / 2;
    const burst = burstZoneIds.length * 2;
    return { active: Math.round(total - burst), total: Math.round(total) };
  }, [connections, burstZoneIds]);
  const mstCoverage = zones.length ? Math.round(((computedMST.length + 1) / zones.length) * 100) : 0;
  const pressureStatus = parseFloat(avgPressure) >= 2.5 ? 'Normal' : parseFloat(avgPressure) >= 1.5 ? 'Low' : 'Critical';

  // ─── Handlers ────────────────────────────────────────────────

  const handleRouteNodeClick = useCallback((zoneId: string) => {
    setRouteSelection(prev => {
      if (prev.length === 0) {
        addAlert(`Routing: source set to ${zoneId}. Click destination.`, 'info');
        return [zoneId];
      }
      if (prev.length === 1 && prev[0] !== zoneId) {
        const path = aStar(graph, prev[0], zoneId);
        if (path.length > 0) {
          setRoutePath(path);
          addAlert(`A* path: ${path.map(id => id.replace('Zone-', '')).join(' → ')} (${path.length - 1} hops)`, 'info');
        } else {
          addAlert(`No path found between ${prev[0]} and ${zoneId}`, 'warn');
        }
        return [];
      }
      return prev;
    });
  }, [graph, addAlert]);

  const handleAutoRoute = useCallback(() => {
    if (zones.length < 2) return;
    const shuffled = [...zones].sort(() => Math.random() - 0.5);
    const src = shuffled[0].zone_id;
    const dst = shuffled[1].zone_id;
    const path = aStar(graph, src, dst);
    setRoutePath(path);
    setRouteSelection([]);
    if (path.length > 0) addAlert(`Auto-Route (A*): ${src.replace('Zone-', '')} → ${dst.replace('Zone-', '')} via ${path.length - 1} hops`, 'info');
  }, [zones, graph, addAlert]);

  const handleSimulateBurst = useCallback(() => {
    const candidates = zones.filter(z => !burstZoneIds.includes(z.zone_id));
    if (candidates.length === 0) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const newBurstIds = [...burstZoneIds, target.zone_id];
    setBurstZoneIds(newBurstIds);
    setMode('disaster');
    addAlert(`🚨 PIPE BURST simulated at ${target.zone_name}! Pressure dropping.`, 'critical');
    // Immediately re-ask AI with new burst state
    fetchAiAdvice(zones, newBurstIds, deficitCount, avgPressure, 'disaster');
  }, [zones, burstZoneIds, deficitCount, avgPressure, addAlert, fetchAiAdvice]);

  const handleClearDisaster = useCallback(() => {
    setBurstZoneIds([]);
    setMode('normal');
    setRoutePath([]);
    setRouteSelection([]);
    addAlert('System restored — all pipes nominal.', 'info');
    fetchAiAdvice(zones, [], deficitCount, avgPressure, 'normal');
  }, [zones, deficitCount, avgPressure, addAlert, fetchAiAdvice]);

  const handleToggleRouting = useCallback(() => {
    setRoutingMode(prev => !prev);
    setRoutePath([]);
    setRouteSelection([]);
  }, []);

  const handleToggleMST = useCallback(() => {
    setShowMST(prev => {
      if (!prev) {
        setMstEdges(computedMST);
        addAlert(`Prim's MST computed — ${computedMST.length} edges spanning ${zones.length} zones.`, 'info');
      } else {
        setMstEdges([]);
      }
      return !prev;
    });
  }, [computedMST, zones.length, addAlert]);

  // ─── Render ───────────────────────────────────────────────────

  const isDis = mode === 'disaster';

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f9fafb]">
      {/* ── Stat cards ── */}
      <div className="w-full border-b border-slate-200 bg-white px-6 py-4 grid grid-cols-4 gap-4">
        <StatCard label="System Pressure" value={`${avgPressure} bar`} sub={pressureStatus} color={pressureStatus === 'Normal' ? 'text-emerald-700' : 'text-orange-600'} />
        <StatCard label="Anomalous Zones" value={String(criticalCount)} sub={criticalCount === 0 ? 'All Clear' : 'Action Needed'} color={criticalCount === 0 ? 'text-emerald-700' : 'text-red-600'} />
        <StatCard label="Active Pipes" value={`${activePipes.active}/${activePipes.total}`} sub={burstZoneIds.length === 0 ? 'All Clear' : `${burstZoneIds.length} burst`} color="text-slate-900" />
        <StatCard label="MST Coverage" value={`${mstCoverage}%`} sub="Prim's" color="text-cyan-700" />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4" style={{ minHeight: 'calc(100dvh - 132px)' }}>

        {/* Map column */}
        <section className="col-span-9 flex flex-col gap-3">
          {/* Map controls bar */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <Drop size={16} weight="duotone" className="text-emerald-600" />
                <span className="font-semibold text-slate-900 text-sm">Water Distribution Network</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDis ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isDis ? 'Disaster Mode' : 'Water Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {routingMode ? `Click two nodes to route · ${routeSelection.length === 0 ? 'Select origin' : 'Select destination'}` : 'Click a zone to inspect · Enable routing for Dijkstra'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMST}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${showMST ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >MST</button>
              <button
                onClick={handleToggleRouting}
                className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${routingMode ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <ArrowRight size={13} />Route
              </button>
              <button onClick={handleAutoRoute} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium">
                <Shuffle size={13} />Auto-Route
              </button>
              {isDis ? (
                <button onClick={handleClearDisaster} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors">
                  <CheckCircle size={13} />Restore
                </button>
              ) : (
                <button onClick={handleSimulateBurst} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors">
                  <Lightning size={13} />Simulate Burst
                </button>
              )}
              <button onClick={fetchData} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                <ArrowsClockwise size={13} />
              </button>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 min-h-[420px]">
            <ZoneHeatmap
              zones={zones}
              selectedZoneId={selectedZoneId}
              onZoneSelect={id => { if (!routingMode) setSelectedZoneId(id); }}
              connections={connections}
              routePath={routePath}
              burstZoneIds={burstZoneIds}
              mstEdges={showMST ? mstEdges : []}
              routingMode={routingMode}
              routeSelection={routeSelection}
              onRouteNodeClick={handleRouteNodeClick}
            />
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedZoneId ? (
              /* ── Zone Detail Panel ── */
              (() => {
                const zone = zones.find(z => z.zone_id === selectedZoneId);
                if (!zone) return null;
                const [actionLogged, setActionLogged] = useState<string | null>(null);
                const handleAction = async (action: string) => {
                  await fetch('/api/decisions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operator_id: 'ramesh_op', action, record_type: 'anomaly', record_id: zone.zone_id }),
                  });
                  setActionLogged(action);
                  addAlert(`${action} logged for ${zone.zone_name}`, 'info');
                };
                return (
                  <motion.div key="zone-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-3">
                    {/* Header */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className={`px-4 py-3 flex items-start justify-between ${SEVERITY_BG[zone.severity] ?? 'bg-slate-50'}`}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{zone.zone_id}</p>
                          <p className="text-base font-semibold text-slate-900">{zone.zone_name}</p>
                        </div>
                        <button onClick={() => setSelectedZoneId(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-white/50 transition-colors">
                          <span className="text-lg leading-none">×</span>
                        </button>
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEVERITY_BG[zone.severity]}`}>{zone.severity}</span>
                          <span className="text-xs text-slate-400 font-mono">score {zone.anomaly_score?.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{zone.reason}</p>
                        {zone.factors?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {zone.factors.map(f => <span key={f} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-medium uppercase tracking-wider">{f}</span>)}
                          </div>
                        )}
                      </div>
                      {/* Metrics */}
                      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
                        <div className="px-3 py-2.5 text-center">
                          <p className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">Demand</p>
                          <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{zone.current_consumption_ML}<span className="text-[9px] text-slate-400 ml-0.5">ML</span></p>
                        </div>
                        <div className="px-3 py-2.5 text-center">
                          <p className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">Pressure</p>
                          <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">{zone.pressure_bar?.toFixed(1)}<span className="text-[9px] text-slate-400 ml-0.5">bar</span></p>
                        </div>
                        <div className="px-3 py-2.5 text-center">
                          <p className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">Supplied</p>
                          <p className={`text-sm font-mono font-bold ${zone.fulfillment_pct >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>{zone.fulfillment_pct}<span className="text-[9px] text-slate-400 ml-0.5">%</span></p>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                        {actionLogged ? (
                          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">✓ {actionLogged} logged</p>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => handleAction('Investigate')} className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 rounded-lg transition-colors">Investigate</button>
                            <button onClick={() => handleAction('Acknowledge')} className="flex-1 text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Acknowledge</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })()
            ) : (
              /* ── Default: Pressure bars ── */
              <motion.div key="pressure" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Gauge size={15} weight="duotone" className="text-blue-600" />Zone Pressure
                    </h2>
                    <span className="text-[10px] text-slate-400 font-mono">bar</span>
                  </div>
                  <div className="space-y-2">
                    {zones.slice(0, 12).map(z => (
                      <PressureBar key={z.zone_id} zone={z.zone_id} pressure={z.pressure_bar ?? 2.5} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Advisor */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Robot size={15} weight="duotone" className="text-emerald-600" />AI Advisor
                {aiLoading && <span className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin ml-1" />}
              </h2>
              <button onClick={() => fetchAiAdvice(zones, burstZoneIds, deficitCount, avgPressure, mode)} disabled={aiLoading}
                className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40">
                <ArrowsClockwise size={11} className={aiLoading ? 'animate-spin' : ''} />Refresh
              </button>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Gemini Analysis</p>
            {aiError ? (
              <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg p-2">
                {aiError.includes('not configured') ? <><strong>API key needed.</strong> Add to <code className="bg-orange-100 px-1 rounded">.env.local</code> and restart.</> : aiError}
              </div>
            ) : aiLoading && aiAdvice.length === 0 ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${70 + i * 5}%` }} />)}</div>
            ) : (
              <ol className="space-y-2">
                {aiAdvice.map((advice, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span>{advice}</span>
                  </li>
                ))}
                {aiAdvice.length === 0 && <li className="text-xs text-slate-400">Click Refresh to ask Gemini.</li>}
              </ol>
            )}
          </div>

          {/* Alert Log */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex-1">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5"><BellRinging size={15} weight="duotone" className="text-orange-500" />Alert Log</span>
              <span className="text-[10px] text-slate-400">{alerts.length} event{alerts.length !== 1 ? 's' : ''}</span>
            </h2>
            {alerts.length === 0 ? <p className="text-xs text-slate-400">No events yet.</p> : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <AnimatePresence>
                  {alerts.map(alert => (
                    <motion.div key={alert.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      className={`text-xs p-2 rounded-lg border ${
                        alert.type === 'critical' ? 'bg-red-50 border-red-100 text-red-800'
                        : alert.type === 'warn' ? 'bg-yellow-50 border-yellow-100 text-yellow-800'
                        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-100 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                      }`}>
                      <span className="font-mono text-[10px] text-slate-400 mr-1">{alert.time}</span>
                      {alert.msg}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
