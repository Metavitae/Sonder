import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// "Sonder - Stage 1 Lid Asset Chosen" (canonical, 2026-08-06): the "fast"
// geode video, chosen for its warm amber center cooling to violet/teal
// edges, already echoing the mist system's palette. Native 1080x1920 —
// exact portrait full-bleed, no crop compromise needed. Real 4s duration,
// includes its own audio track (kept — this is a reveal moment, not a
// silent background loop).
const LID_SOURCE = require("../../../assets/video/quartz-lid.mp4");

const SLIDE_DURATION_MS = 700;

// Setup content (birthdate/gender pickers) is mounted underneath the lid
// for the whole reveal, not mounted after it slides away — avoids a jank
// frame at the handoff (per the plan's QuartzLidReveal note).
export function QuartzLidReveal({
  onRevealed,
  children,
}: {
  onRevealed: () => void;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const slideY = useSharedValue(0);
  const revealedRef = useRef(false);

  const player = useVideoPlayer(LID_SOURCE, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const subscription = player.addListener("playToEnd", () => {
      if (revealedRef.current) return;
      revealedRef.current = true;
      slideY.value = withTiming(
        -height,
        { duration: SLIDE_DURATION_MS, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onRevealed)();
        }
      );
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, height]);

  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={StyleSheet.absoluteFillObject}>{children}</View>
      <Animated.View style={[StyleSheet.absoluteFillObject, lidStyle]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
        />
      </Animated.View>
    </View>
  );
}
