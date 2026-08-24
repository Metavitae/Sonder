import { StyleSheet, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { useOnboarding } from "../../lib/onboardingContext";

// Step 7 (plan §Build/verification order) — deliberately simple, per
// founder scope cut (Part 47, 2026-08-23): the elaborate logo/circle/
// typing-well build is dropped. Sonder's introduction still happens here,
// last in the sequence, but as a plain hello, not an animated moment.
export default function IntroScreen() {
  const { markComplete } = useOnboarding();

  const handleContinue = () => {
    markComplete();
    router.replace("/chat");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi, I'm Sonder.</Text>
      <Pressable style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 24 },
  title: { color: "#F0E6FF", fontSize: 24, fontWeight: "600" },
  continueButton: {
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  continueText: { color: "#000", fontWeight: "700", fontSize: 15 },
});
