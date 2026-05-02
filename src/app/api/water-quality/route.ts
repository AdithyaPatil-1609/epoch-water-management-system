import { NextResponse } from "next/server";
import { generateQualityReport } from "@/lib/water-quality-manager";

export async function GET() {
  const report = generateQualityReport();
  return NextResponse.json(report);
}
