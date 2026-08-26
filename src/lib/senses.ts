import { Camera } from "react-native-vision-camera";
import * as Calendar from "expo-calendar";
import * as Notifications from "expo-notifications";
import * as LocalAuthentication from "expo-local-authentication";
import { Accelerometer } from "expo-sensors";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import SonderAudioRoute from "../../modules/sonder-audio-route/src/SonderAudioRouteModule";

// Permits-panel sense list, current source: "Sonder - Direct Instructions
// for CC 2026-08-26 Part 58" (extends Part 57). Every real sense Sonder
// uses gets its own toggle on the one panel, dynamically detected per
// device rather than a fixed universal list (Part 58 item 3) — both
// isSupported and isGranted are async because real per-device detection
// (Accelerometer.isAvailableAsync, camera device enumeration) and real OS
// permission status (Calendar/Notifications/LocalAuthentication) are both
// promise-based; only vision-camera happens to expose a sync status getter,
// so the interface doesn't special-case it.
//
// `shareable` marks the four senses that generate real signal about the
// user's expressions/environment and are genuinely anonymizable under the
// Level 1/Level 2 architecture (Part 58 item 2) — only these count toward
// the tier-up gate (`allSensesGranted`). Calendar/notifications/biometric
// are real Sonder features, shown on the same panel, but are never shared
// with anyone and never required for a tier-up.
export type SenseId =
  | "vision"
  | "motion"
  | "headphones"
  | "microphone"
  | "calendar"
  | "notifications"
  | "biometric";

export type Sense = {
  id: SenseId;
  label: string;
  shareable: boolean;
  // Part 60 item 2: whether tapping this sense's button does anything real
  // (shows a system permission dialog, or — biometric — runs a real auth
  // prompt) vs. is purely informational because Android auto-grants it and
  // no dialog exists to trigger. Panel renders these two cases differently
  // so it never visually implies a real ask where there isn't one.
  requiresAction: boolean;
  isSupported: () => Promise<boolean>;
  isGranted: () => Promise<boolean>;
  request: () => Promise<boolean>;
};

const vision: Sense = {
  id: "vision",
  label: "Camera",
  shareable: true,
  requiresAction: true,
  isSupported: async () =>
    Camera.getAvailableCameraDevices().some((d) => d.position === "front"),
  isGranted: async () => Camera.getCameraPermissionStatus() === "granted",
  request: async () => (await Camera.requestCameraPermission()) === "granted",
};

// Real per-device detection — not every device has an accelerometer.
const motion: Sense = {
  id: "motion",
  label: "Motion",
  shareable: true,
  requiresAction: false,
  isSupported: async () => Accelerometer.isAvailableAsync(),
  // No Android runtime permission for motion — auto-granted at install,
  // no system dialog exists. Shown as an always-on toggle when supported
  // (Part 55/57's "honest about everything Sonder senses").
  isGranted: async () => true,
  request: async () => true,
};

// Part 61: real per-device capability check, not an assumption — Android's
// PackageManager.FEATURE_AUDIO_OUTPUT, the actual API apps use for this,
// checked via a Function added to the local sonder-audio-route native
// module (no JS-side Expo API exposes PackageManager feature checks).
const headphones: Sense = {
  id: "headphones",
  label: "Headphone detection",
  shareable: true,
  requiresAction: false,
  isSupported: async () => SonderAudioRoute.hasAudioOutput(),
  isGranted: async () => true,
  request: async () => true,
};

// New per Part 58 item 1 — paired with the record-then-transcribe voice
// mode (not built yet, this is the permission piece only). Real Android
// runtime permission (RECORD_AUDIO). isSupported per Part 61: real
// PackageManager.FEATURE_MICROPHONE check, same native module as headphones.
const microphone: Sense = {
  id: "microphone",
  label: "Microphone",
  shareable: true,
  requiresAction: true,
  isSupported: async () => SonderAudioRoute.hasMicrophone(),
  isGranted: async () => (await getRecordingPermissionsAsync()).granted,
  request: async () => (await requestRecordingPermissionsAsync()).granted,
};

// isSupported per Part 61: expo-calendar's own isAvailableAsync() is the
// real capability check (confirms the Calendar Provider is actually
// present/reachable on this device) — distinct from getCalendarPermissionsAsync,
// which is a permission-status check, not a capability one.
const calendar: Sense = {
  id: "calendar",
  label: "Calendar",
  shareable: false,
  requiresAction: true,
  isSupported: async () => Calendar.isAvailableAsync(),
  isGranted: async () => (await Calendar.getCalendarPermissionsAsync()).status === "granted",
  request: async () => (await Calendar.requestCalendarPermissionsAsync()).status === "granted",
};

// isSupported per Part 61: real check that the device's NotificationManager
// system service is actually obtainable, same native module as headphones/
// microphone (no JS-side Expo API exposes this).
const notifications: Sense = {
  id: "notifications",
  label: "Notifications",
  shareable: false,
  requiresAction: true,
  isSupported: async () => SonderAudioRoute.hasNotificationService(),
  isGranted: async () => (await Notifications.getPermissionsAsync()).status === "granted",
  request: async () => (await Notifications.requestPermissionsAsync()).status === "granted",
};

// Biometric has no Android runtime "permission" the OS gates the way it
// does camera/calendar/notifications/microphone — USE_BIOMETRIC is a
// normal manifest permission granted automatically at install. The real
// grant moment is hardware + enrollment being present, confirmed by
// actually running the system fingerprint/face prompt once
// (authenticateAsync) rather than a standing permission check.
const biometric: Sense = {
  id: "biometric",
  label: "Biometric",
  shareable: false,
  requiresAction: true,
  // Real per-device detection — a device with no fingerprint/face
  // hardware at all shouldn't show this toggle. Enrollment (whether the
  // hardware that exists actually has a fingerprint/face registered) is a
  // separate, changeable state, checked in isGranted instead — not a
  // capability question.
  isSupported: async () => LocalAuthentication.hasHardwareAsync(),
  isGranted: async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  },
  request: async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirm it's you",
    });
    return result.success;
  },
};

export const ALL_SENSES: Sense[] = [
  vision,
  motion,
  headphones,
  microphone,
  calendar,
  notifications,
  biometric,
];

// Senses this specific device actually has — the Permits panel maps over
// this, not ALL_SENSES directly. Async: real per-device capability
// detection (Part 58 item 3), not a hardcoded list.
export async function supportedSenses(): Promise<Sense[]> {
  const supportFlags = await Promise.all(ALL_SENSES.map((s) => s.isSupported()));
  return ALL_SENSES.filter((_, i) => supportFlags[i]);
}

// Part 52's tier-up gating rule, corrected per Part 58 item 2: only the
// four shareable senses this device actually supports must be granted —
// calendar/notifications/biometric never gate a tier-up. Part 58 item 3:
// the "full permission" bar is whatever this device's real shareable-sense
// capability is, not a fixed count (a device with no headphone-detection
// only needs the other three).
export async function allSensesGranted(): Promise<boolean> {
  const supported = (await supportedSenses()).filter((s) => s.shareable);
  if (supported.length === 0) return false;
  const granted = await Promise.all(supported.map((s) => s.isGranted()));
  return granted.every(Boolean);
}
