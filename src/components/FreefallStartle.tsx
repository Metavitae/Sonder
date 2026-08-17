import { useCallback, useRef } from "react";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useFreefallDetector } from "../lib/motion";

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 22", item 2 —
// real accelerometer freefall detection, a bigger/funnier startle reaction
// than the tracking-quality tremor in index.tsx (that one is deliberately
// "genuinely gentler/faster" per the Part 22 doc's item 1 reference — this
// is the opposite end of the scale: a real jolt, not a nudge). Mounted once
// in the root layout so it fires regardless of which screen is active —
// dropping the phone isn't specific to the camera or chat surface.
const STARTLE_COOLDOWN_MS = 3000;
const FLASH_IN_MS = 60;
const FLASH_OUT_MS = 500;

export function FreefallStartle() {
  const flash = useSharedValue(0);
  const lastTriggerRef = useRef(0);

  const trigger = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerRef.current < STARTLE_COOLDOWN_MS) return;
    lastTriggerRef.current = now;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 120);

    flash.value = withSequence(
      withTiming(1, { duration: FLASH_IN_MS }),
      withTiming(0, { duration: FLASH_OUT_MS })
    );
  }, [flash]);

  useFreefallDetector(trigger);

  const style = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.flash, style]}
    />
  );
}

const styles = StyleSheet.create({
  flash: { backgroundColor: "#fff", zIndex: 999 },
});
