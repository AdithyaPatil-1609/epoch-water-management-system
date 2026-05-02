'use client';

import { ScenarioId, ScenarioConfig, PhysicsParams, SCENARIOS } from '@/lib/physics';

interface Props {
  active: ScenarioId;
  params: PhysicsParams;
  showVectors: boolean;
  onScenarioChange: (id: ScenarioId) => void;
  onParamChange: (key: keyof PhysicsParams, value: number) => void;
  onToggleVectors: () => void;
  onReset: () => void;
}

function Slider({
  label, min, max, step, value, accent,
  onChange,
}: { label: string; min: number; max: number; step: number; value: number; accent: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-white">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer accent-emerald-400"
        style={{ accentColor: accent }}
      />
    </div>
  );
}

export function ControlPanel({ active, params, showVectors, onScenarioChange, onParamChange, onToggleVectors, onReset }: Props) {
  const scenario = SCENARIOS.find(s => s.id === active)!;

  return (
    <aside className="absolute top-0 right-0 h-full w-72 bg-slate-950/90 backdrop-blur-md border-l border-white/5 flex flex-col z-10 select-none">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Antigravity Sim</p>
        <h1 className="text-lg font-bold text-white leading-tight">{scenario.label}</h1>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{scenario.description}</p>
      </div>

      {/* Scenario tabs */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Scenario</p>
        <div className="flex flex-col gap-1.5">
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => onScenarioChange(s.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active === s.id
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={active === s.id ? { background: `${s.accentColor}22`, borderLeft: `3px solid ${s.accentColor}` } : {}}
            >
              <span className="text-base">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div className="px-4 py-4 flex-1 overflow-y-auto space-y-5 border-b border-white/5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Parameters</p>

        <Slider label="Gravity Strength (m/s²)" min={1} max={25} step={0.5} value={params.gravityStrength} accent={scenario.accentColor}
          onChange={v => onParamChange('gravityStrength', v)} />

        {active !== 'inversion' && (
          <Slider label="Field Radius (m)" min={2} max={14} step={0.5} value={params.fieldRadius} accent={scenario.accentColor}
            onChange={v => onParamChange('fieldRadius', v)} />
        )}

        <Slider label="Particle Count" min={20} max={200} step={10} value={params.particleCount} accent={scenario.accentColor}
          onChange={v => onParamChange('particleCount', Math.round(v))} />

        <Slider label="Slow Motion" min={0.1} max={1} step={0.05} value={params.slowMo} accent={scenario.accentColor}
          onChange={v => onParamChange('slowMo', v)} />

        <Slider label="Bounciness" min={0} max={1} step={0.05} value={params.restitution} accent={scenario.accentColor}
          onChange={v => onParamChange('restitution', v)} />
      </div>

      {/* Actions */}
      <div className="px-4 py-4 space-y-2">
        <button
          onClick={onToggleVectors}
          className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
            showVectors ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-white/10'
          }`}
        >
          {showVectors ? '✦ Force Vectors ON' : '✦ Force Vectors OFF'}
        </button>
        <button
          onClick={onReset}
          className="w-full py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
        >
          ↺ Reset Simulation
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5">
        <p className="text-[10px] text-slate-600 text-center">Three.js + Cannon-ES · WebGL</p>
      </div>
    </aside>
  );
}
