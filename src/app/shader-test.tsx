import { StyleSheet, Text, View } from "react-native";
import { ShaderMistPoC } from "../components/ShaderMistPoC";

// TEMPORARY, evaluation-only. Isolates ShaderMistPoC from the camera +
// MediaPipe face-landmark pipeline it normally shares a screen with
// (FaceSignatureTest, src/app/index.tsx) to answer one question: does the
// shader mist actually render frames on its own, or is the "Render:0" every
// window / zero-output-buffers finding from the combined screen (2026-08-10)
// caused by the shader mist itself, or by thread contention with the camera
// + MediaPipe frame processor running concurrently on the same screen?
// No camera, no MediaPipe, nothing else running here — if MediaCodec's
// Stats line still shows Render:0 in this isolated screen, the bug is in
// the shader PoC itself, independent of the sensing pipeline. If frames
// render fine here, it confirms thread contention as the real cause.
// Reachable via `adb shell am start -a android.intent.action.VIEW -d
// sonder://shader-test` (scheme "sonder" per app.json) — not linked from
// any real navigation, evaluation-only per canonical scope. Delete once
// the founder has seen the verdict and a direction is decided.
export default function ShaderTestIsolated() {
  return (
    <View style={styles.container}>
      <ShaderMistPoC />
      <View style={styles.label} pointerEvents="none">
        <Text style={styles.labelText}>
          isolated shader test — no camera, no MediaPipe
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
