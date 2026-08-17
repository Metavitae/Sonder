import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 22/25", items 2
// and 9 — two independent product concerns (a triggered gag vs. an ongoing
// presence signal) that both read the same raw accelerometer stream.
// Accelerometer magnitude is reported in g (1.0 == device at rest under
// normal gravity, regardless of orientation).
const SAMPLE_INTERVAL_MS = 100;

export type Presence = "held" | "set-down" | "unknown";

// Item 2 — falling/kryptonite gag. A device in true freefall reads ~0g on
// every axis (gravity is accelerating it at the same rate as the sensor
// package, so nothing is "felt") — the real physical signature of being
// dropped, distinct from just being moved or set down quickly. Requires a
// short streak of consecutive low readings so one noisy sample near a hard
// knock or bump doesn't false-trigger.
const FREEFALL_G_THRESHOLD = 0.3;
const FREEFALL_SUSTAIN_SAMPLES = 2;

export function useFreefallDetector(onFreefall: () => void) {
  const streakRef = useRef(0);
  const firedRef = useRef(false);
  const onFreefallRef = useRef(onFreefall);
  onFreefallRef.current = onFreefall;

  useEffect(() => {
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude < FREEFALL_G_THRESHOLD) {
        streakRef.current += 1;
        if (streakRef.current >= FREEFALL_SUSTAIN_SAMPLES && !firedRef.current) {
          firedRef.current = true;
          onFreefallRef.current();
        }
      } else {
        streakRef.current = 0;
        firedRef.current = false;
      }
    });
    return () => sub.remove();
  }, []);
}

// Item 9 — held vs. set-down. A phone resting on a table reads a rock-
// steady ~1g with only sensor noise; a held phone picks up the small,
// continuous micro-motion of a hand even when the person isn't consciously
// moving it (pulse, breathing, minor tremor). Variance of the magnitude
// over a rolling window is a cheap, real proxy for that difference —
// distinct from the freefall gag above, which looks for a magnitude drop,
// not variance.
const PRESENCE_WINDOW_SAMPLES = 20; // ~2s at SAMPLE_INTERVAL_MS
const PRESENCE_MIN_SAMPLES = 10; // don't classify until the window has settled
const HELD_VARIANCE_THRESHOLD = 0.0008;

export function usePresence(): Presence {
  const [presence, setPresence] = useState<Presence>("unknown");
  const windowRef = useRef<number[]>([]);

  useEffect(() => {
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const win = windowRef.current;
      win.push(magnitude);
      if (win.length > PRESENCE_WINDOW_SAMPLES) win.shift();
      if (win.length < PRESENCE_MIN_SAMPLES) return;
      const mean = win.reduce((a, b) => a + b, 0) / win.length;
      const variance = win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length;
      const next = variance > HELD_VARIANCE_THRESHOLD ? "held" : "set-down";
      setPresence(next);
    });
    return () => sub.remove();
  }, []);

  return presence;
}
