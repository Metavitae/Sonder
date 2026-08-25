import { Camera } from "react-native-vision-camera";

// Part 52's Permits panel needs "only the senses the specific device
// actually supports" — checked against real device capability, not a fixed
// universal list. Deliberately just one entry today (the app only ever
// senses through the front camera, index.tsx:312) — add to this list, not
// around it, if a second sense (e.g. voice) becomes real.
export type SenseId = "vision";

export type Sense = {
  id: SenseId;
  label: string;
  isSupported: () => boolean;
  isGranted: () => boolean;
  request: () => Promise<boolean>;
};

const vision: Sense = {
  id: "vision",
  label: "Camera",
  isSupported: () =>
    Camera.getAvailableCameraDevices().some((d) => d.position === "front"),
  isGranted: () => Camera.getCameraPermissionStatus() === "granted",
  request: async () => (await Camera.requestCameraPermission()) === "granted",
};

export const ALL_SENSES: Sense[] = [vision];

// Senses this specific device actually has — the Permits panel maps over
// this, not ALL_SENSES directly.
export function supportedSenses(): Sense[] {
  return ALL_SENSES.filter((s) => s.isSupported());
}

// Part 52's tier-up gating rule: every sense the device supports must be
// currently granted, not just some of them.
export async function allSensesGranted(): Promise<boolean> {
  const supported = supportedSenses();
  return supported.length > 0 && supported.every((s) => s.isGranted());
}
