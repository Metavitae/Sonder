import type { MistColor } from "../components/SpriteMistPoC";
import type { Mood } from "./useSonderChat";

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 21": drive the
// mist's color/pulse from the mood tag Sonder's own reply carries. The
// mist's 5-color palette (blue/cyan/amber/magenta/violet) predates this —
// it came from AmbientMist's original five-primaries design (Part 5's doc),
// not something built around warm/cool/neutral. This mapping is the first
// real bridge between the two: warmth picks a color family (cool → blue
// spectrum, warm → amber/magenta spectrum, neutral → violet), arousal picks
// which member of that family (calmer vs. more energized), and separately
// scales SpriteMistPoC's `intensity` (its pulse cadence) continuously.
export function moodToMist(mood: Mood): { color: MistColor; intensity: number } {
  const intensity = mood.arousal === "low" ? 0.15 : mood.arousal === "high" ? 0.9 : 0.5;

  if (mood.warmth === "neutral") {
    return { color: "violet", intensity };
  }
  if (mood.warmth === "cool") {
    return { color: mood.arousal === "low" ? "blue" : "cyan", intensity };
  }
  // warm
  return { color: mood.arousal === "low" ? "amber" : "magenta", intensity };
}
