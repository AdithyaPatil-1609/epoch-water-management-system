import { NextRequest, NextResponse } from 'next/server';
import { registerEmergency } from '@/lib/emergency/core';

export async function POST(request: NextRequest) {
 try {
  const body = await request.json();
  const { region, type, severity, required_resources } = body;

  if (!region || !type || !severity) {
   return NextResponse.json({ success: false, error: 'Missing required parameters: region, type, severity' }, { status: 400 });
  }

  const registered = registerEmergency({
   region,
   type,
   severity,
   required_resources: Array.isArray(required_resources) ? required_resources : [],
  });

  return NextResponse.json({ success: true, event: registered });
 } catch (error: any) {
  return NextResponse.json({ success: false, error: error.message }, { status: 400 });
 }
}
