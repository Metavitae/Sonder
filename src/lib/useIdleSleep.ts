import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeDreamWake } from "./dreamWakeBus";

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 25", item 6's
// proposed default: "an idle timer during night-time hours — quiet for a
// real stretch (10+ minutes of no interaction) combined with local device
// time being late — rather than either signal alone." Explicitly a default
// to revisit, not a locked spec — same for the night-time window below,
// which Part 25 never pinned to exact hours.
const IDLE_THRESHOLD_MS = 10 * 60 * 1000;
const NIGHT_START_HOUR = 23; // 11pm local
const NIGHT_END_HOUR = 6; // 6am local
const CHECK_INTERVAL_MS = 15_000;

function isNightTime(date: Date): boolean {
  const h = date.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

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
      if (idleFor >= IDLE_THRESHOLD_MS && isNightTime(new Date())) {
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
