import { NextResponse } from "next/server";
import { generateProactiveRedistributions } from "@/lib/proactive-redistribution";

export async function GET() {
  const plans = generateProactiveRedistributions();
  return NextResponse.json({ plans });
}
