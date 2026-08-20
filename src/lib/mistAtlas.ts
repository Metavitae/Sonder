import { useEffect, useRef, useState } from "react";

import manifest from "../../assets/mist/sprites/mist_atlas_manifest.json";

export type MistColor = "violet" | "magenta" | "cyan" | "amber" | "blue";

// Shared atlas math, extracted from SpriteMistPoC.tsx (Part 18's winning
// approach — pre-rendered frame atlas, GPU texture sampling, no MediaCodec/
// Skia). Reused as-is by FogGemSwatch.tsx, which needs the identical
// frame-selection math but composited through react-native-svg's <Image>
// (for SVG clipPath support) instead of expo-image's <Image> — two different
// image primitives, same underlying atlas-frame arithmetic.
const { frameSize, framesPerColor, colors } = manifest as {
  frameSize: number;
  framesPerColor: number;
  colors: MistColor[];
};

export const MIST_FRAME_SIZE = frameSize;
export const MIST_FRAMES_PER_COLOR = framesPerColor;
export const MIST_COLORS = colors;
export const MIST_ATLAS_COLS = framesPerColor;
export const MIST_ATLAS_ROWS = colors.length;
export const MIST_ATLAS_SOURCE = require("../../assets/mist/sprites/mist_atlas.png");

const FRAME_MS = 83; // ~12fps, matches the atlas's per-color loop cadence

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 21": mood arousal
// drives the mist's "pulse" alongside its color — intensity (0-1) scales
// frame cadence, calmer moods drift slower, more aroused ones cycle faster.
const INTENSITY_MIN_MS = 160;
const INTENSITY_MAX_MS = 50;

export function frameIntervalFor(intensity: number | undefined): number {
  if (intensity === undefined) return FRAME_MS;
  const clamped = Math.max(0, Math.min(1, intensity));
  return INTENSITY_MIN_MS - clamped * (INTENSITY_MIN_MS - INTENSITY_MAX_MS);
}

// Runs the atlas's own frame-advance loop. `startDelayMs` lets independent
// mounts (e.g. several fog-gem swatches on one screen) begin their first
// tick at different offsets so they don't visibly lock-step — each instance
// still free-runs on its own `setInterval` once started, no shared clock.
export function useMistFrame(intensity: number | undefined, startDelayMs = 0): number {
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      intervalId = setInterval(() => {
        frameRef.current = (frameRef.current + 1) % framesPerColor;
        setFrame(frameRef.current);
      }, frameIntervalFor(intensity));
    };
    const timeoutId = setTimeout(start, startDelayMs);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intensity, startDelayMs]);

  return frame;
}

export type MistFrameLayout = {
  row: number;
  frameDisplaySize: number;
  atlasWidth: number;
  atlasHeight: number;
  offsetX: number;
  offsetY: number;
};

// Scales the atlas so one frame covers `width`x`height` (full-bleed,
// center-cropped against the target box exactly like a CSS
// `background-position` sprite pick), then translates to select the given
// color row / frame column. Identical math for any target size — a
// full screen or a small gem swatch.
export function getMistFrameLayout(
  color: MistColor,
  frame: number,
  width: number,
  height: number
): MistFrameLayout {
  const row = Math.max(0, colors.indexOf(color));
  const scale = Math.max(width, height) / frameSize;
  const frameDisplaySize = frameSize * scale;
  const atlasWidth = frameDisplaySize * framesPerColor;
  const atlasHeight = frameDisplaySize * colors.length;
  const offsetX = -(frame * frameDisplaySize) - (frameDisplaySize - width) / 2;
  const offsetY = -(row * frameDisplaySize) - (frameDisplaySize - height) / 2;
  return { row, frameDisplaySize, atlasWidth, atlasHeight, offsetX, offsetY };
}
