import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionLevel2Screen } from "../components/onboarding/PermissionLevel2Screen";
import { OnboardingProvider, useOnboarding } from "../lib/onboardingContext";
import { allSensesGranted } from "../lib/senses";

// TEMPORARY dev-only isolation route for verifying sharing.tsx + the real
// gating rule while SHARING_TIER_UP_ENABLED is false and onboarding is
// already complete on the test device (both make the real /onboarding/
// route group unreachable). Reached via:
//   adb shell am start -a android.intent.action.VIEW -d "sonder://dev-sharing"
// Delete this file (and its Stack.Screen entry in _layout.tsx) once verified
// — same practice as every prior isolated PoC route on this project.
function DevSharingInner() {
  const insets = useSafeAreaInsets();
  const { state, setLevel2Decision, promoteTierIfEligible, promoteTier } = useOnboarding();
  const [result, setResult] = useState("");
  const [gateRaw, setGateRaw] = useState<boolean | null>(null);

  // Reads the real gating rule directly, bypassing SHARING_TIER_UP_ENABLED —
  // confirmed separately that promoteTierIfEligible correctly short-circuits
  // on the flag (tier stayed 0 even with camera granted, as it should while
  // shipped inactive). This checks the gating logic itself, which the flag
  // check never lets that path reach in the real app right now.
  useEffect(() => {
    allSensesGranted().then(setGateRaw);
  }, [result]);

  const handleShare = useCallback(async () => {
    setLevel2Decision("shared");
    await promoteTierIfEligible();
    setResult("Share tapped (flag-gated path)");
  }, [setLevel2Decision, promoteTierIfEligible]);

  const handleNoThanks = useCallback(() => {
    setLevel2Decision("declined");
    setResult("No thanks tapped");
  }, [setLevel2Decision]);

  const handleRawGateTest = useCallback(async () => {
    const eligible = await allSensesGranted();
    if (eligible) promoteTier();
    setResult(`raw gate test: eligible=${eligible}`);
  }, [promoteTier]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      <PermissionLevel2Screen onShare={handleShare} onNoThanks={handleNoThanks} />
      <Pressable style={styles.rawButton} onPress={handleRawGateTest}>
        <Text style={styles.rawButtonText}>Test raw gate (bypasses flag)</Text>
      </Pressable>
      <Text style={styles.debug}>
        tier={state.tier} level2Decision={state.level2Decision ?? "null"} allSensesGranted=
        {String(gateRaw)} {result}
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
  rawButton: { marginTop: 16, paddingVertical: 10, alignItems: "center" },
  rawButtonText: { color: "#D4AF7A", fontSize: 13, textDecorationLine: "underline" },
  debug: { color: "#7CFFB2", fontSize: 12, textAlign: "center", marginTop: 24 },
});
