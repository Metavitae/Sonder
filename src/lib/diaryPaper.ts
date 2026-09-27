import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Paper } from "./diaryLayout";

// Founder decision 2026-09-27: the user picks the diary's paper — a white
// page or a brown one ("like an adventurer's notebook"). Local only, same
// storage conventions as the other sonder_ keys.
const STORAGE_KEY = "sonder_diary_paper_v1";

export function useDiaryPaper(): { paper: Paper; setPaper: (p: Paper) => void } {
  const [paper, setPaperState] = useState<Paper>("white");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "white" || v === "brown") setPaperState(v);
      })
      .catch(() => {});
  }, []);

  const setPaper = useCallback((p: Paper) => {
    setPaperState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  return { paper, setPaper };
}
