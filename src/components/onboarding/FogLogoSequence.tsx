import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { MistColor } from "../../lib/mistAtlas";
import { SpriteMistPoC } from "../SpriteMistPoC";

const KITHE_LOGO: ImageSourcePropType = require("../../../assets/images/kithe-logo.png");
// Sonder's own flat 2D logo — this is the exact bundled app icon (confirmed
// pixel-identical to Drive's "Sonder logo 2D no background.png" before
// downloading a duplicate), so no new asset was needed for this half.
const SONDER_LOGO: ImageSourcePropType = require("../../../assets/images/icon.png");

const FOG_IN_MS = 900;
const FOG_HOLD_MS = 500;
const FOG_OUT_MS = 900;
const LOGO_HOLD_MS = 1100;

type StageConfig = { fogColor: MistColor; logo: ImageSourcePropType | null };

// Part 42 correction (founder, live on-device 2026-08-20): the real Stage 1
// opener is three fog pulses, not the single end-of-flow logo reveal the
// original plan (Part 37) described — this component owns only that: fog
// thickens (Kithe's colors) → thins to Kithe's logo → fog thickens again
// (Sonder's colors) → thins to Sonder's logo → fog thickens a third time →
// thins to nothing, handing off to setup.tsx's real fields. Color
// assignment (Kithe→cyan, Sonder→blue) is a judgment call matching each
// logo's own dominant hue family — no separate brand-color doc exists to
// confirm against; revisit if it reads wrong live, per this codebase's own
// standing practice.
const STAGES: StageConfig[] = [
  { fogColor: "cyan", logo: KITHE_LOGO },
  { fogColor: "blue", logo: SONDER_LOGO },
  { fogColor: "violet", logo: null },
];

export function FogLogoSequence({ onComplete }: { onComplete: () => void }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [visibleLogo, setVisibleLogo] = useState<ImageSourcePropType | null>(null);
  const fogOpacity = useSharedValue(0);

  useEffect(() => {
    const stage = STAGES[stageIndex];
    const isLast = stageIndex === STAGES.length - 1;

    // Runs on JS after the fog has fully cleared — holds the revealed
    // content on screen for a beat before either starting the next pulse
    // or (on the last stage) handing off to setup.tsx's real fields.
    const finishStage = () => {
      setTimeout(() => {
        if (isLast) onComplete();
        else setStageIndex((i) => i + 1);
      }, LOGO_HOLD_MS);
    };

    fogOpacity.value = withSequence(
      // Swap the logo only once the fog is fully opaque — the previous
      // stage's content must stay visible while the fog is still thin/
      // rising, not disappear early.
      withTiming(1, { duration: FOG_IN_MS }, (finished) => {
        if (finished) runOnJS(setVisibleLogo)(stage.logo);
      }),
      withDelay(
        FOG_HOLD_MS,
        withTiming(0, { duration: FOG_OUT_MS }, (finished) => {
          if (finished) runOnJS(finishStage)();
        })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIndex]);

  const fogStyle = useAnimatedStyle(() => ({ opacity: fogOpacity.value }));
  const stage = STAGES[stageIndex];

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {visibleLogo !== null && (
        <View style={styles.logoWrap} pointerEvents="none">
          <Image source={visibleLogo} style={styles.logo} resizeMode="contain" />
        </View>
      )}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, fogStyle]}
        pointerEvents="none"
      >
        <SpriteMistPoC color={stage.fogColor} intensity={0.9} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoWrap: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  logo: { width: 180, height: 180 },
});
