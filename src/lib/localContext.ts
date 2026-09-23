import * as Location from "expo-location";

// Per "Sonder - Direct Instructions for CC 2026-09-14 - Proactive
// conversation and coarse-location weather" items 1-2: what's true around
// the user right now, sent along with each chat turn so Sonder can mention
// it naturally (server/src/groq.ts's LOCAL_CONTEXT_NOTE).
//
// Privacy shape, deliberately: coarse (approximate) location only — fine
// location is blocked in app.json — rounded further to one decimal (~11km)
// before it leaves this function, used only to ask Open-Meteo for current
// conditions, then dropped. Only the short weather summary ever reaches
// Sonder's server; coordinates are never stored, logged, or sent there.
// Open-Meteo needs no key or account. Its free tier is for non-commercial
// use — fine pre-launch, but it needs a paid plan (or another provider)
// before Kithe ships commercially.

// Day of week + clock time, from the phone's own clock — no permission.
export function localTimeLabel(now = new Date()): string {
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

// WMO weather codes (Open-Meteo's `weather_code`) → plain words.
function describeWeatherCode(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzly";
  if (code <= 67) return "rainy";
  if (code <= 77) return "snowy";
  if (code <= 82) return "showery";
  if (code <= 86) return "snow showers";
  return "stormy";
}

const WEATHER_CACHE_MS = 30 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 4000;
let cached: { summary: string; at: number } | null = null;

// null whenever location isn't granted or anything fails — weather is a
// nice-to-have, never something a chat turn waits on or errors over.
export async function currentWeatherSummary(): Promise<string | null> {
  if (cached && Date.now() - cached.at < WEATHER_CACHE_MS) return cached.summary;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
    const lat = position.coords.latitude.toFixed(1);
    const lon = position.coords.longitude.toFixed(1);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        "&current=temperature_2m,weather_code,is_day",
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const current = data?.current;
    if (typeof current?.temperature_2m !== "number" || typeof current?.weather_code !== "number") {
      return null;
    }
    const summary =
      `${describeWeatherCode(current.weather_code)}, ${Math.round(current.temperature_2m)}°C` +
      (current.is_day === 0 ? ", dark out" : "");
    cached = { summary, at: Date.now() };
    return summary;
  } catch {
    return null;
  }
}
