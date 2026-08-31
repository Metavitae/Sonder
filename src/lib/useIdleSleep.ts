import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeDreamWake } from "./dreamWakeBus";

// Per "Sonder - Direct Instructions for CC 2026-08-28 Part 70": the
// night-hours gate (11pm-6am local) was never a real founder decision, just
// an unflagged default from Part 25 — removed. Idle time alone (10+ minutes)
// is the only condition now; Sonder can't know if someone works nights,
// lives in a different time zone, or just wants a quiet afternoon moment.
// TEMP DIAGNOSTIC (Part 75 dream-overlay bug, forced-screen-on retest):
// shortened from 10 minutes to 1 to make the screen-off-timeout theory
// fast to confirm/rule out. Revert before merging.
const IDLE_THRESHOLD_MS = 1 * 60 * 1000;
const CHECK_INTERVAL_MS = 15_000;

export function useIdleSleep() {
  const [isDreaming, setIsDreaming] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const wasDreamingRef = useRef(false);

  // Exposed so the caller can tell a genuine wake (was dreaming) apart from
  // ordinary activity that never let it get that far.
  const [justWoke, setJustWoke] = useState(false);

  const noteActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (wasDreamingRef.current) {
      wasDreamingRef.current = false;
      setJustWoke(true);
    }
    setIsDreaming(false);
  }, []);

  const clearJustWoke = useCallback(() => setJustWoke(false), []);

  useEffect(() => {
    const id = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_THRESHOLD_MS) {
        wasDreamingRef.current = true;
        setIsDreaming(true);
      }
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Part 63: a real jolt (FreefallStartle, mounted globally) should wake
  // Sonder from dreaming, same as noteActivity does for ordinary user
  // interaction — reuses that exact wake path rather than a second one.
  useEffect(() => subscribeDreamWake(noteActivity), [noteActivity]);

  return { isDreaming, justWoke, noteActivity, clearJustWoke };
}
