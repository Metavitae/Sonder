import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Founder, 2026-09-29: three text sizes, for people who need bigger
// writing. Everything in the diary follows the choice: whichever
// handwriting the user picked, theirs and Sonder's both grow by the same
// percentage (so Sonder stays proportionally smaller), and the ruled lines,
// photos, key page and notes grow with them. Local only, like the paper and
// handwriting choices.
export type TextSize = "normal" | "large" | "xlarge";

export const TEXT_SCALE: Record<TextSize, number> = {
  normal: 1,
  large: 1.2,
  xlarge: 1.4,
};

export const NEXT_TEXT_SIZE: Record<TextSize, TextSize> = {
  normal: "large",
  large: "xlarge",
  xlarge: "normal",
};

const STORAGE_KEY = "sonder_diary_text_size_v1";

export function useDiaryTextSize(): { textSize: TextSize; setTextSize: (s: TextSize) => void } {
  const [textSize, setState] = useState<TextSize>("normal");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "normal" || v === "large" || v === "xlarge") setState(v);
      })
      .catch(() => {});
  }, []);

  const setTextSize = useCallback((s: TextSize) => {
    setState(s);
    AsyncStorage.setItem(STORAGE_KEY, s).catch(() => {});
  }, []);

  return { textSize, setTextSize };
}
