import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { SpriteMistPoC } from "../../components/SpriteMistPoC";
import { OnboardingProvider } from "../../lib/onboardingContext";

// One continuous mist background mounted here, once, shared across
// setup → permissions → intro — never remounted per screen, so its
// glimmer/frame clock doesn't jump-cut at a stage transition. Each screen's
// own Stack entry renders on top with a transparent background.
export const unstable_settings = {
  // Without this, expo-router falls back to the alphabetically-first file
  // in this folder (intro.tsx) as the entry screen for a bare "/onboarding"
  // navigation — confirmed live on-device (build order step 9): a fresh
  // install landed straight on the intro/typing-well screens instead of
  // Stage 1.
  initialRouteName: "setup",
};

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <View style={styles.container}>
        <SpriteMistPoC color="violet" intensity={0.15} />
        <Stack
          initialRouteName="setup"
          screenOptions={{ headerShown: false, contentStyle: styles.transparent }}
        />
      </View>
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  transparent: { backgroundColor: "transparent" },
});
