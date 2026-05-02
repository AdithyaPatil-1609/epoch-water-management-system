import Link from 'next/link';

const accent = '#6366f1';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14">
      <h2 className="text-2xl font-bold text-white mb-4 pb-3 border-b border-white/10">{title}</h2>
      <div className="space-y-3 text-slate-300 leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}

function Badge({ label, color = '#6366f1' }: { label: string; color?: string }) {
  return (
    <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mr-1 mb-1"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 my-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {headers.map(h => <th key={h} className="text-left px-4 py-3 text-slate-300 font-semibold whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
              {row.map((cell, j) => <td key={j} className="px-4 py-3 text-slate-400 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#070714] text-white font-sans">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-[#070714]/95 backdrop-blur border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Hackathon PRD</p>
          <h1 className="text-lg font-bold text-white leading-tight">Antigravity Simulation Platform</h1>
        </div>
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors px-4 py-2 rounded-lg border border-indigo-500/30 hover:border-indigo-400/50">
          ← Launch Sim
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-14">

        {/* ── RESEARCH PHASE ── */}
        <div className="mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Multi-Agent Research</p>
          <h2 className="text-4xl font-bold text-white mb-4">Research Findings</h2>
          <p className="text-slate-400 text-base">Three specialised agents conducted parallel research, debated, and reached consensus on MVP scope and tech stack.</p>
        </div>

        <Section id="agent1" title="🔬 Agent 1 — Technical Feasibility">
          <p><strong className="text-white">Stack recommendation:</strong> Three.js + @react-three/fiber + Cannon-ES physics engine running on the main thread (no WASM complexity), deployed on Next.js 16.</p>
          <p><strong className="text-white">Gravity inversion</strong> is a single-line change: <code className="bg-white/10 px-2 py-0.5 rounded text-indigo-300 text-sm">world.gravity.set(0, +9.81, 0)</code> — immediately visually compelling and provably correct.</p>
          <p><strong className="text-white">Performance:</strong> Three.js <code className="bg-white/10 px-1 rounded text-sm text-indigo-300">InstancedMesh</code> handles 500+ particles at 60 fps without GPU tricks. Cannon-ES handles ~2 000 rigid bodies comfortably in a browser thread.</p>
          <p><strong className="text-white">WebGL vs WebGPU:</strong> WebGL (Three.js default) — ~98 % browser support, zero configuration. WebGPU is too bleeding-edge for 48-hour delivery.</p>
          <p><strong className="text-white">Bottlenecks identified:</strong> physics-render sync (solved with fixed-timestep + lerp), WASM init latency (avoided by choosing Cannon-ES pure JS), and Three.js tree-shaking (solved by @react-three/fiber).</p>
          <p><strong className="text-white">Fallback plan:</strong> p5.js 2D canvas — 30-minute setup, still demonstrates antigravity convincingly if 3D rendering destabilises.</p>
        </Section>

        <Section id="agent2" title="🎨 Agent 2 — UX &amp; Market">
          <p><strong className="text-white">Market gap:</strong> No free, browser-native, real-time 3D exotic-physics simulator exists. PhET is 2D-only; Unity tools are paid and heavyweight; GeoGebra is math, not physics.</p>
          <Table
            headers={['Tool', '3D', 'Free', 'Custom Physics', 'Web-Native']}
            rows={[
              ['PhET Simulations', '❌', '✅', '❌', '✅'],
              ['Unity WebGL', '✅', '❌', '✅', '✅'],
              ['GeoGebra', '❌', '✅', '❌', '✅'],
              ['This Platform', '✅', '✅', '✅', '✅'],
            ]}
          />
          <p><strong className="text-white">Personas:</strong> Maya (physics student, 19) — wants to "play" with variables; Dr Raj (educator, 42) — wants embeddable classroom tools; Alex (enthusiast, 28) — wants sci-fi exploration; Dr Chen (researcher, 35) — wants configurable accuracy.</p>
          <p><strong className="text-white">Core UX insight:</strong> "Wow moment" must occur within 30 seconds of page load. Scene must be pre-populated — not empty.</p>
          <p><strong className="text-white">MVP UX:</strong> 3-tab scenario switcher → real-time sliders → force vector toggle → HUD overlay with live stats.</p>
          <p><strong className="text-white">Validation:</strong> 5-user guerrilla test + Google Form NPS after demo.</p>
        </Section>

        <Section id="agent3" title="🗺️ Agent 3 — Product Strategy">
          <p><strong className="text-white">MVP feature set (48-hour safe):</strong></p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['✅', 'Gravity Inversion scenario'],
              ['✅', 'Levitation Field scenario'],
              ['✅', 'Repulsion Zone scenario'],
              ['✅', 'Real-time param sliders'],
              ['✅', 'Force vector arrows (cap 50)'],
              ['✅', 'Slow-motion mode'],
              ['❌', 'Export to video (Phase 2)'],
              ['❌', 'Custom formula input (Phase 2)'],
            ].map(([ok, feat]) => (
              <div key={feat} className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${ok === '✅' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
                <span>{ok}</span><span>{feat}</span>
              </div>
            ))}
          </div>
          <p className="mt-3"><strong className="text-white">Team allocation (4 devs):</strong> Dev A — physics engine; Dev B — React UI/sliders; Dev C — shaders/visual FX; Dev D — integration, API routes, Vercel deploy.</p>
          <p><strong className="text-white">Critical dependency:</strong> Three.js + Cannon-ES boilerplate must be live by Hour 4 — all other tracks unblock from it.</p>
        </Section>

        <Section id="debate" title="⚔️ Debate Synthesis &amp; Consensus">
          <p><strong className="text-white">Key cross-examination outcomes:</strong></p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Force vectors</strong> (Agent 2 push, Agent 1 confirmed feasible): Three.js <code className="bg-white/10 px-1 rounded text-sm text-indigo-300">ArrowHelper</code>, capped at 50 to avoid visual clutter.</li>
            <li><strong className="text-white">Tutorial Mode</strong> (Agent 2 request): scoped down to contextual tooltip overlays (2-hour task not 6-hour). Protects the 3-scenario goal.</li>
            <li><strong className="text-white">Slow-motion</strong> (Agent 2 idea): "free" — single multiplier on <code className="bg-white/10 px-1 rounded text-sm text-indigo-300">world.step(dt * slowMo)</code>. Unanimously added.</li>
            <li><strong className="text-white">Rapier.js vs Cannon-ES</strong> (Agent 1 debate): Cannon-ES wins for 48h — zero WASM init, simpler API, pure JS.</li>
          </ul>
          <p className="mt-2"><strong className="text-white">Consensus stack:</strong> Next.js 16 + Three.js 0.176 + @react-three/fiber + @react-three/drei + Cannon-ES 0.20 → Vercel.</p>
        </Section>

        {/* ── PRD ── */}
        <div className="mt-20 mb-16 pt-12 border-t border-white/10">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Product Requirements Document</p>
          <h2 className="text-4xl font-bold text-white mb-4">Complete PRD — 16 Sections</h2>
        </div>

        <Section id="exec" title="1. Executive Summary">
          <p>The Antigravity Simulation Platform is a browser-native, real-time 3D physics visualisation tool that lets physics students, educators, and science enthusiasts interactively explore exotic-gravity scenarios — gravity inversion, levitation fields, and repulsion zones. Built on Three.js and Cannon-ES, deployed to Vercel in under 48 hours by a 4-person team, it is the only free, web-native 3D exotic-physics simulator in the market.</p>
        </Section>

        <Section id="problem" title="2. Problem Statement &amp; Market Context">
          <p>Abstract physics concepts — especially exotic gravity models — are notoriously difficult to visualise with existing tools. PhET offers 2D only; Unity requires paid licences and high-end hardware; VR apps have classroom-scale barriers. The result: students memorise equations they cannot intuitively grasp, and educators lack embeddable, interactive tools that work on any browser.</p>
          <p><strong className="text-white">Market size:</strong> 350 M+ global STEM students; 15 M+ science educators; growing physics-sim EdTech segment ($4.2 B by 2027).</p>
        </Section>

        <Section id="personas" title="3. Target Users &amp; Personas">
          <Table
            headers={['Persona', 'Age', 'Goal', 'Pain Point']}
            rows={[
              ['Maya (Student)', '19', 'Understand antigravity intuitively', 'Tools are 2D, boring, not interactive'],
              ['Dr Raj (Educator)', '42', 'Embed sim in lecture slides', 'Unity too complex; PhET too limited'],
              ['Alex (Enthusiast)', '28', 'Explore "what-if" scenarios', 'Nothing free & 3D exists'],
              ['Dr Chen (Researcher)', '35', 'Visualise exotic matter theory', 'Custom engines take months to build'],
            ]}
          />
        </Section>

        <Section id="solution" title="4. Solution Overview">
          <p>A single-page Next.js application that boots a Three.js + Cannon-ES physics world in the browser. Three pre-built antigravity scenarios are selectable via a tab panel. All physics parameters (gravity strength, field radius, particle count, slow-motion factor, bounciness) are controllable in real time via sliders. Force vector arrows visualise the active forces on each particle. No installation, no login, fully shareable via URL.</p>
        </Section>

        <Section id="features" title="5. Core Features — MVP">
          {[
            ['Scenario: Gravity Inversion', 'Global gravity reversed. Particles fall upward against a ceiling. Demonstrates basic Newtonian inversion.'],
            ['Scenario: Levitation Field', 'Cylindrical zone counteracts gravity within a configurable radius. Particles levitate inside the field, fall outside.'],
            ['Scenario: Repulsion Zone', 'Spherical repulsor at origin scatters all nearby mass outward with inverse-square force.'],
            ['Parameter Sliders', 'Gravity strength, field radius, particle count (20–200), slow-motion (10%–100%), bounciness (0–1).'],
            ['Force Vector Arrows', 'Toggle on/off. Renders ArrowHelper on up to 50 particles showing net force direction and magnitude.'],
            ['HUD Overlay', 'Live particle count, gravity value, simulation speed — non-interactive, always-on.'],
            ['Reset & Scenario Switch', 'Rebuilds the Cannon-ES world from scratch, clearing all state cleanly.'],
          ].map(([feat, desc]) => (
            <div key={feat} className="flex gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="shrink-0 w-2 h-2 rounded-full bg-indigo-400 mt-1.5" />
              <div><p className="font-semibold text-white text-sm">{feat}</p><p className="text-slate-400 text-sm mt-0.5">{desc}</p></div>
            </div>
          ))}
        </Section>

        <Section id="roadmap" title="6. Future Roadmap">
          <Table
            headers={['Phase', 'Feature', 'Effort']}
            rows={[
              ['Phase 2 (Week 2)', 'Export simulation state as JSON / GIF', '8h'],
              ['Phase 2', 'Custom gravity formula input (math expression parser)', '12h'],
              ['Phase 3', 'URL-based state sharing (encode params in query string)', '4h'],
              ['Phase 3', 'Embed mode (iframe-safe, no nav bar)', '3h'],
              ['Phase 4', 'N-body gravity simulation (multi-attractor)', '24h'],
              ['Phase 4', 'Multiplayer collaborative view (WebSocket)', '40h'],
            ]}
          />
        </Section>

        <Section id="stories" title="7. User Stories &amp; Acceptance Criteria">
          {[
            ['US-01', 'Physics student', 'switch between 3 scenarios instantly', 'Scenario change resets world < 500ms'],
            ['US-02', 'Educator', 'adjust gravity in real time while presenting', 'Slider updates physics on next frame with no stutter'],
            ['US-03', 'Enthusiast', 'toggle force vectors to understand forces', 'Arrows appear/disappear within 1 frame; max 50 shown'],
            ['US-04', 'Any user', 'slow down physics to observe trajectories', 'slowMo slider 10%–100% changes world.step dt multiplier'],
            ['US-05', 'Any user', 'reset the simulation to its initial state', 'All bodies respawn at random valid positions within 1s'],
          ].map(([id, who, want, ac]) => (
            <div key={id} className="p-4 rounded-xl bg-white/5 border border-white/5 text-sm space-y-1">
              <p className="font-mono text-indigo-400 text-xs">{id}</p>
              <p className="text-white">As a <strong>{who}</strong>, I want to <strong>{want}</strong>.</p>
              <p className="text-slate-400"><span className="text-slate-500">AC:</span> {ac}</p>
            </div>
          ))}
        </Section>

        <Section id="nfr" title="8. Non-Functional Requirements">
          <Table
            headers={['Category', 'Requirement']}
            rows={[
              ['Performance', '≥ 60 fps with 100 particles on a mid-tier laptop (Intel Iris Xe)'],
              ['Load Time', '< 3s to interactive on 10 Mbps connection'],
              ['Browser Support', 'Chrome 120+, Firefox 121+, Safari 17+ (WebGL 2)'],
              ['Accessibility', 'All sliders keyboard-navigable; aria-labels on controls'],
              ['Responsiveness', 'Usable on 1280px+ screens; panel collapses on mobile'],
              ['Uptime', '99.9% on Vercel Edge (SLA inherited)'],
            ]}
          />
        </Section>

        <Section id="stack" title="9. Tech Stack &amp; Justification">
          <Table
            headers={['Layer', 'Choice', 'Justification']}
            rows={[
              ['Framework', 'Next.js 16 (App Router)', 'SSR for meta tags; API routes; Vercel-native deploy'],
              ['3D Rendering', 'Three.js 0.176 via @react-three/fiber', 'Mature, React-idiomatic, InstancedMesh for particle perf'],
              ['Physics Engine', 'Cannon-ES 0.20', 'Pure JS (no WASM), simple gravity API, sufficient for 48h'],
              ['Helpers', '@react-three/drei', 'OrbitControls, Environment, Stars, Grid — zero-config polish'],
              ['Styling', 'Tailwind CSS 4', 'Utility-first, dark theme, rapid iteration'],
              ['Language', 'TypeScript 5', 'Type-safe physics params, scenario config'],
              ['Deploy', 'Vercel', 'Zero-config, edge CDN, preview URLs per commit'],
            ]}
          />
        </Section>

        <Section id="arch" title="10. System Architecture">
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 font-mono text-xs text-slate-300 leading-7">
            <pre>{`Browser
├── Next.js App Router (RSC for docs/layout)
│   └── /  (Client Component — "use client")
│       ├── <Scene>           ← Canvas + Lighting + Stars
│       │   ├── <ParticleSystem>  ← InstancedMesh + Cannon-ES world
│       │   └── <ForceField>      ← Animated torus + glow sphere
│       └── <ControlPanel>    ← Sidebar: tabs + sliders + buttons
│
├── /docs  (RSC — this page)
│
└── /api
    ├── POST /api/simulate    ← validate + echo config
    ├── GET  /api/config      ← default params + scenario list
    └── GET  /api/export      ← serialise current scenario state

State flow:
  page.tsx (useState)
    → params → <Scene key={resetKey}> → physics tick @ 60Hz
    → bodies sync → InstancedMesh.instanceMatrix → WebGL draw`}
            </pre>
          </div>
        </Section>

        <Section id="api" title="11. API Specification">
          <div className="space-y-6">
            {[
              {
                method: 'GET', path: '/api/config',
                desc: 'Returns default physics parameters and available scenario list.',
                response: `{
  "scenarios": ["inversion","levitation","repulsion"],
  "defaults": {
    "gravityStrength": 9.81,
    "fieldRadius": 6,
    "particleCount": 80,
    "slowMo": 1,
    "restitution": 0.4
  }
}`,
              },
              {
                method: 'POST', path: '/api/simulate',
                desc: 'Validates a simulation config object and returns echo with computed metadata.',
                request: `{
  "scenario": "levitation",
  "params": { "gravityStrength": 12, "fieldRadius": 8, "particleCount": 120 }
}`,
                response: `{
  "valid": true,
  "scenario": "levitation",
  "params": { ... },
  "estimatedFps": "60",
  "warningFlags": []
}`,
              },
              {
                method: 'GET', path: '/api/export?scenario=levitation',
                desc: 'Returns serialised scenario state as JSON (particle positions, velocities, params).',
                response: `{
  "scenario": "levitation",
  "exportedAt": "2026-05-01T16:00:00Z",
  "params": { ... },
  "particles": [
    { "id": 0, "position": [1.2, 4.5, -0.8], "velocity": [0, 0.3, 0] }
  ]
}`,
              },
            ].map(({ method, path, desc, request, response }) => (
              <div key={path} className="rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-white/5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#6366f122', color: '#818cf8' }}>{method}</span>
                  <code className="text-white font-mono text-sm">{path}</code>
                </div>
                <div className="px-4 py-3 text-sm text-slate-400 border-t border-white/5">{desc}</div>
                {request && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-slate-500 mb-1">Request body:</p>
                    <pre className="text-xs bg-black/30 rounded-lg p-3 text-slate-300 overflow-x-auto">{request}</pre>
                  </div>
                )}
                <div className="px-4 pb-4">
                  <p className="text-xs text-slate-500 mb-1">Response:</p>
                  <pre className="text-xs bg-black/30 rounded-lg p-3 text-slate-300 overflow-x-auto">{response}</pre>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="timeline" title="12. Implementation Timeline — 4 × 12h Phases">
          <Table
            headers={['Phase', 'Hours', 'Dev Owner', 'Deliverable']}
            rows={[
              ['Phase 0 — Foundation', '0–12h', 'All', 'Next.js scaffold, Three.js + Cannon-ES boilerplate, gravity inversion working, InstancedMesh rendering'],
              ['Phase 1 — Scenarios', '12–24h', 'Dev A + B', 'Levitation + repulsion scenarios, all 5 sliders wired, per-tick force application correct'],
              ['Phase 2 — Polish', '24–36h', 'Dev C + D', 'Force vector arrows, stars/grid/environment, glowing ForceField, force field pulse animation'],
              ['Phase 3 — Ship', '36–48h', 'All', 'API routes, /docs page, bug fixes, Vercel deploy, demo rehearsal'],
            ]}
          />
        </Section>

        <Section id="metrics" title="13. Success Metrics &amp; KPIs">
          <Table
            headers={['Metric', 'Target', 'Measurement']}
            rows={[
              ['Frame rate', '≥ 60 fps @ 100 particles', 'Three.js Stats panel during demo'],
              ['Scenario switch time', '< 500ms', 'console.time around reset'],
              ['Scenarios functional', '3 / 3', 'Manual QA checklist'],
              ['Wow moment latency', '< 30s', 'User test timer (5 testers)'],
              ['NPS score', '> 40', 'Post-demo Google Form'],
              ['API correctness', '3/3 endpoints returning valid JSON', 'Postman collection'],
            ]}
          />
        </Section>

        <Section id="risks" title="14. Risk Register &amp; Mitigation">
          <Table
            headers={['Risk', 'P', 'Impact', 'Mitigation']}
            rows={[
              ['Physics-render sync stutter', 'High', 'High', 'Fixed 1/60 timestep + interpolation; decouple with ref'],
              ['FPS drops below 30', 'Med', 'High', 'Reduce particleCount cap to 150; use InstancedMesh (already in)'],
              ['Cannon-ES API confusion', 'Low', 'High', '2h docs review Hour 0; pair Dev A + D for setup'],
              ['Shader complexity overrun', 'Med', 'Med', 'Fallback to MeshStandardMaterial; ForceField is pure Three.js geometry'],
              ['Vercel cold-start latency', 'Low', 'Low', 'All sim logic is client-side; API routes are trivial'],
              ['3D rendering entirely broken', 'Low', 'High', 'Fallback: p5.js 2D canvas, swap in 30min'],
            ]}
          />
        </Section>

        <Section id="limits" title="15. Known Limitations &amp; Out of Scope">
          <div className="grid grid-cols-2 gap-3">
            {[
              'Multiplayer / collaborative view',
              'AR / VR integration',
              'Custom physics formula editor',
              'Video / GIF export',
              'Relativity / quantum effects',
              'Mobile-first layout',
              'Persistent user state / accounts',
              'Advanced ML anomaly detection',
            ].map(l => (
              <div key={l} className="flex items-center gap-2 text-sm text-slate-500 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                <span className="text-red-500">✕</span> {l}
              </div>
            ))}
          </div>
        </Section>

        <Section id="deploy" title="16. Deployment &amp; DevOps">
          <Table
            headers={['Step', 'Tool', 'Detail']}
            rows={[
              ['Source control', 'Git + GitHub', 'Single repo, feature branches per dev, merge to main'],
              ['CI', 'Vercel GitHub Integration', 'Auto-deploy preview URL on every PR push'],
              ['Production deploy', 'Vercel (Edge Network)', 'next build → vercel --prod; ~2min deploy time'],
              ['Environment vars', '.env.local → Vercel dashboard', 'None required for MVP (all client-side)'],
              ['Monitoring', 'Vercel Analytics', 'Page views, TTFB, Core Web Vitals'],
              ['Error tracking', 'console.error + Vercel logs', 'Sufficient for 48h hackathon scope'],
            ]}
          />
        </Section>

        <div className="mt-16 pt-8 border-t border-white/10 text-center text-slate-600 text-sm">
          Generated by 3-agent hackathon research system · Next.js 16 + Three.js + Cannon-ES · Vercel
        </div>
      </div>
    </div>
  );
}
