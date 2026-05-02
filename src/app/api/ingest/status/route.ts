import { NextResponse } from "next/server";

export async function GET() {
  const lastUpdate = new Date().toISOString();
  return NextResponse.json({
    data_freshness: "FRESH",
    last_reading_timestamp: lastUpdate,
    seconds_ago: 0,
    zones_reporting: [
      "Zone-A","Zone-B","Zone-C","Zone-D","Zone-E","Zone-F","Zone-G",
      "Zone-H","Zone-I","Zone-J","Zone-K","Zone-L","Zone-M","Zone-N",
      "Zone-O","Zone-P","Zone-Q","Zone-R","Zone-S","Zone-T",
    ],
    zones_offline: [],
  });
}
