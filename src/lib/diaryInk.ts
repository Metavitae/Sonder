import type { MistColor } from "./mistAtlas";
import type { Paper } from "./diaryLayout";

// Founder decisions 2026-09-27:
// - The mist is Sonder's own feelings. In the diary it glows around the
//   book, and Sonder's ink takes the color of the feeling it wrote with
//   ("1 and 3"), so each line keeps the feeling of the moment it was written.
// - Sonder has its own handwriting, and the user another. The real fonts are
//   the founder's pick (candidates offered: Caveat, Shantell Sans, Kalam) —
//   these are stand-ins until then; swapping is just these two values plus
//   loading the font files.
export const SONDER_FONT = "serif";
export const USER_FONT: string | undefined = undefined; // system sans

// Deep enough to read on both papers, still clearly the mist's color.
export const SONDER_INK: Record<MistColor, string> = {
  violet: "#5B3A9E",
  blue: "#1F4FA0",
  cyan: "#0B7285",
  amber: "#9A5700",
  magenta: "#A01E6A",
};

// Founder, 2026-09-27: the brown page should be darker, like recycled
// paper. On that darker page the white-paper inks lose contrast, so brown
// gets its own, deeper set (same feeling colors, just more ink).
export const SONDER_INK_ON_BROWN: Record<MistColor, string> = {
  violet: "#43257D",
  blue: "#153A7A",
  cyan: "#07505E",
  amber: "#6B3C00",
  magenta: "#78124E",
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
