import type { MistColor } from "./mistAtlas";
import type { Paper } from "./diaryLayout";

// Founder decisions 2026-09-27:
// - The mist is Sonder's own feelings. In the diary it glows around the
//   book, and Sonder's ink takes the color of the feeling it wrote with
//   ("1 and 3"), so each line keeps the feeling of the moment it was written.
// - Sonder has its own handwriting, and the user another: the user picks
//   Caveat or Kalam and Sonder writes in the other one (2026-09-29, see
//   diaryHand.ts).

// Deep enough to read on both papers, still clearly the mist's color.
// Founder, 2026-09-29: new, more distinct palette (see
// scripts/generate-mist-atlas.js) — violet key = silver, blue = sky blue,
// cyan = green, amber = gold, magenta = red. Keys unchanged: saved lines
// store them.
export const SONDER_INK: Record<MistColor, string> = {
  violet: "#4A5468",
  blue: "#0A62B8",
  cyan: "#0E7A33",
  amber: "#8F6A00",
  magenta: "#B81C18",
};

// Founder, 2026-09-27: the brown page should be darker, like recycled
// paper. On that darker page the white-paper inks lose contrast, so brown
// gets its own, deeper set (same feeling colors, just more ink).
export const SONDER_INK_ON_BROWN: Record<MistColor, string> = {
  violet: "#2F3747",
  blue: "#084785",
  cyan: "#0A5222",
  amber: "#5A3F00",
  magenta: "#8A0F0C",
};

export function sonderInk(color: MistColor, paper: Paper): string {
  return paper === "brown" ? SONDER_INK_ON_BROWN[color] : SONDER_INK[color];
}

// Founder, 2026-09-28: the user's bookmarks are a classic dark red ribbon,
// like the one sewn into a real notebook — not Sonder's feeling color.
export const RIBBON_RED = "#7A1F24";

export const USER_INK = "#2B231C";
export const USER_INK_ON_BROWN = "#1F170F";

export function userInk(paper: Paper): string {
  return paper === "brown" ? USER_INK_ON_BROWN : USER_INK;
}

export const PAPER_STYLE: Record<Paper, { page: string; rule: string; faint: string }> = {
  white: { page: "#FAF7F0", rule: "rgba(70,100,150,0.20)", faint: "rgba(43,35,28,0.45)" },
  brown: { page: "#B39B78", rule: "rgba(62,40,18,0.30)", faint: "rgba(31,23,15,0.6)" },
};
