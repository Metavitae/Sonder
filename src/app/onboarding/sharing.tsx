import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionLevel2Screen } from "../../components/onboarding/PermissionLevel2Screen";
import { DECLINE_RESPONSE } from "../../lib/permissionCopy";
import { useOnboarding } from "../../lib/onboardingContext";

// Sharing panel — Part 52's fourth screen, split out of the old combined
// permissions.tsx. Not reachable through real navigation while
// SHARING_TIER_UP_ENABLED is false (permits.tsx routes straight to intro.tsx
// instead) — this route exists so the screen is built and verifiable (via a
// temporary dev route during the build pass) ahead of the flag flip Part 52
// describes, not because it's live in this release.
type Phase = "asking" | "ack" | "done";

export default function SharingScreen() {
  const insets = useSafeAreaInsets();
  const { setLevel2Decision, promoteTierIfEligible } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("asking");

  const handleShare = useCallback(() => {
    setLevel2Decision("shared");
    promoteTierIfEligible();
    setPhase("done");
  }, [setLevel2Decision, promoteTierIfEligible]);

  const handleNoThanks = useCallback(() => {
    setLevel2Decision("declined");
    setPhase("ack");
  }, [setLevel2Decision]);

  useEffect(() => {
    if (phase !== "ack") return;
    const timeout = setTimeout(() => setPhase("done"), 1800);
    return () => clearTimeout(timeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    // Cast: same stale-local-typegen gap as setup.tsx's Continue.
    router.replace("/onboarding/intro" as never);
  }, [phase]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      {phase === "asking" && (
        <PermissionLevel2Screen onShare={handleShare} onNoThanks={handleNoThanks} />
      )}
      {phase === "ack" && (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{DECLINE_RESPONSE}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  bubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: "85%",
    backgroundColor: "rgba(0,0,0,0.45)",
    alignSelf: "flex-start",
  },
  bubbleText: { color: "#FFFFFF", fontSize: 15 },
});
