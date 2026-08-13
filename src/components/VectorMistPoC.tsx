import { StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";

import type { MistColor } from "./AmbientMist";

// PoC only, per "Sonder - Direct Instructions for CC (2026-08-11, Part 18)",
// option 2 of 3: GPU-rasterized vector animation (no video file, no
// MediaCodec/MediaExtractor, and — unlike ProceduralMistPoC — no per-pixel
// shader compute either). Chose Lottie over Rive for this PoC: Lottie files
// are plain JSON, so a placeholder animation can be hand-authored directly
// (see assets/mist/lottie/mist_poc.json) without an external design tool or
// a binary .riv asset. If this option wins Part 18's comparison, swapping in
// real authored art (Lottie or a promoted-to-Rive rebuild) is a separate,
// later decision — this file only needs to prove the mechanism performs.
//
// The JSON has three overlapping "mist" shape layers (soft blobs) with
// looping position/scale/opacity keyframes for organic drift — all sharing
// the same layer name so one colorFilters entry recolors all three via
// lottie-react-native's runtime dynamic-properties API, the same way
// ProceduralMistPoC takes color as a live prop rather than baking it into
// the asset.
const MIST_HEX: Record<MistColor, string> = {
  violet: "#6C3DB8",
  magenta: "#C72E8C",
  cyan: "#26A6C7",
  amber: "#D98C26",
  blue: "#2E52D1",
};

export function VectorMistPoC({ color }: { color: MistColor }) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <LottieView
        source={require("../../assets/mist/lottie/mist_poc.json")}
        autoPlay
        loop
        style={StyleSheet.absoluteFillObject}
        colorFilters={[{ keypath: "mist", color: MIST_HEX[color] }]}
      />
    </View>
  );
}
