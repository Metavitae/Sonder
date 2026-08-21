import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { SpriteMistPoC } from "../../components/SpriteMistPoC";
import { OnboardingProvider } from "../../lib/onboardingContext";

// One continuous mist background mounted here, once, shared across
// setup → permissions → intro — never remounted per screen, so its
// glimmer/frame clock doesn't jump-cut at a stage transition. Each screen's
// own Stack entry renders on top with a transparent background.
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <View style={styles.container}>
        <SpriteMistPoC color="violet" intensity={0.15} />
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.transparent }} />
      </View>
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  transparent: { backgroundColor: "transparent" },
});
