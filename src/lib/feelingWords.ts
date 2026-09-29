import type { MistColor } from "./mistAtlas";
import { t } from "./i18n";

// Founder, 2026-09-29: the user needs a way to know what the mist's colors
// and the two handwritings mean — a key on the diary's first page ("inside
// cover"), plus tapping one of Sonder's lines to see how Sonder felt when it
// wrote it. Both read from here so they always say the same thing.
//
// The meanings follow moodToMist.ts: neutral → violet; cool → blue (calm)
// or cyan (livelier); warm → amber (calm) or magenta (livelier). Spanish is
// written without gendered adjectives (Sonder has no set gender).
// DRAFT wording for founder review.

// Order on the key page: steady first, then cool, then warm.
export const FEELING_ORDER: MistColor[] = ["violet", "blue", "cyan", "amber", "magenta"];

export function colorName(color: MistColor): string {
  switch (color) {
    case "violet":
      return t("Violet", "Violeta");
    case "blue":
      return t("Blue", "Azul");
    case "cyan":
      return t("Turquoise", "Turquesa");
    case "amber":
      return t("Amber", "Ámbar");
    case "magenta":
      return t("Magenta", "Magenta");
  }
}

// How Sonder feels in that color — short, to finish "I wrote this feeling…".
export function feelingWords(color: MistColor): string {
  switch (color) {
    case "violet":
      return t("steady", "en equilibrio");
    case "blue":
      return t("quiet and reflective", "en silencio, pensando");
    case "cyan":
      return t("clear and curious", "con la mente clara y curiosa");
    case "amber":
      return t("warm and gentle", "con cariño y calma");
    case "magenta":
      return t("warm and lit up", "con alegría y emoción");
  }
}

// What a tap on one of Sonder's lines shows.
export function feelingNote(color: MistColor): string {
  return t(`I wrote this feeling ${feelingWords(color)}.`, `Escribí esto ${feelingWords(color)}.`);
}
