import { useEffect, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { Blur, Canvas, Circle, Group, Paint, Path, RadialGradient, RoundedRect, Skia, vec } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { MIST_GLOW, type MistColor } from "../lib/mistAtlas";

// Founder, 2026-09-29 (marketing session note in CC/Feed, then on the POCO):
// the mist should feel like the Sky blue hero image — "softer and smokier",
// wisps of light held around the book like a force field, brightest along
// the page edges and fading into the dark, always drifting. And the wisps
// "should move accordingly to the emotion they're trying to express": each
// feeling has its own way of moving (MOTION below), not just its own color.
// Same five colors; Sonder's energy still speeds it up or slows it down.
//
// Drawn live with Skia. Performance (measured on the POCO, first prototype
// was too heavy): no blur per strand — each wisp is a few wide, faint,
// overlapping strokes, and ONE soft blur goes over the whole field; the
// field is recomputed at most 30 times a second. Since 2026-09-30 this is
// the diary's only mist (founder: it replaces the old image mist).

type Rect = { x: number; y: number; width: number; height: number };

// How each feeling moves. speed: how fast everything drifts. reach: how far
// the wisps extend from the page. sway: how much they curl sideways. wave:
// how many curls along a wisp. slide: how fast roots travel along the edge.
// wrap: how much wisps bend along the edge (hugging) instead of outward.
// breath: how deeply the wisps and rim swell and ease. flicker: quick
// small tremble (only when lit up).
type Motion = {
  speed: number;
  reach: number;
  sway: number;
  wave: number;
  slide: number;
  wrap: number;
  breath: number;
  flicker: number;
};

const MOTION: Record<MistColor, Motion> = {
  // Steady (silver): slow and even, long smooth waves, little sway.
  violet: { speed: 0.45, reach: 1.0, sway: 0.6, wave: 0.8, slide: 0.5, wrap: 0.1, breath: 0.15, flicker: 0 },
  // Quiet and reflective (sky blue): slowest; short wisps settling close
  // to the book; soft long curls.
  blue: { speed: 0.3, reach: 0.65, sway: 0.8, wave: 0.6, slide: 0.3, wrap: 0.25, breath: 0.2, flicker: 0 },
  // Clear and curious (green): quicker; wisps reach further out and pull
  // back, as if exploring.
  cyan: { speed: 0.9, reach: 1.35, sway: 0.9, wave: 1.3, slide: 1.2, wrap: 0, breath: 0.45, flicker: 0 },
  // Warm and gentle (gold): slow and rounded; wisps curl along the edge,
  // wrapping the book; a warm, slow breathing glow.
  amber: { speed: 0.4, reach: 0.85, sway: 1.1, wave: 0.7, slide: 0.6, wrap: 0.7, breath: 0.35, flicker: 0 },
  // Warm and lit up (red): lively and flickering; tall reaching wisps;
  // faster breathing.
  magenta: { speed: 1.3, reach: 1.5, sway: 1.0, wave: 1.6, slide: 1.0, wrap: 0.1, breath: 0.5, flicker: 1 },
};

// The soft background haze (founder, 2026-09-29: "as expressive as the
// filaments… and less bright"): a few large, faint pools of the feeling's
// color drifting around the book, moving with the same MOTION qualities.
// Radial gradients — no blur needed, cheap to draw.
const HAZE = 7;
const HAZE_MAX_ALPHA = 0.16;

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

type HazeProps = {
  index: number;
  rect: Rect;
  spread: number;
  radial: boolean;
  glow: string;
  tick: SharedValue<number>;
  reach: SharedValue<number>;
  slide: SharedValue<number>;
  breath: SharedValue<number>;
  sway: SharedValue<number>;
};

function HazePool({ index, rect, spread, radial, glow, tick, reach, slide, breath, sway }: HazeProps) {
  const { x, y, width, height } = rect;
  const phase = index * 2.39;
  const base = (index + 0.5) / HAZE;
  const center = useDerivedValue(() => {
    const t = tick.value;
    const perimeter = 2 * (width + height);
    const s = (base + 0.08 * slide.value * Math.sin(t * 0.12 + phase) + 1) % 1;
    let ox = 0;
    let oy = 0;
    let nx = 0;
    let ny = 0;
    if (radial) {
      // Radial: evenly around the circle, like the wisps.
      const a = s * Math.PI * 2;
      nx = Math.cos(a);
      ny = Math.sin(a);
      ox = x + width / 2 + nx * width / 2;
      oy = y + height / 2 + ny * height / 2;
    } else {
      let d = s * perimeter;
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
    }
    const out = (30 * reach.value + 20 * sway.value * Math.sin(t * 0.3 + phase)) * spread;
    return vec(ox + nx * out - ny * 25 * Math.sin(t * 0.2 + phase), oy + ny * out + nx * 25 * Math.sin(t * 0.2 + phase));
  });
  const radius = useDerivedValue(
    () => (150 + 40 * index % 60) * spread * (0.7 + 0.3 * reach.value) * (1 + breath.value * 0.6 * Math.sin(tick.value * 0.5 + phase))
  );
  return (
    <Circle c={center} r={radius}>
      <RadialGradient c={center} r={radius} colors={[withAlpha(glow, HAZE_MAX_ALPHA), withAlpha(glow, 0)]} />
    </Circle>
  );
}

const STRANDS = 24;
const POINTS = 7;
// Drawn at half resolution and enlarged 2x (measured on the POCO: full
// resolution was too heavy). Soft smoke loses nothing visible.
const SCALE = 0.5;
const MIN_FRAME_S = 1 / 30;
// Founder, 2026-09-29: everything moved too slowly, so the feelings looked
// alike. All speeds go up by the same factor, keeping their ratios.
const SPEED_BOOST = 1.8;

// Electric mode (radial, around a logo): bolt shape changes per second,
// points per bolt, and how far each kink jumps sideways.
const ELECTRIC_RATE = 14;
const ELECTRIC_POINTS = 18;
const ELECTRIC_JAG = 18;
// Share of bolts showing at any moment; the rest are between strikes.
const ELECTRIC_ALIVE = 0.55;

// Cheap repeatable pseudo-random 0..1 from a number (worklet-safe).
function hash(n: number): number {
  "worklet";
  const v = Math.sin(n) * 43758.5453;
  return v - Math.floor(v);
}

// The wisp's color pushed toward white, for the bright core threads.
function brighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

type Strand = { s: number; length: number; phase: number; wave: number; sway: number };

// Fixed per strand (seeded, so the field has the same shape each time the
// app opens; only its motion varies).
function makeStrands(count: number): Strand[] {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: count }, (_, i) => ({
    s: (i + rnd() * 0.9) / count,
    length: 50 + rnd() * 100,
    phase: rnd() * Math.PI * 2,
    wave: 1.5 + rnd() * 2.5,
    sway: 14 + rnd() * 26,
  }));
}

