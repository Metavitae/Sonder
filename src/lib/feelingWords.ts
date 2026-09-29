import type { MistColor } from "./mistAtlas";
import { t } from "./i18n";

// Founder, 2026-09-29: the user needs a way to know what the mist's colors
// and the two handwritings mean — a key on the diary's first page ("inside
// cover"), plus tapping one of Sonder's lines to see how Sonder felt when it
// wrote it. Both read from here so they always say the same thing.
//
// The meanings follow moodToMist.ts: neutral → violet key (shown silver);
// cool → blue key (sky blue, calm) or cyan key (green, livelier); warm →
// amber key (gold, calm) or magenta key (red, livelier). Spanish is
// written without gendered adjectives (Sonder has no set gender).
// DRAFT wording for founder review.

// Order on the key page: steady first, then cool, then warm.
export const FEELING_ORDER: MistColor[] = ["violet", "blue", "cyan", "amber", "magenta"];

export function colorName(color: MistColor): string {
  switch (color) {
    case "violet":
      return t("Silver", "Plata");
    case "blue":
      return t("Sky blue", "Azul cielo");
    case "cyan":
      return t("Green", "Verde");
    case "amber":
      return t("Gold", "Dorado");
    case "magenta":
      return t("Red", "Rojo");
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
