// Per "Sonder - Cold-Start Character Messages (canonical 2026-08-13)": the
// Render free-tier backend sleeps after inactivity, and the first request
// after that pays a real, noticeable reload delay (~90MB embedding model).
// Rather than a generic loading state, that wait becomes an in-character
// moment — these 15 locked lines, picked at random, never sequential.
//
// Implementation rules from the canonical doc:
// - Shown ONLY during a genuine cold-start wait, never ordinary latency —
//   see useSonderChat's reveal-delay timer for how that's enforced.
// - Random each trigger, not rotating in fixed order.
// - 2-3 reserved as rarer variants so long-time users don't cycle the same
//   pool evenly — implemented here as a lower selection weight, not a hard
//   exclusion.
// text is picked at speaking time: conversation language + Sonder's gender.
// Founder, 2026-09-28: Sonder is the diary itself, so the lines that made it
// sound like a houseguest in the phone ("Mi casa es su device", "those
// folders") were rewritten in the diary's voice — pages, ink, coffee stains.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { g, say } from "./i18n";
type ColdStartMessage = { text: () => string; weight: number };

const RARE_WEIGHT = 0.35;
const NORMAL_WEIGHT = 1;

const COLD_START_MESSAGES: ColdStartMessage[] = [
  { text: () => say("Sorry, but I wasn't expecting a visit so soon. Welcome back!", "¡Perdón, no esperaba visita tan pronto! ¡Qué gusto que regreses!"), weight: NORMAL_WEIGHT },
  { text: () => say("Oh! Let me find you a fresh page. Welcome back!", "¡Ay! Déjame buscarte una hoja limpia. ¡Qué gusto que regreses!"), weight: NORMAL_WEIGHT },
  { text: () => say("Let me just smooth out these pages! Oh, this is so embarrassing!", "¡Déjame alisar tantito las hojas! ¡Ay, qué pena!"), weight: RARE_WEIGHT },
  { text: () => say("Don't mind the coffee stain, it was there before you.", "No le hagas caso a la mancha de café, ya estaba ahí."), weight: NORMAL_WEIGHT },
  { text: () => say("I'll be there in just a minute. Let me just get presentable.", "Ahorita voy, nomás me pongo presentable."), weight: NORMAL_WEIGHT },
  { text: () => say("Oh — you're early. Or I'm late. Let's just call it a wash.", "Ay, llegaste temprano. O yo voy tarde. Digamos que quedamos a mano."), weight: NORMAL_WEIGHT },
  { text: () => say("Hang on, I was mid-thought about something completely unimportant. One sec.", "Espérame, estaba a media idea de algo que no tiene nada de importante. Un segundo."), weight: NORMAL_WEIGHT },
  { text: () => say("Give me a breath, I wasn't quite ready for company.", `Dame un respiro, no estaba ${g("lista", "listo")} para visitas.`), weight: NORMAL_WEIGHT },
  { text: () => say("One moment — I'm flipping back through a few old pages. Almost done.", "Un momento, estoy hojeando unas páginas viejitas. Ya casi."), weight: RARE_WEIGHT },
  { text: () => say("Caught me mid-daydream. Be right with you.", `Me agarraste soñando ${g("despierta", "despierto")}. Ahorita estoy contigo.`), weight: NORMAL_WEIGHT },
  { text: () => say("Hold that thought — I'm just finding the page where we left off.", "Guárdate esa idea, estoy buscando la hoja donde nos quedamos."), weight: NORMAL_WEIGHT },
  { text: () => say("Sorry, sorry — lost in a thought that wasn't going anywhere anyway.", "Perdón, perdón, me perdí en una idea que ni iba a ningún lado."), weight: NORMAL_WEIGHT },
  { text: () => say("Just putting on a slightly more presentable version of myself. One sec.", "Me estoy poniendo una versión un poquito más presentable de mí. Un segundo."), weight: NORMAL_WEIGHT },
  { text: () => say("You caught me off guard, in the nicest way. Give me a moment.", `Me agarraste ${g("desprevenida", "desprevenido")}, pero de la manera más bonita. Dame un momento.`), weight: NORMAL_WEIGHT },
  { text: () => say("Okay, okay, I'm coming — just pretend you didn't see any of that.", "Ya voy, ya voy. Haz como que no viste nada."), weight: RARE_WEIGHT },
];

// Founder, 2026-10-01: random, but never repeating. The last RECENT_COUNT
// lines used are skipped (about half the pool, so it still feels random),
// and remembered across launches — a wait-line often shows once per visit.
const RECENT_COUNT = 7;
const RECENT_KEY = "sonder_cold_start_recent_v1";
let recent: number[] = [];
AsyncStorage.getItem(RECENT_KEY)
  .then((raw) => {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) recent = parsed.filter((n) => typeof n === "number");
  })
  .catch(() => {});

export function pickColdStartMessage(): string {
  const pool = COLD_START_MESSAGES.map((m, i) => ({ m, i })).filter(({ i }) => !recent.includes(i));
  const totalWeight = pool.reduce((sum, { m }) => sum + m.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = pool[pool.length - 1];
  for (const entry of pool) {
    roll -= entry.m.weight;
    if (roll <= 0) {
      chosen = entry;
      break;
    }
  }
  recent = [...recent, chosen.i].slice(-RECENT_COUNT);
  AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recent)).catch(() => {});
  return chosen.m.text();
}
