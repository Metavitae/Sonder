import { getLocales } from "expo-localization";
import { currentSonderGender } from "./voicePreference";
import { looksSpanish } from "./replyLanguage";

// Founder decision 2026-09-25 ("A", then "go ahead"): the app's own text
// comes in Mexican Spanish when the phone is set to Spanish — no toggle,
// same spirit as Complete Reference §11 (Sonder follows the user, never
// makes them choose). Source of the wording: Drive Log "Sonder - Spanish
// (Mexico) app text - DRAFT for founder review 2026-09-25".

// Read once: a phone language change takes effect on the next app start.
export const uiSpanish: boolean = (() => {
  try {
    return getLocales()[0]?.languageCode === "es";
  } catch {
    return false;
  }
})();

// App text (buttons, onboarding, permissions): follows the phone.
export function t(en: string, es: string): string {
  return uiSpanish ? es : en;
}

// Sonder's own scripted lines (waking up, dozing off, the freefall gag)
// follow the conversation instead: the language the user last wrote in,
// or the phone's language before they've written anything.
let lastUserSpanish: boolean | null = null;

export function noteUserMessageLanguage(text: string): void {
  if (text.trim()) lastUserSpanish = looksSpanish(text);
}

export function talkSpanish(): boolean {
  return lastUserSpanish ?? uiSpanish;
}

export function say(en: string, es: string): string {
  return talkSpanish() ? es : en;
}

// Spanish words that change with Sonder's own gender ("lista"/"listo").
// The user's gender is never assumed anywhere in the app's text.
export function g(feminine: string, masculine: string): string {
  return currentSonderGender() === "male" ? masculine : feminine;
}
