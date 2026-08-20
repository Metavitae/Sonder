import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, Image as SvgImage, Polygon } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  MIST_ATLAS_SOURCE,
  type MistColor,
  getMistFrameLayout,
  useMistFrame,
} from "../../lib/mistAtlas";

export const SWATCH_SIZE = 64;
const CORNER_CUT = SWATCH_SIZE * 0.28;

// Emerald-cut approximation: a rectangle with truncated corners, per "Sonder
// - Selection UI: Stones Retired, Fog Adopted" (2026-08-06) — the facet
// silhouette is a real, kept part of the design; only the FILL is retired
// from a static mineral color to the mist system (below). Two smaller
// concentric octagons (undecorated, stroke-only) suggest the inner facet
// rings from the original description without a full facet-cut renderer.
function octagonPoints(size: number, cut: number): string {
  return [
    [cut, 0],
    [size - cut, 0],
    [size, cut],
    [size, size - cut],
    [size - cut, size],
    [cut, size],
    [0, size - cut],
    [0, cut],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

const OUTER_POINTS = octagonPoints(SWATCH_SIZE, CORNER_CUT);
const RING1_SIZE = SWATCH_SIZE - 16;
const RING1_POINTS = octagonPoints(RING1_SIZE, CORNER_CUT * 0.75);
const RING2_SIZE = SWATCH_SIZE - 30;
const RING2_POINTS = octagonPoints(RING2_SIZE, CORNER_CUT * 0.55);

const GOLD = "#D4AF7A";

// Unselected = low intensity + dimmed ("a soft, dim, quiet cloud of its own
// color"); selected = higher intensity + full opacity + a breathing pulse.
// Reuses moodToMist.ts's own 0.15 "calm" tier for the unselected floor so
// this doesn't invent a second intensity convention.
const UNSELECTED_INTENSITY = 0.15;
const SELECTED_INTENSITY = 0.75;
const UNSELECTED_OPACITY = 0.45;

export function FogGemSwatch({
  color,
  label,
  selected,
  onSelect,
  idSuffix,
}: {
  color: MistColor;
  label: string;
  selected: boolean;
  onSelect: () => void;
  // Distinguishes this swatch's SVG clipPath id from any other FogGemSwatch
  // rendered simultaneously elsewhere on screen (e.g. the same color used in
  // both the user-gender and Sonder-gender pickers at once).
  idSuffix: string;
}) {
  // Per-mount randomized start so multiple swatches don't visibly lock-step
  // ("each stone glimmering on its own staggered timer") — see
  // mistAtlas.ts's useMistFrame `startDelayMs` param.
  const startDelayMs = useMemo(() => Math.random() * 500, []);
  const intensity = selected ? SELECTED_INTENSITY : UNSELECTED_INTENSITY;
  const frame = useMistFrame(intensity, startDelayMs);
  const { atlasWidth, atlasHeight, offsetX, offsetY } = getMistFrameLayout(
    color,
    frame,
    SWATCH_SIZE,
    SWATCH_SIZE
  );

  const opacity = useSharedValue(UNSELECTED_OPACITY);
  const pulse = useSharedValue(1);
  opacity.value = withTiming(selected ? 1 : UNSELECTED_OPACITY, { duration: 300 });
  pulse.value = selected
    ? withRepeat(withTiming(1.08, { duration: 1400 }), -1, true)
    : withTiming(1, { duration: 300 });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: pulse.value }],
  }));

  const clipId = `fog-gem-clip-${color}-${idSuffix}`;

  return (
    <Pressable onPress={onSelect} style={styles.wrapper} accessibilityRole="button">
      <Animated.View style={animatedStyle}>
        <Svg width={SWATCH_SIZE} height={SWATCH_SIZE} viewBox={`0 0 ${SWATCH_SIZE} ${SWATCH_SIZE}`}>
          <Defs>
            <ClipPath id={clipId}>
              <Polygon points={OUTER_POINTS} />
            </ClipPath>
          </Defs>
          {/* The gem's color/light IS the mist system, not a static fill —
              same atlas frame math as SpriteMistPoC, clipped to the facet
              silhouette instead of the full screen. */}
          <SvgImage
            href={MIST_ATLAS_SOURCE}
            x={offsetX}
            y={offsetY}
            width={atlasWidth}
            height={atlasHeight}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="none"
          />
          <Polygon points={OUTER_POINTS} fill="none" stroke={GOLD} strokeWidth={1.5} opacity={0.8} />
          <Polygon
            points={RING1_POINTS}
            fill="none"
            stroke={GOLD}
            strokeWidth={1}
            opacity={0.4}
            transform={`translate(${(SWATCH_SIZE - RING1_SIZE) / 2}, ${(SWATCH_SIZE - RING1_SIZE) / 2})`}
          />
          <Polygon
            points={RING2_POINTS}
            fill="none"
            stroke={GOLD}
            strokeWidth={1}
            opacity={0.3}
            transform={`translate(${(SWATCH_SIZE - RING2_SIZE) / 2}, ${(SWATCH_SIZE - RING2_SIZE) / 2})`}
          />
        </Svg>
      </Animated.View>
      <View style={styles.placardDivider} />
      <Text style={styles.placard}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 6, padding: 4 },
  placardDivider: { width: SWATCH_SIZE * 0.7, height: 1, backgroundColor: GOLD, opacity: 0.5 },
  placard: {
    color: GOLD,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
