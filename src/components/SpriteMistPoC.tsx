import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";

import type { MistColor } from "./AmbientMist";
import manifest from "../../assets/mist/sprites/mist_atlas_manifest.json";

// PoC only, per "Sonder - Direct Instructions for CC (2026-08-11, Part 18)",
// option 3 of 3: pre-rendered frames as a texture atlas, GPU texture
// sampling instead of video decode. Deliberately built on expo-image rather
// than react-native-skia — unlike ProceduralMistPoC (option 1), this never
// creates a Skia Canvas or compiles an SkSL shader at all, so if the
// Addendum's "GPU-expensive approach degrades tracking" concern is really
// about Skia's shader path specifically rather than "any GPU work," this is
// the option that isolates that difference. The atlas itself
// (assets/mist/sprites/mist_atlas.png) is baked once at build time by
// scripts/generate-mist-atlas.js — nothing here computes noise or a shader
// per pixel per frame, only a translate + clip to select a pre-rendered
// frame, same mechanism as a classic CSS/RN sprite-sheet flipbook.
const { frameSize, framesPerColor, colors } = manifest as {
  frameSize: number;
  framesPerColor: number;
  colors: MistColor[];
};

const ATLAS_SOURCE = require("../../assets/mist/sprites/mist_atlas.png");
const ATLAS_COLS = framesPerColor;
const ATLAS_ROWS = colors.length;

const FRAME_MS = 83; // ~12fps, matches the atlas's per-color loop cadence

export function SpriteMistPoC({ color }: { color: MistColor }) {
  const { width, height } = useWindowDimensions();
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % framesPerColor;
      setFrame(frameRef.current);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, []);

  const row = Math.max(0, colors.indexOf(color));
  // Scale the atlas so one frame covers the full screen (full-bleed, same
  // visual footprint as the other two options), then translate to select
  // the current color row / frame column, clipped by the outer container.
  // A single displayed frame is frameSize*scale square — center-cropped
  // against width/height exactly like a CSS `background-position` sprite
  // pick, just computed by hand instead of via CSS.
  const scale = Math.max(width, height) / frameSize;
  const frameDisplaySize = frameSize * scale;
  const atlasWidth = frameDisplaySize * ATLAS_COLS;
  const atlasHeight = frameDisplaySize * ATLAS_ROWS;
  const offsetX = -(frame * frameDisplaySize) - (frameDisplaySize - width) / 2;
  const offsetY = -(row * frameDisplaySize) - (frameDisplaySize - height) / 2;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, styles.clip, { width, height }]}
      pointerEvents="none"
    >
      <Image
        source={ATLAS_SOURCE}
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
