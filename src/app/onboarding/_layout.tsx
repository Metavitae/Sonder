import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { FilamentMist } from "../../components/FilamentMist";
import { OnboardingProvider } from "../../lib/onboardingContext";
import { OnboardingMistContext } from "../../lib/onboardingMist";

// Electric, from the screen's center, reaching the edges — no frame
// (founder, 2026-09-30: the screen-framing version read as a rectangle
// around everything; then "the whole thing becomes an electrifying mist",
// the same electricity as the logos), dimmed behind the text. Blue with
// some gold wisps among it (founder, 2026-09-30).
const MIST_ROOT = 0;
const MIST_STRENGTH = 0.45;
const MIST_SPREAD = 3;
const MIST_FADE_MS = 1200;

// One continuous mist background mounted here, once, shared across
// setup → permissions → intro — never remounted per screen, so its
// motion doesn't jump-cut at a stage transition. Each screen's own Stack
// entry renders on top with a transparent background. Founder, 2026-09-30:
// the filament mist (the diary's own) replaces the old image mist here too.
export const unstable_settings = {
  // Without this, expo-router falls back to the alphabetically-first file
  // in this folder (intro.tsx) as the entry screen for a bare "/onboarding"
  // navigation — confirmed live on-device (build order step 9): a fresh
  // install landed straight on the intro/typing-well screens instead of
  // Stage 1.
  initialRouteName: "setup",
};

export default function OnboardingLayout() {
  const { width, height } = useWindowDimensions();
  const [mistVisible, setMistVisible] = useState(true);
  const mistOpacity = useSharedValue(1);
  useEffect(() => {
    mistOpacity.value = withTiming(mistVisible ? 1 : 0, { duration: mistVisible ? MIST_FADE_MS : 0 });
  }, [mistVisible, mistOpacity]);
  const mistStyle = useAnimatedStyle(() => ({ opacity: mistOpacity.value }));

  return (
    <OnboardingProvider>
      <OnboardingMistContext.Provider value={setMistVisible}>
        <View style={styles.container}>
          <Animated.View style={[StyleSheet.absoluteFillObject, mistStyle]} pointerEvents="none">
            <FilamentMist
              color="blue"
              accent="amber"
              motion="magenta"
              intensity={0.15}
              rim={false}
              radial
              electric
              strength={MIST_STRENGTH}
              spread={MIST_SPREAD}
              rect={{
                x: (width - MIST_ROOT) / 2,
                y: (height - MIST_ROOT) / 2,
                width: MIST_ROOT,
                height: MIST_ROOT,
              }}
            />
          </Animated.View>
          <Stack
            initialRouteName="setup"
            screenOptions={{ headerShown: false, contentStyle: styles.transparent }}
          />
        </View>
      </OnboardingMistContext.Provider>
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  transparent: { backgroundColor: "transparent" },
});
