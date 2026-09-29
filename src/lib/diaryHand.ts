import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Founder decision 2026-09-29: the user picks their own handwriting in the
// diary — Caveat or Kalam (both Google Fonts, SIL Open Font License,
// embedded at build time by the expo-font plugin in app.json; on Android
// the family name is the file name). Sonder keeps its own hand. Kalam is
// the default because it's the easier of the two to read. Local only, same
// storage conventions as the paper choice (diaryPaper.ts).
export type Hand = "kalam" | "caveat";

// Caveat's letters are much smaller than Kalam's at the same size, so each
// gets its own size to sit alike on the 32pt ruled line.
export const HAND_STYLE: Record<Hand, { fontFamily: string; fontSize: number }> = {
  kalam: { fontFamily: "Kalam_400Regular", fontSize: 20 },
  caveat: { fontFamily: "Caveat_400Regular", fontSize: 27 },
};

const STORAGE_KEY = "sonder_diary_hand_v1";

export function useDiaryHand(): { hand: Hand; setHand: (h: Hand) => void } {
  const [hand, setHandState] = useState<Hand>("kalam");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "kalam" || v === "caveat") setHandState(v);
      })
      .catch(() => {});
  }, []);

  const setHand = useCallback((h: Hand) => {
    setHandState(h);
    AsyncStorage.setItem(STORAGE_KEY, h).catch(() => {});
  }, []);

  return { hand, setHand };
}
