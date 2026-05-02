import { NextRequest, NextResponse } from 'next/server';
import { getActiveEmergencies } from '@/lib/emergency/core';

export async function GET(request: NextRequest) {
 return NextResponse.json({ active: getActiveEmergencies() });
}
