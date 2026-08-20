import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";

import {
  MIST_ATLAS_SOURCE,
  type MistColor,
  getMistFrameLayout,
  useMistFrame,
} from "../lib/mistAtlas";

export type { MistColor };

// Winner of Part 18's three-way comparison ("Sonder - Direct Instructions
// for CC 2026-08-11, Part 18" + Addendum), founder verdict 2026-08-13:
// pre-rendered frames as a texture atlas, GPU texture sampling instead of
// video decode — no MediaCodec, no Skia Canvas/SkSL shader compile, just a
// translate + clip to select a pre-rendered frame (same mechanism as a
// classic CSS/RN sprite-sheet flipbook). The other two evaluated options
// (ProceduralMistPoC, a Skia shader; VectorMistPoC, Lottie) and the
// MediaCodec-based AmbientMist crossfade that predated Part 18 are removed.
// The atlas itself (assets/mist/sprites/mist_atlas.png) is baked once at
// build time by scripts/generate-mist-atlas.js. Frame-selection math lives
// in src/lib/mistAtlas.ts, shared with FogGemSwatch.tsx (the onboarding
// fog-gem swatches, which need the same atlas math composited through
// react-native-svg's <Image> instead, for SVG clipPath support).
export function SpriteMistPoC({
  color,
  intensity,
  width: widthProp,
  height: heightProp,
}: {
  color: MistColor;
  intensity?: number;
  // Optional fixed size for reuse at non-full-screen dimensions (e.g. the
  // onboarding fog-gem swatches) — defaults to the window, so every existing
  // full-screen caller (chat.tsx, index.tsx) is unaffected.
  width?: number;
  height?: number;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const width = widthProp ?? windowWidth;
  const height = heightProp ?? windowHeight;
  const frame = useMistFrame(intensity);

  const { atlasWidth, atlasHeight, offsetX, offsetY } = getMistFrameLayout(
    color,
    frame,
    width,
    height
  );

  return (
    <View
      style={[StyleSheet.absoluteFillObject, styles.clip, { width, height }]}
      pointerEvents="none"
    >
      <Image
        source={MIST_ATLAS_SOURCE}
        contentFit="fill"
        style={{
          position: "absolute",
          width: atlasWidth,
          height: atlasHeight,
          left: offsetX,
          top: offsetY,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});
