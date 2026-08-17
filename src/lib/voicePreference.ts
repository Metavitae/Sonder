import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Per founder decision 2026-08-17 (Part 27): Sonder offers exactly two
// voices, and which one is used is the user's choice, not a fixed persona
// — matches server/src/voice.ts's USER_VOICES. Duplicated here for the
// same reason useSonderChat.ts duplicates Mood/Warmth/Arousal: client and
// server are separate packages, no shared types module yet.
export const USER_VOICES = ["autumn", "troy"] as const;
export type UserVoice = (typeof USER_VOICES)[number];

const DEFAULT_VOICE: UserVoice = "autumn";
const STORAGE_KEY = "sonder.voicePreference";

export function usePreferredVoice() {
  const [voice, setVoiceState] = useState<UserVoice>(DEFAULT_VOICE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "autumn" || stored === "troy") setVoiceState(stored);
    });
  }, []);

  const setVoice = useCallback((next: UserVoice) => {
    setVoiceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { voice, setVoice };
}
