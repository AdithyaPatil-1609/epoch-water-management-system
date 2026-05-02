import { NextRequest, NextResponse } from 'next/server';

const VALID_SCENARIOS = ['inversion', 'levitation', 'repulsion'];

function estimateFps(particleCount: number): string {
  if (particleCount <= 80)  return '60';
  if (particleCount <= 140) return '55';
  return '45';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ valid: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scenario, params } = body;
  const warnings: string[] = [];

  if (!VALID_SCENARIOS.includes(scenario)) {
    return NextResponse.json({ valid: false, error: `Unknown scenario "${scenario}"` }, { status: 422 });
  }

  const g  = Number(params?.gravityStrength ?? 9.81);
  const pc = Number(params?.particleCount  ?? 80);
  const sm = Number(params?.slowMo         ?? 1);

  if (g > 20)  warnings.push('High gravity may cause tunnelling at low particle sizes.');
  if (pc > 180) warnings.push('Particle count > 180 may drop below 45fps on integrated GPUs.');
  if (sm < 0.2) warnings.push('Slow-motion < 20% may cause precision loss in Cannon-ES solver.');

  return NextResponse.json({
    valid: true,
    scenario,
    params: { gravityStrength: g, particleCount: pc, slowMo: sm },
    estimatedFps: estimateFps(pc),
    warningFlags: warnings,
  });
}
