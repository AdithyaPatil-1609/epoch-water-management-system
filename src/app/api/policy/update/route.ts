import { NextRequest, NextResponse } from 'next/server';
import { updatePolicyMode } from '@/lib/policy/config';

export async function POST(request: NextRequest) {
 try {
  const body = await request.json();
  const updated = updatePolicyMode({
   fairnessWeight: typeof body.fairnessWeight === 'number' ? body.fairnessWeight : undefined,
   pressureWeight: typeof body.pressureWeight === 'number' ? body.pressureWeight : undefined,
   emergencyPriorityWeight: typeof body.emergencyPriorityWeight === 'number' ? body.emergencyPriorityWeight : undefined,
  });

  return NextResponse.json({ success: true, policyMode: updated });
 } catch (error: any) {
  return NextResponse.json({ success: false, error: error.message }, { status: 400 });
 }
}
