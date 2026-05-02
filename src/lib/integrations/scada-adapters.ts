// ──────────────────────────────────────────────────────────────
// SCADA Integration Adapters
// Production-ready stubs for Siemens SCADA REST, MQTT smart
// meters, and OpenWeatherMap. Switch from mock to real via env vars.
// ──────────────────────────────────────────────────────────────

import type { ScadaReading } from "@/lib/scada-simulator";
import type { ExogenousFactors } from "@/lib/demand-forecaster";

// ─── Siemens SCADA REST Adapter ───────────────────────────────

export interface SiemensScadaConfig {
  base_url: string;
  api_key: string;
  plant_id: string;
}

export async function fetchFromSiemensSCADA(
  zone_id: string,
  config: SiemensScadaConfig
): Promise<ScadaReading | null> {
  // Production: uncomment and replace with real endpoint
  // const res = await fetch(`${config.base_url}/api/v1/readings/${zone_id}`, {
  //   headers: { "X-API-Key": config.api_key, "X-Plant-ID": config.plant_id },
  // });
  // if (!res.ok) return null;
  // const data = await res.json();
  // return mapSiemensToScadaReading(zone_id, data);

  // Mock fallback
  const { getScadaSimulator } = await import("@/lib/scada-simulator");
  return getScadaSimulator().getReading(zone_id);
}

// ─── MQTT Smart Meter Adapter ─────────────────────────────────

export interface MqttConfig {
  broker_url: string;
  topics: string[]; // e.g. ["city/water/zone-a/flow"]
  client_id: string;
}

export interface MqttSubscription {
  unsubscribe: () => void;
  onReading: (handler: (reading: ScadaReading) => void) => void;
}

/**
 * Subscribe to MQTT smart meter topic stream.
 * In production: install 'mqtt' package and replace with real client.
 * For hackathon: uses interval-based mock.
 */
export function subscribeToSmartMeters(
  config: MqttConfig,
  onReading: (reading: ScadaReading) => void
): { unsubscribe: () => void } {
  // Production implementation would be:
  // import mqtt from 'mqtt';
  // const client = mqtt.connect(config.broker_url, { clientId: config.client_id });
  // client.subscribe(config.topics);
  // client.on('message', (topic, payload) => {
  //   const data = JSON.parse(payload.toString());
  //   onReading(mapMqttToScadaReading(topic, data));
  // });
  // return { unsubscribe: () => client.end() };

  // Mock: emit readings every 15 seconds
  let active = true;
  const zones = ["Zone-A","Zone-B","Zone-C","Zone-D","Zone-E"];

  const interval = setInterval(async () => {
    if (!active) return;
    const { getScadaSimulator } = await import("@/lib/scada-simulator");
    const sim = getScadaSimulator();
    const zone = zones[Math.floor(Math.random() * zones.length)];
    onReading(sim.getReading(zone));
  }, 15_000);

  return { unsubscribe: () => { active = false; clearInterval(interval); } };
}

// ─── OpenWeatherMap Adapter ───────────────────────────────────

export interface WeatherData {
  temperature_c: number;
  rainfall_mm: number;
  humidity_percent: number;
  description: string;
}

export async function fetchWeatherData(
  lat: number,
  lng: number
): Promise<WeatherData> {
  const api_key = process.env.OPENWEATHERMAP_API_KEY;

  if (api_key) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${api_key}&units=metric`
      );
      if (res.ok) {
        const data = await res.json();
        return {
          temperature_c: data.main.temp,
          rainfall_mm: data.rain?.["1h"] ?? 0,
          humidity_percent: data.main.humidity,
          description: data.weather[0]?.description ?? "",
        };
      }
    } catch {
      // Fall through to mock
    }
  }

  // Mock: Bangalore winter defaults
  return { temperature_c: 27, rainfall_mm: 0, humidity_percent: 60, description: "clear sky (mock)" };
}

// ─── Factory: pick mock or real based on env ──────────────────

export function getScadaSource(): "siemens" | "mqtt" | "mock" {
  if (process.env.SIEMENS_SCADA_API_KEY) return "siemens";
  if (process.env.MQTT_BROKER_URL) return "mqtt";
  return "mock";
}

export async function buildExogenousFactors(lat = 12.97, lng = 77.59): Promise<ExogenousFactors> {
  const weather = await fetchWeatherData(lat, lng);
  const now = new Date();
  const dow = now.getDay();
  return {
    temperature_c: weather.temperature_c,
    rainfall_mm: weather.rainfall_mm,
    is_weekend: dow === 0 || dow === 6,
    is_holiday: false, // Could integrate public holiday calendar
    hour_of_day: now.getHours(),
    season: "winter",
  };
}
