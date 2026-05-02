import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    scenarios: ['inversion', 'levitation', 'repulsion'],
    defaults: {
      gravityStrength: 9.81,
      fieldRadius: 6,
      particleCount: 80,
      slowMo: 1,
      restitution: 0.4,
    },
    scenarioMeta: {
      inversion:  { label: 'Gravity Inversion', icon: '↑', accentColor: '#6366f1' },
      levitation: { label: 'Levitation Field',  icon: '◎', accentColor: '#10b981' },
      repulsion:  { label: 'Repulsion Zone',    icon: '✦', accentColor: '#f59e0b' },
    },
  });
}
