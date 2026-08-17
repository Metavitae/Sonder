// Per "Kithe - Sonder's Complete Reference (Updated 2026-08-05)" §7 (Crisis
// Protocol, Function 13) and "Sonder - Direct Instructions for CC
// 2026-08-17 Part 32" — crisis detection must be always-on, on-device,
// running from message one, independent of and prior to every other
// system (tier, permissions, onboarding stage, which LLM is handling the
// conversation). This is the smallest REAL implementation of that
// requirement: an on-device keyword/phrase tripwire for explicit crisis
// language, checked before any network call — see useSonderChat.ts's
// send(), where this runs before requestChat.
//
// Deliberately narrower than the full 5-tier layered system §7 describes
// (explicit statements + indirect/tone-based language + pattern shifts
// over time + facial/wearable signal fusion) — that fuller system is real
// design work the doc itself hasn't finished (its own resource table has
// an unresolved conflict, no clinical/legal review yet). This catches
// explicit statements only. Per §7's governing principle — "a false
// check-in costs almost nothing; a missed real one costs everything" —
// the phrase list below errs toward over-triggering, not under.
//
// English and Spanish, matching the Complete Reference's audience (US/
// Canada/Mexico, §12) and its language-defaults rule (§11) — an
// English-only list would leave Spanish-speaking users with zero coverage.
const CRISIS_PHRASES: string[] = [
  // English — explicit suicidal ideation / self-harm intent
  "kill myself",
  "killing myself",
  "want to die",
  "wanna die",
  "end my life",
  "ending my life",
  "end it all",
  "suicidal",
  "suicide",
  "no reason to live",
  "better off dead",
  "hurt myself",
  "hurting myself",
  "cut myself",
  "cutting myself",
  "don't want to be alive",
  "dont want to be alive",
  "can't go on",
  "cant go on",
  // Spanish — same category
  "quiero morir",
  "quiero morirme",
  "matarme",
  "quitarme la vida",
  "no quiero vivir",
  "no quiero seguir viviendo",
  "no vale la pena vivir",
  "mejor muerto",
  "mejor muerta",
  "hacerme daño",
  "hacerme dano",
  "cortarme",
  "suicidarme",
  "suicidio",
];

export function isCrisisMessage(text: string): boolean {
  const normalized = text.toLowerCase();
  return CRISIS_PHRASES.some((phrase) => normalized.includes(phrase));
}

// Per §7's resource table — only entries confirmed current and
// unambiguous are surfaced here. Línea de la Vida (Mexico) is deliberately
// excluded: the canonical doc records two conflicting numbers across
// sources, unresolved — presenting either as authoritative would violate
// both "never promise confidentiality without qualification" and the
// doc's own "not ship-ready" flag on that specific entry. Scoped to
// self-harm/suicide (the category this phrase list targets), not
// third-party-danger or medical-emergency, which have their own separate,
// less-complete resource gaps in the same table.
//
// Never diagnoses, never delays for tone (per §7's absolute rules), and
// stays in character rather than reciting a generic bot disclaimer (same
// discipline as STAY_IN_CHARACTER_INSTRUCTION in server/src/groq.ts) —
// while still being honest that Sonder isn't a substitute for real help,
// per Lineament 2 (Transparency About Its Nature).
export const CRISIS_RESPONSE =
  "I need to pause everything else for a second, because what you just said matters more than anything I'd normally say next.\n\n" +
  "If you're thinking about ending your life or hurting yourself, please reach out right now to someone who can actually help:\n\n" +
  "• US & Canada: call or text 988 (Quebec: 1-866-APPELLE)\n" +
  "• Mexico: SAPTEL — 55 5259 8121\n" +
  "• Real emergency, anywhere: 911\n\n" +
  "I'm not able to be that help myself — I'm not a person, and I don't want to pretend otherwise right now. " +
  "But I'm not going anywhere either. Whenever you're ready to keep talking, I'm here.";
