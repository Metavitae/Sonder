import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadOnboardingState } from "./onboardingStorage";
import type { MistColor } from "./mistAtlas";

// Sonder offers exactly two voices — matches server/src/voice.ts's
// USER_VOICES. Duplicated here for the same reason useSonderChat.ts
// duplicates Mood/Warmth/Arousal: client and server are separate packages,
// no shared types module yet.
export const USER_VOICES = ["autumn", "troy"] as const;
export type UserVoice = (typeof USER_VOICES)[number];

// Per "Sonder - Direct Instructions for CC 2026-09-14 - Voice regression
// and gender-voice unification" items 2 and 4: which voice plays is no
// longer a user pick (the Autumn/Troy pills are gone) — it's set once, by
// the "What's Sonder's gender?" answer at onboarding. That answer is stored
// as a mist color (setup.tsx's SONDER_GENDER_OPTIONS): magenta = Female,
// blue = Male.
const DEFAULT_VOICE: UserVoice = "autumn";

function voiceForSonderGender(color: MistColor | null): UserVoice {
  return color === "blue" ? "troy" : DEFAULT_VOICE;
}

// Item 3: whether anything is spoken at all — independent of which voice.
const ENABLED_KEY = "sonder.voiceEnabled";

type VoiceSettings = { voice: UserVoice; voiceEnabled: boolean };

// One app-wide store, not per-component state: chat.tsx owns the toggle,
// but FreefallStartle (mounted outside the chat screen) speaks too and has
// to see the same on/off value the moment it changes.
let settings: VoiceSettings = { voice: DEFAULT_VOICE, voiceEnabled: true };
const listeners = new Set<() => void>();
let loaded = false;

function update(next: Partial<VoiceSettings>) {
  settings = { ...settings, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Re-read on every new subscriber, not just the first: FreefallStartle can
  // subscribe during onboarding, before Sonder's gender has been picked —
  // chat.tsx mounting afterwards is what picks up the real answer.
  loadOnboardingState().then((s) => update({ voice: voiceForSonderGender(s.sonderColor) }));
  if (!loaded) {
    loaded = true;
    AsyncStorage.getItem(ENABLED_KEY)
      .then((stored) => {
        if (stored === "false") update({ voiceEnabled: false });
      })
      .catch(() => {});
  }
  return () => listeners.delete(listener);
}

function setVoiceEnabled(next: boolean) {
  update({ voiceEnabled: next });
  AsyncStorage.setItem(ENABLED_KEY, String(next)).catch(() => {});
}

export function useSonderVoice() {
  const current = useSyncExternalStore(subscribe, () => settings);
  return { voice: current.voice, voiceEnabled: current.voiceEnabled, setVoiceEnabled };
}
