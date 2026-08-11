import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  Delegate,
  RunningMode,
  useFaceLandmarkDetection,
  type FaceLandmarkDetectionResultBundle,
} from "react-native-mediapipe";
import { ShaderMistPoC } from "../components/ShaderMistPoC";

// The 3-layer stacked-SurfaceView test (MistThreeLayerTest.tsx) already
// delivered its verdict — CHOPPY, per "Sonder - Log - Part 11 results" — so
// this screen now runs the shader-based single-Skia-surface alternative
// instead (ShaderMistPoC.tsx), per "Sonder - Shader-Based Mixing:
// Proof-of-Concept Only (canonical 2026-08-09)". Same real-condition
// methodology: real logcat signals with camera + MediaPipe running
// concurrently, not a visual read.

// De-risking PoC for the Kithe/Sonder "needs boundary" Level 1 sensing
// mechanism (§9 of the Complete Reference): does an on-device pipeline that
// compresses camera video into a compact, non-visual "signature" actually
// exist and run, without ever persisting a frame? This screen answers that
// with a live MediaPipe Face Landmarker blendshape vector — nothing here is
// saved to disk, sent over the network, or kept once the app closes.
//
// Per "Sonder — Direct Instructions for CC (2026-08-04)": the raw numbers
// below are a dev-only verification aid, never user-facing (seeing the
// mechanism defeats the invisible-personality-read design). The user-facing
// half of this screen is the ambient mist, which stands in for Sonder's
// Sight sense (§8) reacting to tracking quality — dimmer/cooler on poor
// angle, lighting, or partial framing, with a repeated corrective haptic
// buzz for as long as framing stays poor, silent once well-framed. It must
// only ever reflect genuine tracking quality, never anything else.
const SHOW_DEBUG_OVERLAY = __DEV__;

// Framing-quality threshold below which the user counts as "poorly framed."
// Reuses the exact cutoff the mist-tint style already switches on (see
// `mistStyle` below, `quality.value > 0.5`) per "Sonder - Haptic Sensitivity
// Resolved (canonical 2026-08-07)" — one definition of "well-framed" driving
// both the visual and haptic channels, not two thresholds to keep in sync.
const WELL_FRAMED_THRESHOLD = 0.5;

// Repeat interval bounds for the corrective buzz while poorly framed: slow
// nudge right at the threshold, faster/more urgent as framing quality drops
// toward 0 (face lost entirely). Tunable after real on-device testing per
// the canonical doc — these are a reasonable starting point, not measured.
const HAPTIC_MAX_INTERVAL_MS = 900;
const HAPTIC_MIN_INTERVAL_MS = 350;

// How long quality must stay continuously at/above the threshold before the
// buzz loop actually stops. Fixes a real bug (Aug 9 2026): re-framing isn't
// instant — landmark-derived quality jitters right around the boundary for
// a moment before settling — and starting the loop fresh fires an immediate
// buzz every time it's (re)activated, so without this debounce that jitter
// produced a burst of extra buzzes right at the crossing point rather than
// a clean stop. Deliberately asymmetric: only the stop side is debounced,
// so reacting to newly-poor framing stays instant.
const HAPTIC_STOP_DEBOUNCE_MS = 200;

// Two distinct reasons the camera can be active: reading the user's face
// (this screen, today) vs. reading the environment instead (a future mode,
// not built yet — e.g. "scanning a room"). The "I can't see you" guidance
// tremor only means something in face mode; in environment mode the camera
// is deliberately pointed away from the face, so firing it there would be a
// false alarm. This screen only ever runs in face mode right now, but the
// gate is real so a future environment-reading screen can share this
// component's haptic logic without the tremor firing incorrectly.
type CameraMode = "face" | "environment";

type Category = { categoryName?: string; score: number };

