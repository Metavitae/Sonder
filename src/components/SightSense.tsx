import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { type SharedValue, withTiming } from "react-native-reanimated";
import { Camera, useCameraDevice, useCameraFormat } from "react-native-vision-camera";
import {
  Delegate,
  RunningMode,
  useFaceLandmarkDetection,
  type FaceLandmarkDetectionResultBundle,
} from "react-native-mediapipe";

import { recordSightFrame, resetSight } from "../lib/sightReading";

// Sonder's sight, inside the diary (founder, 2026-09-27: open straight into
// the diary, and "the camera keeps on looking for reactions from the user...
// like the diary/Sonder is looking back"). Moved here from the old launch
// screen (app/sense-test.tsx, kept as a test screen). Mounted only when the
// camera permission was already granted at onboarding — the diary never asks.
//
// Two jobs, per "Sonder's Senses - Beyond the Voice" (Sight):
// 1. How well Sonder sees them: poor framing dims and cools the mist
//    (via `quality`), never a literal prompt. The old repeating corrective
//    buzz is gone — typing, faces drift out of frame all the time, and the
//    doc asks for a mist shift there, not an alarm.
// 2. Leaving the frame entirely: ONE small, quick tremor — "a flinch rather
//    than a startle" — and not again until Sonder has seen them again.
// Plus the part that reaches Sonder: each frame's expression reading goes
// into sightReading.ts, and becomes a few words sent with the next message.
//
// Privacy shape unchanged from the old screen: the camera feed is never on
// screen (the parent draws an opaque black layer over this), no frame is
// saved or sent anywhere, and only plain words ever leave the phone.

const WELL_FRAMED_THRESHOLD = 0.5;
// Lost = no face for this long (a single missed frame isn't a departure).
const LOST_AFTER_MS = 1500;
// Seen again = a face for this long, before a later loss can flinch again.
const REFOUND_AFTER_MS = 1000;

export function SightSense({ quality }: { quality: SharedValue<number> }) {
  const isMountedRef = useRef(true);
  const lastFaceAtRef = useRef<number | null>(null);
  const faceSinceRef = useRef<number | null>(null);
  const flinchedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    resetSight();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onResults = useCallback(
    (result: FaceLandmarkDetectionResultBundle) => {
      // A frame already in flight on the native thread can land after
      // unmount — same guard the old screen needed (2026-08-14 bug).
      if (!isMountedRef.current) return;
      const now = Date.now();
      const face = result.results?.[0];
      const landmarks = face?.faceLandmarks?.[0] ?? [];

      recordSightFrame(landmarks.length ? (face?.faceBlendshapes?.[0]?.categories ?? []) : null);

      // Same framing metric as the old screen (2026-08-19 fix): the
      // 10th-percentile landmark's distance from the frame edge.
      let score = 0;
      if (landmarks.length) {
        const distances = landmarks
          .map((p) => Math.min(p.x, 1 - p.x, p.y, 1 - p.y))
          .sort((a, b) => a - b);
        score = distances[Math.floor(distances.length * 0.1)] * 6;
      }
      quality.value = withTiming(Math.max(0, Math.min(1, score)), { duration: 350 });

      if (landmarks.length) {
        lastFaceAtRef.current = now;
        if (faceSinceRef.current === null) faceSinceRef.current = now;
        if (flinchedRef.current && now - faceSinceRef.current >= REFOUND_AFTER_MS) {
          flinchedRef.current = false;
        }
      } else {
        faceSinceRef.current = null;
        const seenBefore = lastFaceAtRef.current !== null;
        if (seenBefore && !flinchedRef.current && now - (lastFaceAtRef.current ?? now) >= LOST_AFTER_MS) {
          flinchedRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
    },
    [quality]
  );

  const onError = useCallback((error: { code: number; message: string }) => {
    console.error("[sight] face landmark error:", error.code, error.message);
  }, []);

  const solution = useFaceLandmarkDetection(onResults, onError, RunningMode.LIVE_STREAM, "face_landmarker.task", {
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    delegate: Delegate.GPU,
  });

  const device = useCameraDevice("front");
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }]);

  useEffect(() => {
    if (device) solution.cameraDeviceChangeHandler(device);
  }, [solution, device]);

  if (!device) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        pixelFormat="rgb"
        isActive={true}
        frameProcessor={solution.frameProcessor}
        onLayout={solution.cameraViewLayoutChangeHandler}
        onOutputOrientationChanged={solution.cameraOrientationChangedHandler}
      />
    </View>
  );
}

export { WELL_FRAMED_THRESHOLD };
