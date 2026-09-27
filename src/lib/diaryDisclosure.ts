import AsyncStorage from "@react-native-async-storage/async-storage";

// "Sonder - CC - Direct Instructions - Diary reframe layout, mist, first-run
// trim (2026-09-27)" item 4: the disclosure sentence shows exactly once, the
// first time a user reaches the blank diary page, then never again. Same
// conventions as onboardingStorage.ts / chatHistory.ts (versioned key,
// sonder_ prefix, silent-catch on write).
const STORAGE_KEY = "sonder_diary_disclosure_seen_v1";

export async function hasSeenDiaryDisclosure(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
  } catch {
    // Unreadable storage: treat as seen rather than risk repeating it —
    // the instruction's hard rule is "never again", not "at least once".
    return true;
  }
}

export async function markDiaryDisclosureSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Best-effort, matching the other storage helpers.
  }
}