export default function FaceSignatureTest({
  cameraMode = "face",
}: {
  cameraMode?: CameraMode;
}) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [topCategories, setTopCategories] = useState<Category[]>([]);
  const [facesDetected, setFacesDetected] = useState(0);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);

  const quality = useSharedValue(1);
  const latestQualityRef = useRef(1);
  const hapticActiveRef = useRef(false);
  const hapticTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wellFramedSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const stopHapticLoop = useCallback(() => {
    if (!hapticActiveRef.current) return;
    hapticActiveRef.current = false;
    if (hapticTimeoutRef.current !== null) {
      clearTimeout(hapticTimeoutRef.current);
      hapticTimeoutRef.current = null;
    }
    // TEMPORARY trace log, unconditional (not gated on SHOW_DEBUG_OVERLAY —
    // preview/release builds run with __DEV__ false, and this is exactly
    // what's needed to confirm the Aug 9 late-stop fix on the next real
    // device pass via logcat). Remove once the fix is confirmed on-device.
    console.log(`[haptic] stop, q=${latestQualityRef.current.toFixed(2)}`);
  }, []);

  // Repeated corrective buzz while poorly framed, silent once well-framed —
  // per "Sonder - Haptic Sensitivity Resolved (canonical 2026-08-07)".
  // Interval and impact style scale with how far below the threshold the
  // latest quality reading is (read live via a ref, not closed over, so the
  // running loop always reacts to the current frame rather than the frame
  // that started it).
  const startHapticLoop = useCallback(() => {
    if (hapticActiveRef.current) return;
    hapticActiveRef.current = true;

    const tick = () => {
      if (!hapticActiveRef.current) return;
      const severity = Math.max(
        0,
        Math.min(1, 1 - latestQualityRef.current / WELL_FRAMED_THRESHOLD)
      );
      Haptics.impactAsync(
        severity > 0.6
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
      // TEMPORARY trace log — see stopHapticLoop's matching note.
      console.log(
        `[haptic] buzz, q=${latestQualityRef.current.toFixed(2)} severity=${severity.toFixed(2)}`
      );
      const delay =
        HAPTIC_MAX_INTERVAL_MS -
        severity * (HAPTIC_MAX_INTERVAL_MS - HAPTIC_MIN_INTERVAL_MS);
      hapticTimeoutRef.current = setTimeout(tick, delay);
    };
    tick();
  }, []);

  useEffect(() => stopHapticLoop, [stopHapticLoop]);

  const onResults = useCallback((result: FaceLandmarkDetectionResultBundle) => {
    const faces = result.results ?? [];
    setFacesDetected(faces.length);
    setInferenceMs(result.inferenceTime ?? null);

    const blendshapes = faces[0]?.faceBlendshapes?.[0]?.categories ?? [];
    const sorted = [...blendshapes]
      .filter((c) => (c.categoryName ?? "") !== "_neutral")
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    setTopCategories(sorted);

    // Tracking-quality proxy: how close the detected face sits to the frame
    // edge. A face cut off by partial framing (or lost to a bad angle) pushes
    // landmarks toward 0/1 in normalized coordinates; a well-framed face sits
    // comfortably inside the margin. This is the one thing derivable from
    // landmarks alone without reading anything about the user beyond "is the
    // camera seeing you well right now."
    const landmarks = faces[0]?.faceLandmarks?.[0] ?? [];
    const frameScore = landmarks.length
      ? Math.min(
          ...landmarks.map((p) => Math.min(p.x, 1 - p.x, p.y, 1 - p.y) * 6)
        )
      : 0;
    const clamped = Math.max(0, Math.min(1, frameScore));
    quality.value = withTiming(clamped, { duration: 350 });
    latestQualityRef.current = clamped;

    if (cameraMode === "face" && clamped < WELL_FRAMED_THRESHOLD) {
      wellFramedSinceRef.current = null;
      startHapticLoop();
    } else {
      const now = Date.now();
      if (wellFramedSinceRef.current === null) wellFramedSinceRef.current = now;
      if (now - wellFramedSinceRef.current >= HAPTIC_STOP_DEBOUNCE_MS) {
        stopHapticLoop();
      }
    }
  }, [quality, cameraMode, startHapticLoop, stopHapticLoop]);

  const onError = useCallback((error: { code: number; message: string }) => {
    console.error("Face landmark detection error:", error.code, error.message);
  }, []);

  const solution = useFaceLandmarkDetection(
    onResults,
    onError,
    RunningMode.LIVE_STREAM,
    "face_landmarker.task",
    {
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: Delegate.GPU,
    }
  );

  const device = useCameraDevice("front");
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }]);

  useEffect(() => {
    if (device) solution.cameraDeviceChangeHandler(device);
  }, [solution, device]);

  const mistStyle = useAnimatedStyle(() => ({
    opacity: 0.75 - quality.value * 0.55,
    backgroundColor: quality.value > 0.5 ? "#3a2c52" : "#0d1a2b",
  }));

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Waiting for camera permission…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {device == null ? (
        <Text style={styles.info}>Loading camera…</Text>
      ) : (
        <Camera
          style={StyleSheet.absoluteFillObject}
          device={device}
          format={format}
          pixelFormat="rgb"
          isActive={true}
          frameProcessor={solution.frameProcessor}
          onLayout={solution.cameraViewLayoutChangeHandler}
          onOutputOrientationChanged={solution.cameraOrientationChangedHandler}
        />
      )}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, mistStyle]}
        pointerEvents="none"
      />
      <ShaderMistPoC />
      {SHOW_DEBUG_OVERLAY && (
        <View style={styles.testHarnessLabel} pointerEvents="none">
          <Text style={styles.hudText}>
            TEMP: shader mixing PoC (Part 12)
          </Text>
        </View>
      )}
      {SHOW_DEBUG_OVERLAY && (
        <View style={styles.hud}>
          <Text style={styles.hudTitle}>live signature — nothing recorded</Text>
          <Text style={styles.hudText}>faces: {facesDetected}</Text>
          <Text style={styles.hudText}>
            inference: {inferenceMs !== null ? `${inferenceMs.toFixed(1)}ms` : "—"}
          </Text>
          {topCategories.map((c, i) => (
            <Text key={c.categoryName ?? `unnamed-${i}`} style={styles.hudText}>
              {c.categoryName}: {c.score.toFixed(2)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111" },
  info: { color: "#eee", fontSize: 16 },
  hud: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 12,
    borderRadius: 8,
  },
  hudTitle: { color: "#7CFFB2", fontWeight: "700", marginBottom: 6 },
  hudText: { color: "#F0E6FF", fontSize: 13 },
  testHarnessLabel: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 8,
    borderRadius: 8,
  },
});
