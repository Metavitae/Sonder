import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionLevel1Prompt } from "../../components/onboarding/PermissionLevel1Prompt";
import { PermissionLevel2Screen } from "../../components/onboarding/PermissionLevel2Screen";
import { DECLINE_RESPONSE } from "../../lib/permissionCopy";
import { useOnboarding } from "../../lib/onboardingContext";

// Auto-advance delay after a decline acknowledgment — "conversation/flow
// continues naturally afterward" (plan) means no further tap is needed,
// not that it lingers indefinitely either.
const DECLINE_ACK_HOLD_MS = 1800;

type Phase = "level1" | "level1-ack" | "level2" | "level2-ack" | "done";

// Stage 5 — build/verification order step 6. Flows directly out of Stage 1
// in the same continuous onboarding sequence (Part 39): Level 1's in-voice
// ask, an optional decline acknowledgment, Level 2's separate screen (with
// its own FAQ sheet and real tier promotion on Share), another optional
// decline acknowledgment, then onward to the intro. Both decline paths are
// shown once and never re-raised — enforced by phase state, not just
// convention, and by level1Decision/level2Decision persisting in context
// for the rest of the app to respect going forward.
export default function PermissionsScreen() {
  const insets = useSafeAreaInsets();
  const { setLevel1Decision, setLevel2Decision, promoteTier } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("level1");

  const handleSure = useCallback(() => {
    setLevel1Decision("shared");
    setPhase("level2");
  }, [setLevel1Decision]);

  const handleNotNow = useCallback(() => {
    setLevel1Decision("declined");
    setPhase("level1-ack");
  }, [setLevel1Decision]);

  const handleShare = useCallback(() => {
    promoteTier();
    setPhase("done");
  }, [promoteTier]);

  const handleNoThanks = useCallback(() => {
    setLevel2Decision("declined");
    setPhase("level2-ack");
  }, [setLevel2Decision]);

  useEffect(() => {
    if (phase !== "level1-ack" && phase !== "level2-ack") return;
    const timeout = setTimeout(() => {
      setPhase(phase === "level1-ack" ? "level2" : "done");
    }, DECLINE_ACK_HOLD_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== "done") return;
    // Cast: same stale-local-typegen gap as setup.tsx's Continue —
    // .expo/types/router.d.ts only regenerates against a live dev server.
    router.replace("/onboarding/intro" as never);
  }, [phase]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      {phase === "level1" && (
        <PermissionLevel1Prompt onSure={handleSure} onNotNow={handleNotNow} />
      )}
      {phase === "level1-ack" && (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{DECLINE_RESPONSE}</Text>
        </View>
      )}
      {phase === "level2" && (
        <PermissionLevel2Screen onShare={handleShare} onNoThanks={handleNoThanks} />
      )}
      {phase === "level2-ack" && (
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
