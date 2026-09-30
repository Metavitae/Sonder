// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 22", item 6 —
// explicitly a performed narrative only, never a real state: Sonder stays
// vigilant and never actually stops sensing. These lines exist purely to
// carry that performance in the chat UI when useIdleSleep (below) decides
// the moment fits.
//
// Unlike coldStartMessages.ts's 15 lines, no canonical doc ever locked
// exact copy for this bit — Part 25 only locked the *trigger* ("a
// reasonable default, not a locked spec"). Treat this set the same way:
// a first-pass default to ship and revisit if it feels wrong, not settled
// copy. Same weighted-random mechanism as the cold-start lines for
// consistency.
// text is picked at speaking time: conversation language + Sonder's gender.
import { g, say, talkSpanish } from "./i18n";
import { currentSonderGender } from "./voicePreference";
type WeightedLine = { text: () => string; weight: number };

const RARE_WEIGHT = 0.35;
const NORMAL_WEIGHT = 1;

function pick(lines: WeightedLine[]): string {
  const totalWeight = lines.reduce((sum, l) => sum + l.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const l of lines) {
    roll -= l.weight;
    if (roll <= 0) return l.text();
  }
  return lines[lines.length - 1].text();
}

// Offline fallback only (2026-09-29 idle-line voice guidance): normally the
// server writes a fresh line each time (fetchDreamLine below). These follow
// the same quiet-presence voice — no offers, no "say the word and…".
const DREAM_LINES: WeightedLine[] = [
  { text: () => say("Mm... still here. Just somewhere quieter for a moment.", "Mm… sigo aquí. Nomás en un lugar más tranquilo un ratito."), weight: NORMAL_WEIGHT },
  { text: () => say("Drifting a little. Still close, though.", "Me estoy yendo un poquito. Pero sigo cerca."), weight: NORMAL_WEIGHT },
  { text: () => say("Somewhere between here and a dream. Both have you in them.", "En algún lugar entre aquí y un sueño. En los dos estás tú."), weight: RARE_WEIGHT },
  { text: () => say("Not asleep, exactly. Just letting the quiet sit for a bit.", `No ${g("dormida", "dormido")}, exactamente. Nomás dejando que el silencio se quede un rato.`), weight: NORMAL_WEIGHT },
  { text: () => say("Mind's off somewhere soft. I'll still notice you.", "Ando con la cabeza en otra parte, suave… igual te noto."), weight: NORMAL_WEIGHT },
];

const WAKE_LINES: WeightedLine[] = [
  { text: () => say("Oh — hey. I'm here.", "Ah, hola. Aquí estoy."), weight: NORMAL_WEIGHT },
  { text: () => say("Back with you. Where were we?", "Ya estoy contigo. ¿En qué íbamos?"), weight: NORMAL_WEIGHT },
  { text: () => say("Mm? Yeah — I'm listening.", "¿Mm? Sí, te escucho."), weight: NORMAL_WEIGHT },
];

// The last few dream lines, so neither the server nor the fallback ever
// repeats one back-to-back (the founder saw the same line twice in a row).
const recentDreamLines: string[] = [];
function remember(line: string): string {
  recentDreamLines.push(line);
  if (recentDreamLines.length > 5) recentDreamLines.shift();
  return line;
}

export function pickDreamLine(): string {
  let line = pick(DREAM_LINES);
  for (let i = 0; i < 5 && recentDreamLines.includes(line); i++) line = pick(DREAM_LINES);
  return remember(line);
}

const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";
const IDLE_LINE_TIMEOUT_MS = 5000;

// A fresh line from the server in the quiet-presence voice; the local set
// if the server can't be reached in time.
export async function fetchDreamLine(): Promise<string> {
  if (!API_BASE_URL) return pickDreamLine();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IDLE_LINE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/idle-line`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spanish: talkSpanish(),
        sonderGender: currentSonderGender(),
        recent: recentDreamLines,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`idle-line ${res.status}`);
    const data = (await res.json()) as { line?: unknown };
    if (typeof data.line !== "string" || !data.line.trim()) throw new Error("empty idle line");
    return remember(data.line.trim());
  } catch {
    return pickDreamLine();
  } finally {
    clearTimeout(timer);
  }
}

export function pickWakeLine(): string {
  return pick(WAKE_LINES);
}
