import AsyncStorage from "@react-native-async-storage/async-storage";

// Test-only date shift (founder, 2026-09-30, marketing footage: entries
// must land on different days). Set by test-date.tsx through
// `adb shell am start -d "sonder://test-date?days=-11" com.metavitae.Sonder`
// (days=0 turns it off). Users never see or reach it. It only changes the
// date stamped on new diary entries and the local time sent to Sonder.
const STORAGE_KEY = "sonder_test_clock_v1";
let offsetMs = 0;

export async function loadTestClock(): Promise<void> {
  try {
    offsetMs = Number(await AsyncStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    offsetMs = 0;
  }
}

export async function setTestClockDays(days: number): Promise<void> {
  offsetMs = days * 24 * 60 * 60 * 1000;
  await AsyncStorage.setItem(STORAGE_KEY, String(offsetMs));
}

export function nowMs(): number {
  return Date.now() + offsetMs;
}
