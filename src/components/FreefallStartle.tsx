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
import { useSpeak } from "../lib/speak";
import { usePreferredVoice } from "../lib/voicePreference";
import { emitDreamWake } from "../lib/dreamWakeBus";

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

// Founder-authored, locked per "Sonder - Direct Instructions for CC
// 2026-08-17 Part 31 Addendum" — picked at random per trigger (not always
// the same one) so repeat drops don't feel scripted.
const FREEFALL_LINES = [
  "Whoa! What was that!? Are you OK? I'm ok! Don't worry, I'm still alive. WHAT WAS THAT!?",
  "Whoa! Don't do that to me! I'm afraid of heights, mainly because of falling! I almost had a short circuit! That's like a heart attack for you...",
];

export function FreefallStartle() {
  const flash = useSharedValue(0);
  const lastTriggerRef = useRef(0);
  const speak = useSpeak();
  const { voice } = usePreferredVoice();

  const trigger = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerRef.current < STARTLE_COOLDOWN_MS) return;
    lastTriggerRef.current = now;

    // Part 63: a real jolt should interrupt sleep, same as it would for a
    // person — wake the dream state (if chat.tsx is mounted and currently
    // dreaming) before the rest of the startle reaction fires.
    emitDreamWake();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 120);

    flash.value = withSequence(
      withTiming(1, { duration: FLASH_IN_MS }),
      withTiming(0, { duration: FLASH_OUT_MS })
    );

    const line = FREEFALL_LINES[Math.floor(Math.random() * FREEFALL_LINES.length)];
    speak(line, voice);
  }, [flash, speak, voice]);

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
