import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionLevel2Screen } from "../components/onboarding/PermissionLevel2Screen";
import { OnboardingProvider, useOnboarding } from "../lib/onboardingContext";

// TEMPORARY dev-only isolation route for verifying sharing.tsx + the real
// gating rule while SHARING_TIER_UP_ENABLED is false and onboarding is
// already complete on the test device (both make the real /onboarding/
// route group unreachable). Reached via:
//   adb shell am start -a android.intent.action.VIEW -d "sonder://dev-sharing"
// Delete this file (and its Stack.Screen entry in _layout.tsx) once verified
// — same practice as every prior isolated PoC route on this project.
function DevSharingInner() {
  const insets = useSafeAreaInsets();
  const { state, setLevel2Decision, promoteTierIfEligible } = useOnboarding();
  const [result, setResult] = useState("");

  const handleShare = useCallback(async () => {
    setLevel2Decision("shared");
    await promoteTierIfEligible();
    setResult("Share tapped");
  }, [setLevel2Decision, promoteTierIfEligible]);

  const handleNoThanks = useCallback(() => {
    setLevel2Decision("declined");
    setResult("No thanks tapped");
  }, [setLevel2Decision]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      <PermissionLevel2Screen onShare={handleShare} onNoThanks={handleNoThanks} />
      <Text style={styles.debug}>
        tier={state.tier} level2Decision={state.level2Decision ?? "null"} {result}
      </Text>
    </View>
  );
}

export default function DevSharing() {
  return (
    <OnboardingProvider>
      <DevSharingInner />
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#1a1330" },
  debug: { color: "#7CFFB2", fontSize: 12, textAlign: "center", marginTop: 24 },
});
