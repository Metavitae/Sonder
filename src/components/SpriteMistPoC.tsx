import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";

import manifest from "../../assets/mist/sprites/mist_atlas_manifest.json";

export type MistColor = "violet" | "magenta" | "cyan" | "amber" | "blue";

// Winner of Part 18's three-way comparison ("Sonder - Direct Instructions
// for CC 2026-08-11, Part 18" + Addendum), founder verdict 2026-08-13:
// pre-rendered frames as a texture atlas, GPU texture sampling instead of
// video decode — no MediaCodec, no Skia Canvas/SkSL shader compile, just a
// translate + clip to select a pre-rendered frame (same mechanism as a
// classic CSS/RN sprite-sheet flipbook). The other two evaluated options
// (ProceduralMistPoC, a Skia shader; VectorMistPoC, Lottie) and the
// MediaCodec-based AmbientMist crossfade that predated Part 18 are removed.
// The atlas itself (assets/mist/sprites/mist_atlas.png) is baked once at
// build time by scripts/generate-mist-atlas.js.
const { frameSize, framesPerColor, colors } = manifest as {
  frameSize: number;
  framesPerColor: number;
  colors: MistColor[];
};

const ATLAS_SOURCE = require("../../assets/mist/sprites/mist_atlas.png");
const ATLAS_COLS = framesPerColor;
const ATLAS_ROWS = colors.length;

const FRAME_MS = 83; // ~12fps, matches the atlas's per-color loop cadence

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 21": mood
// arousal drives the mist's "pulse" alongside its color. `intensity` (0-1)
// scales the frame cadence — calmer moods drift slower, more aroused ones
// cycle faster — mapped from arousal by moodToMist.ts, not decided here.
// Optional and defaulting to the original fixed FRAME_MS so every existing
// caller (index.tsx's face-tracking screen) is unaffected.
const INTENSITY_MIN_MS = 160;
const INTENSITY_MAX_MS = 50;

function frameIntervalFor(intensity: number | undefined): number {
  if (intensity === undefined) return FRAME_MS;
  const clamped = Math.max(0, Math.min(1, intensity));
  return INTENSITY_MIN_MS - clamped * (INTENSITY_MIN_MS - INTENSITY_MAX_MS);
}

export function SpriteMistPoC({
  color,
  intensity,
}: {
  color: MistColor;
  intensity?: number;
}) {
  const { width, height } = useWindowDimensions();
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const intervalMs = frameIntervalFor(intensity);
    const id = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % framesPerColor;
      setFrame(frameRef.current);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intensity]);

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
