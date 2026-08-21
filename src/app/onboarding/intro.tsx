import { StyleSheet, Text, View } from "react-native";

import { useOnboarding } from "../../lib/onboardingContext";

// PLACEHOLDER — the real intro (logo → circle → shrink → "Hi, I'm
// Sonder." → typing well, per Part 37's full-sequence description) is
// build/verification order step 7, not built yet. Exists only so Stage 5's
// flow has somewhere real to land for its own live verification.
export default function IntroScreen() {
  const { state } = useOnboarding();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Intro — Hi, I'm Sonder</Text>
      <Text style={styles.text}>(coming next)</Text>
      <Text style={styles.debug}>
        level1Decision: {state.level1Decision ?? "—"}{"\n"}
        level2Decision: {state.level2Decision ?? "—"}{"\n"}
        tier: {state.tier}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  title: { color: "#F0E6FF", fontSize: 20, fontWeight: "700" },
  text: { color: "#8886a0", fontSize: 14 },
  debug: { color: "#D4AF7A", fontSize: 13, textAlign: "center", marginTop: 16 },
});
