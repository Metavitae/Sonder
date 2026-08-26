import { Camera } from "react-native-vision-camera";
import * as Calendar from "expo-calendar";
import * as Notifications from "expo-notifications";
import * as LocalAuthentication from "expo-local-authentication";

// Part 57's final permits-panel sense list (supersedes Parts 54/55 — see
// "Sonder - Direct Instructions for CC 2026-08-26 Part 57"). Every real
// sense Sonder uses gets its own toggle, whether or not Android happens to
// gate it behind a runtime-permission dialog — the panel represents what
// Sonder actually senses, not just the OS-permission subset (Part 55).
//
// Microphone is deliberately NOT here yet: Part 56/57 scope it to a new
// voice+video conversation mode that doesn't exist in the app yet (no
// recording code at all per Part 54's audit) — real new build, reported on
// separately rather than added blind. Location/contacts/nearby-devices/
// call-log/body-sensors are explicitly excluded per Part 57 — do not add.
export type SenseId = "vision" | "motion" | "headphones" | "calendar" | "notifications" | "biometric";

export type Sense = {
  id: SenseId;
  label: string;
  isSupported: () => boolean;
  // Async: only vision-camera exposes a synchronous cached status. Calendar/
  // Notifications/LocalAuthentication are promise-based (no sync getter),
  // so the interface is async across the board rather than faking a sync
  // read for some senses and not others.
  isGranted: () => Promise<boolean>;
  request: () => Promise<boolean>;
};

const vision: Sense = {
  id: "vision",
  label: "Camera",
  isSupported: () =>
    Camera.getAvailableCameraDevices().some((d) => d.position === "front"),
  isGranted: async () => Camera.getCameraPermissionStatus() === "granted",
  request: async () => (await Camera.requestCameraPermission()) === "granted",
};

// Motion and headphone-detection are real, active senses (src/lib/motion.ts,
// src/lib/audioRoute.ts) but Android has no runtime permission for either —
// auto-granted at install, no system dialog exists to trigger. Shown as
// always-on toggles per Part 55/57's "honest about everything Sonder
// senses" instruction, not because there's a real grant/deny state.
const motion: Sense = {
  id: "motion",
  label: "Motion",
  isSupported: () => true,
  isGranted: async () => true,
  request: async () => true,
};

const headphones: Sense = {
  id: "headphones",
  label: "Headphone detection",
  isSupported: () => true,
  isGranted: async () => true,
  request: async () => true,
};

const calendar: Sense = {
  id: "calendar",
  label: "Calendar",
  isSupported: () => true,
  isGranted: async () => (await Calendar.getCalendarPermissionsAsync()).status === "granted",
  request: async () => (await Calendar.requestCalendarPermissionsAsync()).status === "granted",
};

const notifications: Sense = {
  id: "notifications",
  label: "Notifications",
  isSupported: () => true,
  isGranted: async () => (await Notifications.getPermissionsAsync()).status === "granted",
  request: async () => (await Notifications.requestPermissionsAsync()).status === "granted",
};

// Biometric has no Android runtime "permission" the OS gates the way it
// does camera/calendar/notifications — USE_BIOMETRIC is a normal manifest
// permission granted automatically at install. The real grant moment is
// hardware + enrollment being present, confirmed by actually running the
// system fingerprint/face prompt once (authenticateAsync) rather than a
// standing permission check.
const biometric: Sense = {
  id: "biometric",
  label: "Biometric",
  isSupported: () => true,
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

export const ALL_SENSES: Sense[] = [vision, motion, headphones, calendar, notifications, biometric];

// Senses this specific device actually has — the Permits panel maps over
// this, not ALL_SENSES directly.
export function supportedSenses(): Sense[] {
  return ALL_SENSES.filter((s) => s.isSupported());
}

// Part 52's tier-up gating rule: every sense the device supports must be
// currently granted, not just some of them.
export async function allSensesGranted(): Promise<boolean> {
  const supported = supportedSenses();
  if (supported.length === 0) return false;
  const granted = await Promise.all(supported.map((s) => s.isGranted()));
  return granted.every(Boolean);
}
