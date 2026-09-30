import { useEffect, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { createAudioPlayer } from "expo-audio";

import { SONDER_WHISTLE_SOUND } from "../../assets/sound";
import type { MistColor } from "../../lib/mistAtlas";
import { useSetOnboardingMistVisible } from "../../lib/onboardingMist";
import { FilamentMist } from "../FilamentMist";

// The 3D logos (founder, 2026-09-30), trimmed to square: Kithe's from
// Drive Orbgroove/Art/"kithe-logo-3d-transparent.png" (only ~240x290 px of
// logo in that file — soft at full size; swap in a larger render when one
// exists), Sonder's from Sonder/Art/"Sonder logo 3D no background (1).png".
const KITHE_LOGO: ImageSourcePropType = require("../../../assets/images/kithe-logo-3d.png");
const SONDER_LOGO: ImageSourcePropType = require("../../../assets/images/sonder-logo-3d.png");

const LOGO_SIZE = 200;
// The bolts and the haze start from the logo's center, hidden behind it
// (founder, 2026-09-30: starting at the logo's edges left an empty
// rectangle around it), so they come out from behind it all around.
const ROOT_SIZE = 0;
// How far the field reaches compared with the diary's: enough to fill the
// screen from a logo-sized center.
const MIST_SPREAD = 3;
const FADE_IN_MS = 900;
const HOLD_MS = 1600;
const FADE_OUT_MS = 900;
const GAP_MS = 300;
const MIST_INTENSITY = 0.6;
// 0.175 was tuned for the old clipped whistle; the clean v2 is ~6 dB
// quieter at the source, so this doubles it for the same loudness.
const WHISTLE_VOLUME = 0.35;

type StageConfig = { color: MistColor; logo: ImageSourcePropType };

// The opening (founder, 2026-09-30: Kithe's logo presents Sonder's, in the
// new filament mist). Each logo fades in with the diary's filament wisps
// drifting from around it in its own color, holds, and fades out; then
// Kithe's turn hands over to Sonder's. Onboarding's screen-wide mist stays
// hidden meanwhile and fades in as the fields appear. Replaces the earlier
// three thick fog pulses (Part 42), which relied on the old image mist
// covering the whole screen. Colors (Kithe → green, Sonder → sky blue)
// still match each logo's own hue family.
const STAGES: StageConfig[] = [
  { color: "cyan", logo: KITHE_LOGO },
  { color: "blue", logo: SONDER_LOGO },
];

export function FogLogoSequence({ onComplete }: { onComplete: () => void }) {
  const [stageIndex, setStageIndex] = useState(0);
  const opacity = useSharedValue(0);
  const setMistVisible = useSetOnboardingMistVisible();
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    setMistVisible(false);
  }, [setMistVisible]);

  // Complete Reference §1: Sonder "opens with a soft, wordless whistle, not
  // a jingle or a question — presence before performance." The asset was
  // bundled 2026-08-05 but never given a trigger; founder confirmed
  // (2026-09-23) it belongs at the very beginning, i.e. here, starting with
  // the first logo. Plays once, on mount only — not per stage.
  // Founder, first live listen (2026-09-23): full volume was too loud for
  // "soft" (0.35), then half that again on the second listen — WHISTLE_VOLUME
  // scales it down independent of device volume.
  useEffect(() => {
    const player = createAudioPlayer(SONDER_WHISTLE_SOUND);
    player.volume = WHISTLE_VOLUME;
    player.play();
    return () => player.remove();
  }, []);

  useEffect(() => {
    const isLast = stageIndex === STAGES.length - 1;
    const finishStage = () => {
      if (isLast) {
        setMistVisible(true);
        onComplete();
      } else {
        setTimeout(() => setStageIndex((i) => i + 1), GAP_MS);
      }
    };
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS }),
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) runOnJS(finishStage)();
        })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIndex]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const stage = STAGES[stageIndex];

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <FilamentMist
        color={stage.color}
        intensity={MIST_INTENSITY}
        rim={false}
        spread={MIST_SPREAD}
        radial
        electric
        rect={{
          x: (width - ROOT_SIZE) / 2,
          y: (height - ROOT_SIZE) / 2,
          width: ROOT_SIZE,
          height: ROOT_SIZE,
        }}
      />
      <View style={styles.logoWrap}>
        <Image source={stage.logo} style={styles.logo} resizeMode="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  logoWrap: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
