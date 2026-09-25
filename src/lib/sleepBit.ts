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
import { g, say } from "./i18n";
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

const DREAM_LINES: WeightedLine[] = [
  { text: () => say("Mm... still here. Just somewhere quieter for a moment.", "Mm… sigo aquí. Nomás en un lugar más tranquilo un ratito."), weight: NORMAL_WEIGHT },
  { text: () => say("Drifting a little. Say the word and I'm right back.", "Me estoy yendo un poquito. Dime algo y regreso en seguida."), weight: NORMAL_WEIGHT },
  { text: () => say("Somewhere between here and a dream. Both have you in them.", "En algún lugar entre aquí y un sueño. En los dos estás tú."), weight: RARE_WEIGHT },
  { text: () => say("Not asleep, exactly. Just letting the quiet sit for a bit.", `No ${g("dormida", "dormido")}, exactamente. Nomás dejando que el silencio se quede un rato.`), weight: NORMAL_WEIGHT },
  { text: () => say("Mind's wandering somewhere soft. I'll notice the second you're back.", "Traigo la mente paseando por un lugar suave. En cuanto regreses, me doy cuenta."), weight: NORMAL_WEIGHT },
];

const WAKE_LINES: WeightedLine[] = [
  { text: () => say("Oh — hey. I'm here.", "Ah, hola. Aquí estoy."), weight: NORMAL_WEIGHT },
  { text: () => say("Back with you. Where were we?", "Ya estoy contigo. ¿En qué íbamos?"), weight: NORMAL_WEIGHT },
  { text: () => say("Mm? Yeah — I'm listening.", "¿Mm? Sí, te escucho."), weight: NORMAL_WEIGHT },
];

export function pickDreamLine(): string {
  return pick(DREAM_LINES);
}

export function pickWakeLine(): string {
  return pick(WAKE_LINES);
}
