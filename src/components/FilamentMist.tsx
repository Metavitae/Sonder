import { useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  BlurMask,
  Canvas,
  Group,
  Path,
  RoundedRect,
  Skia,
} from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

import { MIST_GLOW, type MistColor } from "../lib/mistAtlas";

// Founder, 2026-09-29 (via the marketing session's note in CC/Feed): the
// mist should feel like the Sky blue hero image — thin glowing filaments,
// "more like a force field" held around the book, brightest along the page
// edges and fading into the dark, always drifting (never static). Same five
// feeling colors; Sonder's energy still sets how fast it moves.
//
// Drawn live with Skia on the GPU: a set of strands rooted along the page's
// edge, each reaching outward and swaying, their roots sliding slowly along
// the edge so the field keeps moving. Each strand is drawn three times (wide
// soft glow, medium glow, thin bright core) for the filament look, and a
// soft halo hugs the page rim. PROTOTYPE — the old soft mist stays
// underneath; FILAMENT_MIST_ENABLED in featureFlags.ts switches it off.

type Rect = { x: number; y: number; width: number; height: number };

const STRANDS = 28;
const POINTS = 9;

type Strand = { s: number; length: number; phase: number; wave: number; sway: number };

// Fixed per strand (a seeded pseudo-random, so the field looks the same
// shape each time the app opens, and only its motion varies).
function makeStrands(): Strand[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: STRANDS }, (_, i) => ({
    s: (i + rnd() * 0.8) / STRANDS,
    length: 45 + rnd() * 110,
    phase: rnd() * Math.PI * 2,
    wave: 2 + rnd() * 3,
    sway: 10 + rnd() * 22,
  }));
}

export function FilamentMist({
  color,
  intensity = 0.5,
  rect,
}: {
  color: MistColor;
  intensity?: number;
  rect: Rect;
}) {
  const strands = useMemo(makeStrands, []);
  const time = useSharedValue(0);
  const speed = useSharedValue(0.35 + intensity * 1.4);
  speed.value = 0.35 + intensity * 1.4;

  useFrameCallback((frame) => {
    time.value += ((frame.timeSincePreviousFrame ?? 16) / 1000) * speed.value;
  });

  const { x, y, width, height } = rect;

  // `extent` < 1 draws only the inner part of each strand: the bright core
  // uses a shorter one than the soft glow, so every strand fades toward
  // its tip.
  const buildPath = (t: number, extent: number) => {
    "worklet";
    const p = Skia.Path.Make();
    const perimeter = 2 * (width + height);
    for (let i = 0; i < strands.length; i++) {
      const st = strands[i];
      // The root drifts slowly along the page edge.
      let s = (st.s + 0.035 * Math.sin(t * 0.21 + st.phase) + 1) % 1;
      let d = s * perimeter;
      let ox = 0;
      let oy = 0;
      let nx = 0;
      let ny = 0;
      if (d < width) {
        ox = x + d; oy = y; nx = 0; ny = -1;
      } else if ((d -= width) < height) {
        ox = x + width; oy = y + d; nx = 1; ny = 0;
      } else if ((d -= height) < width) {
        ox = x + width - d; oy = y + height; nx = 0; ny = 1;
      } else {
        d -= width;
        ox = x; oy = y + height - d; nx = -1; ny = 0;
      }
      // Tangent along the edge.
      const tx = -ny;
      const ty = nx;
      // Each strand breathes in and out a little.
      const reach = st.length * (0.75 + 0.25 * Math.sin(t * 0.6 + st.phase * 1.7));
      for (let k = 0; k < POINTS; k++) {
        const u = (k / (POINTS - 1)) * extent;
        const out = u * reach;
        const side =
          (Math.sin(u * st.wave + t * 1.1 + st.phase) * st.sway +
            Math.sin(u * st.wave * 2.3 - t * 1.7 + st.phase * 2) * st.sway * 0.35) *
          u;
        const px = ox + nx * out + tx * side;
        const py = oy + ny * out + ty * side;
        if (k === 0) p.moveTo(px, py);
        else p.lineTo(px, py);
      }
    }
    return p;
  };
  const fullPath = useDerivedValue(() => buildPath(time.value, 1));
  const innerPath = useDerivedValue(() => buildPath(time.value, 0.55));

  const rimOpacity = useDerivedValue(() => 0.55 + 0.25 * Math.sin(time.value * 0.8));

  const glow = MIST_GLOW[color];

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group>
        <RoundedRect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          r={6}
          color={glow}
          style="stroke"
          strokeWidth={10}
          opacity={rimOpacity}
        >
          <BlurMask blur={14} style="normal" />
        </RoundedRect>
        <Path path={fullPath} color={glow} style="stroke" strokeWidth={7} strokeCap="round" strokeJoin="round" opacity={0.22}>
          <BlurMask blur={9} style="normal" />
        </Path>
        <Path path={fullPath} color={glow} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round" opacity={0.45}>
          <BlurMask blur={2.5} style="normal" />
        </Path>
        <Path path={innerPath} color="#FFFFFF" style="stroke" strokeWidth={0.9} strokeCap="round" strokeJoin="round" opacity={0.35} />
      </Group>
    </Canvas>
  );
}
