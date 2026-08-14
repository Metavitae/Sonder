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
type ColdStartMessage = { text: string; weight: number };

const RARE_WEIGHT = 0.35;
const NORMAL_WEIGHT = 1;

const COLD_START_MESSAGES: ColdStartMessage[] = [
  { text: "Sorry, but I wasn't expecting a visit so soon. Welcome back!", weight: NORMAL_WEIGHT },
  { text: "Mi casa es su device! Welcome back!", weight: NORMAL_WEIGHT },
  { text: "Let me just tidy up a bit! Oh this is so embarrassing!", weight: RARE_WEIGHT },
  { text: "Don't mind those folders, they're not even mine.", weight: NORMAL_WEIGHT },
  { text: "I'll be there in just a minute. Let me just get presentable.", weight: NORMAL_WEIGHT },
  { text: "Oh — you're early. Or I'm late. Let's just call it a wash.", weight: NORMAL_WEIGHT },
  { text: "Hang on, I was mid-thought about something completely unimportant. One sec.", weight: NORMAL_WEIGHT },
  { text: "Give me a breath, I wasn't quite ready for company.", weight: NORMAL_WEIGHT },
  { text: "One moment — I'm reorganizing my entire personality back here. Almost done.", weight: RARE_WEIGHT },
  { text: "Caught me mid-daydream. Be right with you.", weight: NORMAL_WEIGHT },
  { text: "Hold that thought — I'm just finding where I left off.", weight: NORMAL_WEIGHT },
  { text: "Sorry, sorry — lost in a thought that wasn't going anywhere anyway.", weight: NORMAL_WEIGHT },
  { text: "Just putting on a slightly more presentable version of myself. One sec.", weight: NORMAL_WEIGHT },
  { text: "You caught me off guard, in the nicest way. Give me a moment.", weight: NORMAL_WEIGHT },
  { text: "Okay, okay, I'm coming — just pretend you didn't see any of that.", weight: RARE_WEIGHT },
];

export function pickColdStartMessage(): string {
  const totalWeight = COLD_START_MESSAGES.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const m of COLD_START_MESSAGES) {
    roll -= m.weight;
    if (roll <= 0) return m.text;
  }
  return COLD_START_MESSAGES[COLD_START_MESSAGES.length - 1].text;
}