export function FilamentMist({
  color,
  intensity = 0.5,
  rect,
  rim = true,
  spread = 1,
  radial = false,
  electric = false,
  strength = 1,
}: {
  color: MistColor;
  intensity?: number;
  rect: Rect;
  // The soft outline hugging the rect. Off around a logo, which has no
  // page edge to hug.
  rim?: boolean;
  // How far the whole field reaches, as a multiple of the diary's. Above 1
  // (the logo opening, founder 2026-09-30: fill the screen, mist and
  // filaments as one) it also adds more wisps and a wide glow along each
  // wisp, so the mist follows the filaments instead of sitting apart.
  spread?: number;
  // Wisps radiate evenly all around from the rect's center area instead of
  // growing off its four sides (founder, 2026-09-30: no rectangles in the
  // opening or onboarding). Adds more wisps and the glow along them.
  radial?: boolean;
  // Jagged, crackling bolts instead of smoky curls (the logo opening).
  electric?: boolean;
  // Overall brightness (1 = full). Behind onboarding's text it's dimmed so
  // the words stay readable.
  strength?: number;
}) {
  const strandCount = radial ? STRANDS * 2 : STRANDS;
  const strands = useMemo(() => makeStrands(strandCount), [strandCount]);

  // Each motion quality eases toward the new feeling's over ~1.2 s.
  const m = MOTION[color];
  const speed = useSharedValue(m.speed);
  const reach = useSharedValue(m.reach);
  const sway = useSharedValue(m.sway);
  const wave = useSharedValue(m.wave);
  const slide = useSharedValue(m.slide);
  const wrap = useSharedValue(m.wrap);
  const breath = useSharedValue(m.breath);
  const flicker = useSharedValue(m.flicker);
  const energy = useSharedValue(0.6 + intensity * 0.8);
  useEffect(() => {
    const ease = { duration: 1200 };
    speed.value = withTiming(m.speed, ease);
    reach.value = withTiming(m.reach, ease);
    sway.value = withTiming(m.sway, ease);
    wave.value = withTiming(m.wave, ease);
    slide.value = withTiming(m.slide, ease);
    wrap.value = withTiming(m.wrap, ease);
    breath.value = withTiming(m.breath, ease);
    flicker.value = withTiming(m.flicker, ease);
    energy.value = withTiming(0.6 + intensity * 0.8, ease);
  }, [m, intensity, speed, reach, sway, wave, slide, wrap, breath, flicker, energy]);

  // The clock: advances with the feeling's speed, redraws at most 30/s.
  const time = useSharedValue(0);
  const tick = useSharedValue(0);
  const pending = useSharedValue(0);
  useFrameCallback((frame) => {
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    // Electric bolts run on real time, the same crackle for every color.
    time.value += electric ? dt : dt * speed.value * energy.value * SPEED_BOOST;
    pending.value += dt;
    if (pending.value >= MIN_FRAME_S) {
      pending.value = 0;
      tick.value = time.value;
    }
  });

  const { x, y, width, height } = rect;

  // `extent` < 1 draws only the inner part of each wisp, so the layered
  // strokes (wide and faint to narrow and brighter) fade toward the tips.
  const buildPath = (t: number, extent: number) => {
    "worklet";
    const p = Skia.Path.Make();
    const perimeter = 2 * (width + height);
    const fl = flicker.value;
    for (let i = 0; i < strands.length; i++) {
      const st = strands[i];
      const s = (st.s + 0.04 * slide.value * Math.sin(t * 0.22 + st.phase) + 1) % 1;
      let ox = 0;
      let oy = 0;
      let nx = 0;
      let ny = 0;
      if (radial) {
        // Around a logo (founder, 2026-09-30: "all around", not a cross):
        // roots evenly spaced by angle on the ellipse inside the rect, each
        // wisp heading straight out from the center.
        const a = s * Math.PI * 2;
        nx = Math.cos(a);
        ny = Math.sin(a);
        ox = x + width / 2 + nx * width / 2;
        oy = y + height / 2 + ny * height / 2;
      } else {
        let d = s * perimeter;
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
      }
      const tx = -ny;
      const ty = nx;
      if (electric) {
        // Electric (founder, 2026-09-30: "magical electricity", not
        // tentacles — a whole electrifying mist). Plasma-ball bolts: each
        // one STRIKES (shows for a moment, then is gone, then strikes again
        // elsewhere) instead of staying up and waving; jagged at two scales;
        // forks partway out. Everything is keyed to the step and point
        // index, so the three layered strokes stay on the same bolt.
        const step = Math.floor(t * ELECTRIC_RATE);
        if (hash(step * 1.37 + i * 9.13) > ELECTRIC_ALIVE) continue;
        const len = st.length * spread * (0.4 + 0.6 * hash(step * 7.13 + i * 13.7));
        const lean = (hash(step * 2.9 + i * 4.1) - 0.5) * 0.5;
        const dx = nx + tx * lean;
        const dy = ny + ty * lean;
        p.moveTo(ox, oy);
        for (let k = 1; k < ELECTRIC_POINTS; k++) {
          const u = k / (ELECTRIC_POINTS - 1);
          if (u > extent) break;
          const jag =
            (hash(step * 3.31 + i * 17.1 + k * 5.77) - 0.5) * 2 * ELECTRIC_JAG * Math.sqrt(u) +
            (hash(step * 9.71 + i * 3.3 + k * 1.93) - 0.5) * ELECTRIC_JAG * 0.5;
          const out = u * len;
          const px = ox + dx * out + tx * jag;
          const py = oy + dy * out + ty * jag;
          p.lineTo(px, py);
          // A fork off this kink, now and then.
          if ((k === 5 || k === 10) && hash(step * 5.1 + i * 2.7 + k) < 0.5) {
            const side = hash(step * 6.3 + i + k) < 0.5 ? -1 : 1;
            const bx = dx * 0.8 + tx * side * 0.6;
            const by = dy * 0.8 + ty * side * 0.6;
            const blen = len * (0.15 + 0.2 * hash(step * 8.7 + i * 5.3 + k));
            for (let b = 1; b <= 5; b++) {
              const v = b / 5;
              if (u + v * 0.3 > extent) break;
              const bj = (hash(step * 4.4 + i * 7.7 + k * 3.1 + b) - 0.5) * ELECTRIC_JAG * 0.9;
              p.lineTo(px + bx * blen * v + tx * bj, py + by * blen * v + ty * bj);
            }
            p.moveTo(px, py);
          }
        }
        continue;
      }
      const swell = 1 + breath.value * Math.sin(t * 0.7 + st.phase * 1.3);
      const tremble = fl * 0.15 * Math.sin(t * 9 + st.phase * 5);
      const len = st.length * spread * reach.value * swell * (1 + tremble);
      for (let k = 0; k < POINTS; k++) {
        const u = (k / (POINTS - 1)) * extent;
        // Hugging feelings bend wisps along the edge instead of outward.
        const out = u * len * (1 - wrap.value * 0.6);
        const along = u * u * len * wrap.value * 0.8 * Math.sin(st.phase);
        const side =
          (Math.sin(u * st.wave * wave.value + t * 1.1 + st.phase) * st.sway * sway.value +
            Math.sin(u * st.wave * wave.value * 2.1 - t * 1.6 + st.phase * 2) * st.sway * sway.value * 0.3) *
            u +
          along;
        const px = ox + nx * out + tx * side;
        const py = oy + ny * out + ty * side;
        if (k === 0) p.moveTo(px, py);
        else p.lineTo(px, py);
      }
    }
    return p;
  };
  const outer = useDerivedValue(() => buildPath(tick.value, 1));
  const middle = useDerivedValue(() => buildPath(tick.value, 0.7));
  const inner = useDerivedValue(() => buildPath(tick.value, 0.4));

  const rimOpacity = useDerivedValue(() => 0.45 + 0.35 * breath.value * Math.sin(tick.value * 0.7));

  const glow = MIST_GLOW[color];
  const r = 6;
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Electric: the haze and the bright core at the center flicker with the
  // strikes, so the whole mist feels charged.
  const charge = useDerivedValue(() =>
    electric ? 0.7 + 0.3 * hash(Math.floor(tick.value * ELECTRIC_RATE) * 2.31) : 1
  );
  const coreCenter = vec(x + width / 2, y + height / 2);
  const coreRadius = Math.min(screenW, screenH) * 0.45;

  return (
    <Canvas
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: screenW * SCALE,
        height: screenH * SCALE,
        transformOrigin: "top left",
        transform: [{ scale: 1 / SCALE }],
      }}
    >
      <Group transform={[{ scale: SCALE }]} opacity={strength}>
      {/* Background haze, moving with the feeling, dim. */}
      <Group opacity={charge}>
      {Array.from({ length: HAZE }, (_, i) => (
        <HazePool key={i} index={i} rect={rect} spread={spread} radial={radial} glow={glow} tick={tick} reach={reach} slide={slide} breath={breath} sway={sway} />
      ))}
      {electric && (
        <Circle c={coreCenter} r={coreRadius}>
          <RadialGradient c={coreCenter} r={coreRadius} colors={[withAlpha(glow, 0.45), withAlpha(glow, 0.12), withAlpha(glow, 0)]} />
        </Circle>
      )}
      </Group>
      {/* The glow along the wisps (radial only): the same paths, very
          wide and faint under a heavy blur, so the mist follows them. */}
      {radial && (
        <Group
          layer={
            <Paint>
              <Blur blur={22} />
            </Paint>
          }
        >
          <Path path={outer} color={glow} style="stroke" strokeWidth={70} strokeCap="round" strokeJoin="round" opacity={0.1} />
          <Path path={middle} color={glow} style="stroke" strokeWidth={36} strokeCap="round" strokeJoin="round" opacity={0.14} />
        </Group>
      )}
      {/* The smoky wisps: layered faint strokes, one soft blur over all. */}
      <Group
        layer={
          <Paint>
            <Blur blur={5} />
          </Paint>
        }
      >
        {/* Soft rim hugging the page, blurred with the smoke. */}
        {rim && <RoundedRect x={x - 3} y={y - 3} width={width + 6} height={height + 6} r={r + 3} color={glow} style="stroke" strokeWidth={8} opacity={rimOpacity} />}
        <Path path={outer} color={glow} style="stroke" strokeWidth={16} strokeCap="round" strokeJoin="round" opacity={0.14} />
        <Path path={middle} color={glow} style="stroke" strokeWidth={8} strokeCap="round" strokeJoin="round" opacity={0.26} />
        <Path path={inner} color={glow} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" opacity={0.6} />
      </Group>
      {/* Founder, 2026-09-29: slim, brighter cores of light inside the
          wisps, sharp (outside the blur), on the same paths and motion,
          ending before the tip so the smoke still trails off past them. */}
      <Path path={electric ? outer : middle} color={brighten(glow, electric ? 0.7 : 0.55)} style="stroke" strokeWidth={electric ? 1.3 : 1.6} strokeCap="round" strokeJoin="round" opacity={0.85} />
      </Group>
    </Canvas>
  );
}
