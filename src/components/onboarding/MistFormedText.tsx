import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const FADE_IN_MS = 1400;
const HOLD_MS = 1200;
const FADE_OUT_MS = 700;

// "Hi, I'm Sonder." forming through the shared mist already mounted at
// onboarding/_layout.tsx level (plan §Component notes: "simpler reading of
// 'forms through mist' than a literal mask-reveal" — a slow fade/settle
// over the existing mist backdrop, not a separate reveal mechanism).
export function MistFormedText({ onComplete }: { onComplete: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS }),
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) runOnJS(onComplete)();
        })
      )
    );
    translateY.value = withTiming(0, { duration: FADE_IN_MS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents="none">
      <Text style={styles.text}>Hi, I'm Sonder.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  text: { color: "#F0E6FF", fontSize: 28, fontWeight: "600", letterSpacing: 0.5 },
});
