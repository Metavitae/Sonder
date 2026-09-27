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

export const USER_INK = "#2B231C";

export const PAPER_STYLE: Record<Paper, { page: string; rule: string; faint: string }> = {
  white: { page: "#FAF7F0", rule: "rgba(70,100,150,0.20)", faint: "rgba(43,35,28,0.45)" },
  brown: { page: "#D8C19A", rule: "rgba(95,62,28,0.26)", faint: "rgba(58,38,18,0.55)" },
};
