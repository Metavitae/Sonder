import { useEffect } from "react";
import { BackHandler, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadOnboardingState } from "../lib/onboardingStorage";

// Test path (founder, 2026-09-30: watch the whole opening without a
// reinstall wiping the diary). `adb shell am start -a
// android.intent.action.VIEW -d sonder://replay-onboarding` marks onboarding
// not done and closes the app; the next launch plays it from the Kithe logo,
// exactly like a fresh install. Only the onboarding flag changes — the
// diary and earlier answers stay (the fields come back pre-filled).
// (Reopening onboarding live instead hid the Kithe logo — found on-device.)
const STORAGE_KEY = "sonder_onboarding_v1";

export default function ReplayOnboarding() {
  useEffect(() => {
    loadOnboardingState()
      .then((s) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, complete: false })))
      .catch(() => {})
      .finally(() => BackHandler.exitApp());
  }, []);
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}
