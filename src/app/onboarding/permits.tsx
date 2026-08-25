import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermitsPanel } from "../../components/onboarding/PermitsPanel";
import { SHARING_TIER_UP_ENABLED } from "../../lib/featureFlags";
import { useOnboarding } from "../../lib/onboardingContext";

// Permits panel — Part 52's third screen (formerly the Level 1 half of the
// old combined permissions.tsx, now its own route; Sharing is the fourth
// screen, split out into sharing.tsx). Records level1Decision same as
// before, then routes onward: to sharing.tsx only while the tier-up path
// is feature-flagged on, straight to intro.tsx otherwise — this branch is
// the actual enforcement point for Part 52's "ship with sharing/tier-up
// inactive" instruction.
export default function PermitsScreen() {
  const insets = useSafeAreaInsets();
  const { setLevel1Decision } = useOnboarding();
  const [done, setDone] = useState(false);

  const handleDone = useCallback(
    (anyGranted: boolean) => {
      setLevel1Decision(anyGranted ? "shared" : "declined");
      setDone(true);
    },
    [setLevel1Decision]
  );

  useEffect(() => {
    if (!done) return;
    // Cast: same stale-local-typegen gap as setup.tsx's Continue.
    const next = SHARING_TIER_UP_ENABLED ? "/onboarding/sharing" : "/onboarding/intro";
    router.replace(next as never);
  }, [done]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      {!done && <PermitsPanel onDone={handleDone} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
});
