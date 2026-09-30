import { useEffect } from "react";
import { View } from "react-native";

import { loadOnboardingState, persistOnboardingState } from "../lib/onboardingStorage";
import { useReopenOnboardingGate } from "../lib/onboardingGate";

// Test path: `adb shell am start -a android.intent.action.VIEW -d
// sonder://replay-onboarding` replays onboarding from the logo opening.
// Only the onboarding flag changes — the diary and earlier answers stay
// (the fields come back pre-filled).
export default function ReplayOnboarding() {
  const reopen = useReopenOnboardingGate();
  useEffect(() => {
    loadOnboardingState().then((s) => {
      persistOnboardingState({ ...s, complete: false });
      reopen();
    });
  }, [reopen]);
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}
