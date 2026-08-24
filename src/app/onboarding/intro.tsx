import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { IntroLogoReveal } from "../../components/onboarding/IntroLogoReveal";
import { MistFormedText } from "../../components/onboarding/MistFormedText";
import { TypingWell } from "../../components/onboarding/TypingWell";
import { useOnboarding } from "../../lib/onboardingContext";

type Phase = "logo" | "text" | "typingWell";

// Step 7 (plan §Build/verification order) — replaces the placeholder.
// Sequence per Part 37's full-sequence description, plan §Route/file
// structure: logo → circle → shrink → "Hi, I'm Sonder." → typing well →
// real /chat hand-off. Sits on the one continuous mist background already
// mounted at onboarding/_layout.tsx — no separate mist instance here.
export default function IntroScreen() {
  const { markComplete } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("logo");

  const handleLogoComplete = useCallback(() => setPhase("text"), []);
  const handleTextComplete = useCallback(() => setPhase("typingWell"), []);
  const handleTypingWellDone = useCallback(() => {
    // Hard hand-off (plan §Component notes) — chat.tsx's own component
    // tree is never touched; the exchange already lives in chatHistory.ts
    // via TypingWell's use of the same useSonderChat pipeline.
    markComplete();
    router.replace("/chat");
  }, [markComplete]);

  return (
    <View style={styles.container}>
      {phase === "logo" && <IntroLogoReveal onComplete={handleLogoComplete} />}
      {phase === "text" && <MistFormedText onComplete={handleTextComplete} />}
      {phase === "typingWell" && (
        <View style={styles.fill}>
          <TypingWell onDone={handleTypingWellDone} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  fill: { flex: 1, width: "100%" },
});
