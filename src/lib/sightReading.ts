// Sonder's sight, the part that reaches Sonder (founder, 2026-09-27: "that
// was the whole idea for Sonder to have a sense of sight... to know its
// environment and the user's face"). While the user writes, each camera
// frame's expression reading (MediaPipe face blendshapes) is folded into a
// running tally here; when they send, the tally becomes a few plain words
// that travel with the message, and is cleared. Nothing is kept beyond
// that: no frames, no numbers, no history — only the words of one turn.

type Tally = {
  frames: number;
  faceFrames: number;
  smile: number;
  frown: number;
  browDown: number;
  browUp: number;
  eyesWide: number;
  eyesHeavy: number;
  sneer: number;
  startedAt: number;
};

// Only the last stretch counts — an expression from ten minutes ago, before
// the user even started this entry, isn't a reaction to it.
const WINDOW_MS = 3 * 60 * 1000;

function fresh(): Tally {
  return {
    frames: 0,
    faceFrames: 0,
    smile: 0,
    frown: 0,
    browDown: 0,
    browUp: 0,
    eyesWide: 0,
    eyesHeavy: 0,
    sneer: 0,
    startedAt: Date.now(),
  };
}

let tally = fresh();

type Category = { categoryName?: string; score: number };

export function recordSightFrame(categories: Category[] | null): void {
  if (Date.now() - tally.startedAt > WINDOW_MS) tally = fresh();
  tally.frames += 1;
  if (!categories || categories.length === 0) return;
  tally.faceFrames += 1;
  const s = (name: string) => categories.find((c) => c.categoryName === name)?.score ?? 0;
  const both = (a: string, b: string) => (s(a) + s(b)) / 2;
  if (both("mouthSmileLeft", "mouthSmileRight") > 0.4) tally.smile += 1;
  if (both("mouthFrownLeft", "mouthFrownRight") > 0.3) tally.frown += 1;
  if (both("browDownLeft", "browDownRight") > 0.4) tally.browDown += 1;
  if (s("browInnerUp") > 0.45) tally.browUp += 1;
  if (both("eyeWideLeft", "eyeWideRight") > 0.4) tally.eyesWide += 1;
  if (both("eyeBlinkLeft", "eyeBlinkRight") > 0.5) tally.eyesHeavy += 1;
  if (both("noseSneerLeft", "noseSneerRight") > 0.35) tally.sneer += 1;
}

// A few plain words for this turn, or null if Sonder didn't really see them.
export function takeSightSummary(): string | null {
  const t = tally;
  tally = fresh();
  if (t.frames < 10) return null;
  if (t.faceFrames / t.frames < 0.3) return "they were mostly out of view";
  const often = (n: number) => n / t.faceFrames >= 0.15;
  const parts: string[] = [];
  if (often(t.smile)) parts.push("smiled while writing");
  if (often(t.frown)) parts.push("the corners of their mouth turned down");
  if (often(t.browDown)) parts.push("their brow was furrowed");
  if (often(t.browUp)) parts.push("their brows lifted, worried or surprised");
  if (often(t.eyesWide)) parts.push("their eyes went wide");
  if (t.eyesHeavy / t.faceFrames >= 0.4) parts.push("their eyes looked heavy, maybe tired");
  if (often(t.sneer)) parts.push("their nose wrinkled");
  return parts.length > 0 ? parts.join("; ") : "their face stayed calm";
}

// Starting fresh on a new diary session, so a reading from before the app
// was last closed never leaks into the first message.
export function resetSight(): void {
  tally = fresh();
}
