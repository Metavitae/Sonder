import { useWindowDimensions } from "react-native";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useClock } from "@shopify/react-native-skia/lib/module/external/reanimated";
import { useDerivedValue } from "react-native-reanimated";

import type { MistColor } from "./AmbientMist";

// PoC only, per "Sonder - Direct Instructions for CC (2026-08-11, Part 18)",
// option 1 of 3: does a pure procedural GPU shader (no video file, no
// MediaCodec/MediaExtractor anywhere in the path) render smoothly alongside
// camera + MediaPipe on this hardware? This is explicitly NOT the same code
// path as the deleted ShaderMistPoC.tsx (2026-08-11) — that one crashed
// (real SIGSEGV) inside Skia's *video* pipeline (useVideo -> MediaExtractor)
// under concurrent-decoder load. This component never touches a video
// decoder: the "mist" is entirely computed math (fractal value noise) inside
// an SkSL fragment shader, so if it's unstable, the cause has to be Skia's
// GPU/shader path itself under load, not MediaCodec contention — a genuinely
// different failure mode than the one that killed the last attempt.
//
// Noise choice: domain-warped fbm (fractal Brownian motion) built on 2D
// value noise, not literal Perlin/simplex — simpler to get correct in SkSL
// on a first pass, and visually equivalent for a soft drifting-fog look.
// Swap in true simplex noise later only if this reads as too grid-aligned
// on real hardware.
const source = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float3 color;

float hash(float2 p) {
  float3 p3 = fract(p.xyx * float3(123.34, 456.21, 789.13));
  p3 += dot(p3, p3.yzx + 45.32);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(float2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * valueNoise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / resolution.y;
  float2 drift = float2(time * 0.03, time * 0.02);

  float n1 = fbm(uv * 2.2 + drift);
  float n2 = fbm(uv * 3.5 - drift * 1.6 + 10.0);
  float mist = fbm(float2(n1, n2) * 1.5 + time * 0.015);

  float brightness = 0.35 + 0.65 * smoothstep(0.15, 0.85, mist);
  float3 rgb = color * brightness;
  return half4(rgb, 1.0);
}
`)!;

// Same five-color palette as AmbientMist's video sources, expressed as
// approximate normalized RGB rather than the exact video grade — close
// enough for a "does the mechanism perform" evaluation, not a color-match
// exercise.
const MIST_RGB: Record<MistColor, [number, number, number]> = {
  violet: [0.42, 0.24, 0.72],
  magenta: [0.78, 0.18, 0.55],
  cyan: [0.15, 0.65, 0.78],
  amber: [0.85, 0.55, 0.15],
  blue: [0.18, 0.32, 0.82],
};

export function ProceduralMistPoC({ color }: { color: MistColor }) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();

  const uniforms = useDerivedValue(() => {
    return {
      resolution: [width, height],
      time: clock.value / 1000,
      color: MIST_RGB[color],
    };
  }, [clock, width, height, color]);

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Fill>
        <Shader source={source} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
