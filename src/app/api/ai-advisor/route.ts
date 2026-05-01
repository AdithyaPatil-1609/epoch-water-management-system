import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AiAdvisorRequest {
 zones: Array<{
 zone_id: string;
 zone_name: string;
 severity: string;
 fulfillment_pct: number;
 pressure_bar: number;
 anomaly_type: string | null;
 }>;
 burstZoneIds: string[];
 deficitCount: number;
 avgPressure: number;
 mode: "normal" | "disaster";
}

export async function POST(request: NextRequest) {
 const apiKey = process.env.GEMINI_API_KEY;

 if (!apiKey || apiKey === "your_key_here") {
 return NextResponse.json(
 { error: "GEMINI_API_KEY not configured in .env.local", advice: [] },
 { status: 503 }
 );
 }

 try {
 const body: AiAdvisorRequest = await request.json();
 const { zones, burstZoneIds, deficitCount, avgPressure, mode } = body;

 const anomalousZones = zones.filter(z => z.severity !== "Normal");
 const criticalZones = zones.filter(z => z.severity === "Critical");
 const lowPressureZones = zones.filter(z => z.pressure_bar < 2.0);

 const prompt = `You are an AI water infrastructure advisor for UrbanFlow, a smart city water distribution system for an Indian urban utility.

Current network status:
- Mode: ${mode === "disaster" ? "DISASTER MODE" : "Normal Operations"}
- Average system pressure: ${avgPressure.toFixed(1)} bar
- Deficit zones: ${deficitCount}
- Anomalous zones (${anomalousZones.length}): ${anomalousZones.map(z => `${z.zone_name} [${z.severity}, ${z.fulfillment_pct}% supplied, ${z.pressure_bar.toFixed(1)} bar${z.anomaly_type ? ", type: " + z.anomaly_type : ""}]`).join("; ") || "none"}
- Critical zones (${criticalZones.length}): ${criticalZones.map(z => z.zone_name).join(", ") || "none"}
- Low pressure zones (<2.0 bar): ${lowPressureZones.map(z => `${z.zone_id} (${z.pressure_bar.toFixed(1)} bar)`).join(", ") || "none"}
${burstZoneIds.length > 0 ? `- PIPE BURST detected at: ${burstZoneIds.join(", ")}` : ""}

Provide exactly 4 concise, actionable recommendations for the water utility operator. Each recommendation must:
1. Be specific to the current data above
2. Reference actual zone names or IDs where relevant
3. Be 1-2 sentences maximum
4. Be practical and immediately actionable

Return ONLY a JSON array of 4 strings (the recommendations), no markdown, no extra text. Example format:
["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4"]`;

 const genAI = new GoogleGenerativeAI(apiKey);
 const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

 const result = await model.generateContent(prompt);
 const text = result.response.text().trim();

 // Parse the JSON array from Gemini's response
 const jsonMatch = text.match(/\[[\s\S]*\]/);
 if (!jsonMatch) throw new Error("Invalid response format from Gemini");

 const advice: string[] = JSON.parse(jsonMatch[0]);

 return NextResponse.json({ advice: advice.slice(0, 4) });
 } catch (error) {
 console.error("[/api/ai-advisor] Error:", error);
 return NextResponse.json(
 {
 error: error instanceof Error ? error.message : "Unknown error",
 advice: [],
 },
 { status: 500 }
 );
 }
}
