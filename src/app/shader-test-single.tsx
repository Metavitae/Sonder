import { StyleSheet, Text, View } from "react-native";
import { ShaderMistSinglePoC } from "../components/ShaderMistSinglePoC";

// TEMPORARY, evaluation-only. Narrows the 2026-08-10 "Render:0" finding
// further: shader-test.tsx already ruled out camera/MediaPipe thread
// contention (same failure occurs with nothing else running). This screen
// removes the other variable — three concurrent useVideo() calls — down to
// exactly one, to answer: does Skia's useVideo render at all here, or is it
// broken regardless of decoder count? Reachable via `adb shell am start -a
// android.intent.action.VIEW -d sonder://shader-test-single`. Delete once
// the founder has seen the verdict.
export default function ShaderTestSingle() {
  return (
    <View style={styles.container}>
      <ShaderMistSinglePoC />
      <View style={styles.label} pointerEvents="none">
        <Text style={styles.labelText}>
          isolated shader test — single video, no camera
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  label: {
    position: "absolute",
    bottom: 48,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 8,
    borderRadius: 8,
  },
  labelText: { color: "#F0E6FF", fontSize: 13 },
});
