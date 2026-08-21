import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { SpriteMistPoC, type MistColor } from "../components/SpriteMistPoC";

// Mist mechanism: settled 2026-08-13. Per "Sonder - Direct Instructions for
// CC (2026-08-11, Part 18)" + Addendum, the N=1/N=2 decoder-cliff finding
// ruled out any approach leaning on MediaCodec for more than one concurrent
// stream, so AmbientMist's video crossfade was replaced. Three MediaCodec-
// free alternatives (a procedural Skia shader, a Lottie vector animation,
// and this pre-rendered sprite atlas) were built and compared live on the
// OnePlus 8T; the founder picked the sprite atlas (SpriteMistPoC) as the
// winner. The other two and AmbientMist are removed — see
// SpriteMistPoC.tsx for why this option avoids both MediaCodec and Skia's
// shader path entirely.
//
// No real mood-to-color mapping exists yet (still blocked per "Sonder -
// Direct Instructions for CC 2026-08-10 Part 13" / Part 16) — this is a
// static placeholder color until that's wired up.
const DEFAULT_MIST_COLOR: MistColor = "violet";

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
//
// Per founder direct instruction (2026-08-13): the camera's live feed must
// never be visible on screen — only the mist, always in front of a solid
// black background. `blackBackdrop` below is an unconditionally opaque
// full-screen layer sitting between the (still-running, still-mounted)
// Camera and every mist/tint layer, so no gap or transparency in anything
// drawn on top of it can ever let a camera pixel show through. The Camera
// component still needs to be mounted with real layout bounds and
// `isActive` for the frame processor to receive frames — vision-camera
// delivers frames regardless of what's painted on top of its view, so
// covering it visually doesn't affect tracking.
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
  // Part 42 Bug 1 (founder, live on-device): both bottom-anchored links were
  // rendering under the phone's on-screen nav bar — a fixed `bottom: 24`
  // never accounted for the system inset this app's edge-to-edge rendering
  // draws under.
  const insets = useSafeAreaInsets();
  const [topCategories, setTopCategories] = useState<Category[]>([]);
  const [facesDetected, setFacesDetected] = useState(0);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);

  const quality = useSharedValue(1);
  const latestQualityRef = useRef(1);
  const hapticActiveRef = useRef(false);
  const hapticTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wellFramedSinceRef = useRef<number | null>(null);
  // Real bug found 2026-08-14 (founder report, Part 24): navigating away to
  // /chat, the haptic tremor kept buzzing indefinitely — chat.tsx has no
  // camera/haptic code at all, so it couldn't be that screen running
  // face-tracking it shouldn't. The actual cause: react-native-vision-
  // camera's frame processor runs on a native thread that isn't guaranteed
  // to stop the instant this component unmounts — a frame already in
  // flight can still call onResults→startHapticLoop() after unmount's
  // cleanup (stopHapticLoop) has already run. Once that happens, nothing
  // can ever stop it again — the cleanup effect only fires once, so an
  // orphaned setTimeout-chained tick() loop runs forever, matching
  // "doesn't stop" exactly (not just a longer tail than expected). Guard:
  // bail at the very top of onResults once unmounted, so a late-arriving
  // native callback is a genuine no-op instead of reviving the loop.
  const isMountedRef = useRef(true);

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
  const tick = useCallback(() => {
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
  }, []);

  const startHapticLoop = useCallback(() => {
    hapticActiveRef.current = true;
    // Resumes a paused loop (see pausePendingTick) as well as a cold
    // start — either way, if nothing is currently scheduled, tick now.
    if (hapticTimeoutRef.current === null) tick();
  }, [tick]);

  // Real bug found 2026-08-11 by tracing the Aug 9 debounce fix: that fix
  // only debounced WHEN hapticActiveRef flips to false (stopHapticLoop was
  // called after HAPTIC_STOP_DEBOUNCE_MS of continuous good framing) but
  // left the independently-scheduled tick() timer running untouched during
  // that whole debounce window. Whenever framing was quite poor right
  // before the person re-centered (short tick interval, near
  // HAPTIC_MIN_INTERVAL_MS), the next tick could already be scheduled to
  // fire sooner than the 200ms debounce completes — so it fires *after*
  // re-framing, before stopHapticLoop() gets a chance to cancel it. That's
  // the real cause of "buzz continues for a beat after re-framing," not
  // perception — a genuine extra Haptics.impactAsync() call slipping
  // through. Fix: cancel the pending tick the INSTANT framing crosses into
  // well-framed, not only after the debounce confirms a real stop.
  // hapticActiveRef deliberately stays true during this pause (not flipped
  // to false) so a genuine re-framing dip within the debounce window
  // resumes ticking immediately via startHapticLoop's "nothing currently
  // scheduled" check, rather than going through a cold restart.
  const pausePendingTick = useCallback(() => {
    if (hapticTimeoutRef.current !== null) {
      clearTimeout(hapticTimeoutRef.current);
      hapticTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopHapticLoop();
    };
  }, [stopHapticLoop]);

  const onResults = useCallback((result: FaceLandmarkDetectionResultBundle) => {
    if (!isMountedRef.current) return;
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
    //
    // Real bug found 2026-08-19 (Part 34 item 3 — founder: haptic fires even
    // with face plainly in view, distinct from the Aug 17 thermal/slow-
    // inference explanation). The original metric took the MIN across every
    // one of MediaPipe's ~468 landmark points — a single peripheral point
    // (ear, jaw contour, chin) drifting near an edge tanked the whole score
    // to 0 regardless of how centered the actual face was. For a companion
    // app where people naturally hold the phone close, jaw/ear/chin points
    // routinely sit near the frame edge during completely normal framing —
    // this was measuring "is the single worst point safely inside," not "is
    // your face in view."
    //
    // First fix attempt (bounding-box center) over-corrected — founder
    // confirmed live it stopped buzzing even when clearly out of frame. A
    // pure center barely moves toward an edge until most of the face is
    // actually gone, so it lost real sensitivity to genuine partial
    // framing, not just noisy single-point jitter. This version instead
    // trims only the noisiest ~10% of points (the same handful of jittery
    // contour/extrapolated points causing the original bug) and uses the
    // next-worst point as the score — still reacts as more of the face
    // genuinely leaves frame (more points get close to an edge, moving the
    // 10th-percentile point too), but one single outlier can no longer tank
    // the whole score alone.
    const landmarks = faces[0]?.faceLandmarks?.[0] ?? [];
    let frameScore = 0;
    if (landmarks.length) {
      const distances = landmarks
        .map((p) => Math.min(p.x, 1 - p.x, p.y, 1 - p.y))
        .sort((a, b) => a - b);
      const trimIndex = Math.floor(distances.length * 0.1);
      frameScore = distances[trimIndex] * 6;
    }
    const clamped = Math.max(0, Math.min(1, frameScore));
    quality.value = withTiming(clamped, { duration: 350 });
    latestQualityRef.current = clamped;

    if (cameraMode === "face" && clamped < WELL_FRAMED_THRESHOLD) {
      wellFramedSinceRef.current = null;
      startHapticLoop();
    } else {
      const now = Date.now();
      if (wellFramedSinceRef.current === null) {
        wellFramedSinceRef.current = now;
        pausePendingTick();
      }
      if (now - wellFramedSinceRef.current >= HAPTIC_STOP_DEBOUNCE_MS) {
        stopHapticLoop();
      }
    }
  }, [quality, cameraMode, startHapticLoop, stopHapticLoop, pausePendingTick]);

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
      <View style={styles.blackBackdrop} pointerEvents="none" />
      <Animated.View
        style={[StyleSheet.absoluteFillObject, mistStyle]}
        pointerEvents="none"
      />
      <SpriteMistPoC color={DEFAULT_MIST_COLOR} />
      {
        // Always visible, not dev-gated — /chat is a real product surface
        // now (Part 21), not a debug tool like chat-test.tsx (removed) was.
        // The cast is a stale-local-typegen workaround, not a real type
        // hole: .expo/types/router.d.ts (gitignored, Metro-generated) only
        // regenerates against a live dev server, so a route added without
        // one running typechecks against a stale route union locally. The
        // route itself (src/app/chat.tsx) is real and resolves fine at
        // runtime regardless.
      }
      <Link
        href={"/chat" as never}
        style={[styles.chatLink, { bottom: insets.bottom + 24 }]}
      >
        Talk to Sonder →
      </Link>
      {
        // TEMPORARY dev-only entry point for onboarding-rebuild step 5's
        // live verification — the plan's real launch path is the root
        // _layout.tsx redirect gate (build order step 8, not wired yet).
        // Remove once that gate lands and makes this route reachable
        // naturally on a fresh install.
      }
      {__DEV__ && (
        <Link
          href={"/onboarding/setup" as never}
          style={[styles.onboardingDevLink, { bottom: insets.bottom + 24 }]}
        >
          Onboarding (dev) →
        </Link>
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
  blackBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  chatLink: {
    position: "absolute",
    right: 16,
    color: "#7CFFB2",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  onboardingDevLink: {
    position: "absolute",
    left: 16,
    color: "#D4AF7A",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: "600",
  },
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
});
