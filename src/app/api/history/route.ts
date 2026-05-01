import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/data-cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const zoneId = searchParams.get("zone_id");

  if (!zoneId) {
    return NextResponse.json({ error: "zone_id is required" }, { status: 400 });
  }

  const history = getHistory(zoneId);
  
  if (history.length === 0) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  return NextResponse.json({ zone_id: zoneId, history });
}
