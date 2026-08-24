import { useEffect } from "react";
import { Image, StyleSheet, type ImageSourcePropType } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const LOGO_SOURCE: ImageSourcePropType = require("../../../assets/images/logo-glow.png");
const LOGO_SIZE = 160;

const FADE_IN_MS = 900;
const HOLD_MS = 400;
const BEND_MS = 700;
const SHRINK_MS = 600;

// Plan §Route/file structure: "logo → circle → shrink" — logo-glow.png
// fades/scales in as itself, then the square frame around it bends into a
// full circle (animated borderRadius, clipping the image, same idiom as
// FogGemSwatch's facet clip elsewhere in onboarding), then the whole thing
// shrinks away to hand off to MistFormedText. No SVG needed here — a plain
// square View with overflow:hidden animating toward borderRadius: size/2
// reads as the same "bend to circle" motion.
export function IntroLogoReveal({ onComplete }: { onComplete: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);
  const borderRadius = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS }),
      withDelay(
        HOLD_MS + BEND_MS,
        withTiming(0, { duration: SHRINK_MS }, (finished) => {
          if (finished) runOnJS(onComplete)();
        })
      )
    );
    scale.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS }),
      withDelay(HOLD_MS + BEND_MS, withTiming(0, { duration: SHRINK_MS }))
    );
    borderRadius.value = withDelay(
      FADE_IN_MS + HOLD_MS,
      withTiming(LOGO_SIZE / 2, { duration: BEND_MS })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    borderRadius: borderRadius.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.frame, style]}>
      <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { width: LOGO_SIZE, height: LOGO_SIZE, overflow: "hidden" },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
