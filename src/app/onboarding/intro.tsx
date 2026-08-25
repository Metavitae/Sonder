import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { IntroLogoReveal } from "../../components/onboarding/IntroLogoReveal";
import { MistFormedText } from "../../components/onboarding/MistFormedText";
import { useOnboarding } from "../../lib/onboardingContext";
import { useCompleteOnboardingGate } from "../../lib/onboardingGate";

type Phase = "logo" | "text";

// Step 7 (plan §Build/verification order) — replaces the placeholder.
// Sequence: logo → circle → shrink → "Hi, I'm Sonder." → real /chat
// hand-off. Sits on the one continuous mist background already mounted at
// onboarding/_layout.tsx — no separate mist instance here.
//
// TypingWell (a separate first-message input screen, with its own send/
// reply/dissolve sequence) was built here per an earlier, garbled read of
// founder direction and later "restored" by the same relay channel under
// the same misunderstanding (Part 47/49) — the founder's actual, direct
// correction (2026-08-25) was the opposite of what Part 49 concluded: keep
// IntroLogoReveal/MistFormedText, drop TypingWell entirely. The user's
// first real message now happens in the real chat.tsx window, not a
// separate onboarding-only input step. TypingWell.tsx itself is deleted —
// confirmed nothing else referenced it.
export default function IntroScreen() {
  const { markComplete } = useOnboarding();
  const completeOnboardingGate = useCompleteOnboardingGate();
  const [phase, setPhase] = useState<Phase>("logo");

  const handleLogoComplete = useCallback(() => setPhase("text"), []);
  const handleTextComplete = useCallback(() => {
    // Hard hand-off — chat.tsx's own component tree is never touched, and
    // the user's actual first message now happens there, not here.
    //
    // markComplete() persists to storage; completeOnboardingGate() flips
    // the root layout's live guard state and performs the actual
    // router.replace("/chat") once "chat" has re-entered the navigator —
    // calling router.replace directly from here landed nowhere, since the
    // root's Stack.Protected still excluded "chat" at that instant
    // (confirmed live on-device, build order step 9).
    markComplete();
    completeOnboardingGate();
  }, [markComplete, completeOnboardingGate]);

  return (
    <View style={styles.container}>
      {phase === "logo" && <IntroLogoReveal onComplete={handleLogoComplete} />}
      {phase === "text" && <MistFormedText onComplete={handleTextComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
