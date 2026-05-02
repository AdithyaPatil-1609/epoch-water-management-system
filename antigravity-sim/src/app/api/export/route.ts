import { NextRequest, NextResponse } from 'next/server';

const VALID = ['inversion', 'levitation', 'repulsion'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scenario = searchParams.get('scenario') ?? 'inversion';

  if (!VALID.includes(scenario)) {
    return NextResponse.json({ error: `Unknown scenario "${scenario}"` }, { status: 422 });
  }

  // Generate representative export — in production the client would POST real positions
  const count = 80;
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    position: [
      parseFloat(((Math.random() - 0.5) * 14).toFixed(3)),
      parseFloat((1 + Math.random() * 5).toFixed(3)),
      parseFloat(((Math.random() - 0.5) * 14).toFixed(3)),
    ],
    velocity: [
      parseFloat(((Math.random() - 0.5) * 2).toFixed(3)),
      parseFloat(((Math.random() - 0.5) * 2).toFixed(3)),
      parseFloat(((Math.random() - 0.5) * 2).toFixed(3)),
    ],
  }));

  return NextResponse.json({
    scenario,
    exportedAt: new Date().toISOString(),
    params: { gravityStrength: 9.81, fieldRadius: 6, particleCount: count, slowMo: 1, restitution: 0.4 },
    particles,
  });
}
