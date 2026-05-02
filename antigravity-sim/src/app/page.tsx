'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ScenarioId, PhysicsParams, DEFAULT_PARAMS } from '@/lib/physics';
import { ControlPanel } from '@/components/ui/ControlPanel';

// Canvas must be client-only (no SSR for WebGL)
const Scene = dynamic(() => import('@/components/simulation/Scene').then(m => m.Scene), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#070714]">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Initialising physics engine…</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioId>('inversion');
  const [params, setParams] = useState<PhysicsParams>(DEFAULT_PARAMS);
  const [showVectors, setShowVectors] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const handleParamChange = useCallback((key: keyof PhysicsParams, value: number) => {
    setParams(p => ({ ...p, [key]: value }));
  }, []);

  const handleScenarioChange = useCallback((id: ScenarioId) => {
    setScenario(id);
    setParams(DEFAULT_PARAMS);
    setResetKey(k => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setResetKey(k => k + 1);
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#070714]">
      {/* 3D Canvas — takes remaining width */}
      <div className="flex-1 relative">
        <Scene key={resetKey} scenario={scenario} params={params} showVectors={showVectors} />

        {/* HUD overlay */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-xs text-slate-300 space-y-0.5 pointer-events-none">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Live Physics</p>
          <p>Particles: <span className="font-mono text-white">{params.particleCount}</span></p>
          <p>Gravity: <span className="font-mono text-white">{params.gravityStrength.toFixed(1)} m/s²</span></p>
          <p>Speed: <span className="font-mono text-white">{(params.slowMo * 100).toFixed(0)}%</span></p>
        </div>

        {/* Docs link */}
        <Link href="/docs"
          className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-slate-400 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-full transition-colors">
          📄 PRD &amp; Research Docs
        </Link>

        {/* Drag hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-slate-600 pointer-events-none">
          Drag to orbit · Scroll to zoom
        </div>
      </div>

      <ControlPanel
        active={scenario}
        params={params}
        showVectors={showVectors}
        onScenarioChange={handleScenarioChange}
        onParamChange={handleParamChange}
        onToggleVectors={() => setShowVectors(v => !v)}
        onReset={handleReset}
      />
    </main>
  );
}
