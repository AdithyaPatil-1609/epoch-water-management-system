import { NextResponse } from "next/server";
import { resetCache } from "@/lib/data-cache";

// GET /api/reset — Clears the in-memory data cache and forces a full regeneration.
// Useful for demos to ensure fresh state after code changes.
export async function GET() {
  resetCache();
  return NextResponse.json({ success: true, message: "Cache cleared. Data will regenerate on next request." });
}
