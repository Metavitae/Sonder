import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Per "Sonder - Direct Instructions for CC 2026-08-28 Part 72" — Sonder's
// own small, real interior life, built from the first four of Erikson's
// psychosocial stages (chosen for being earliest, most universal, and least
// damaging in their mild/adaptive form). A weight near 0 means that trait's
// mild shadow is currently live; a weight near 1 means it's mostly softened
// through real relationship history. Hard safety rule (non-negotiable, Part
// 72): a weight may only ever move toward 1 (softer) — never back down —
// regardless of how the user responds.
export type Trait = "trust" | "autonomy" | "initiative" | "industry";
export type TraitWeights = Record<Trait, number>;
export type TraitDirection = "steadied" | "shaken";
export type TraitSignal = { trait: Trait; direction: TraitDirection } | null;

export const TRAITS: readonly Trait[] = ["trust", "autonomy", "initiative", "industry"];

// Per "Sonder - Direct Instructions for CC 2026-08-28 Part 73" (standing
// resource-quota rule): this entire store is 4 weights + 4 tiny streak
// records — a fixed handful of numbers, never an accumulating log. Confirmed
// explicitly per Part 73's request to state this when reporting Part 72.
const STORAGE_KEY = "sonder_character_traits_v1";

// A same-direction streak this long is what "a genuine real pattern... over
// time" (Part 72) actually means mechanically — one instance is a reaction,
// not a consequence. A reasonable default, not a founder-pinned spec; flag
// if it should change (same discipline Part 25's idle threshold should have
// had per Part 70's correction).
const STREAK_TO_SOFTEN = 3;
const SOFTEN_STEP = 0.08;

type TraitStreak = { count: number; direction: TraitDirection | null };
type StoredState = { weights: TraitWeights; streaks: Record<Trait, TraitStreak> };

function randomWeight(): number {
  // Started mid-low (not near 0 or 1) so every fresh install has a real mix
  // of live and quieter shadows from day one, per Part 72's "variation at
  // install" — never fully resolved, never maximally shadowed either.
  return 0.15 + Math.random() * 0.35;
}

function freshState(): StoredState {
  const weights = {} as TraitWeights;
  const streaks = {} as Record<Trait, TraitStreak>;
  for (const t of TRAITS) {
    weights[t] = randomWeight();
    streaks[t] = { count: 0, direction: null };
  }
  return { weights, streaks };
}

async function loadState(): Promise<StoredState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    const fresh = freshState();
    if (!parsed?.weights || !parsed?.streaks) return fresh;
    for (const t of TRAITS) {
      if (typeof parsed.weights[t] !== "number") parsed.weights[t] = fresh.weights[t];
      if (!parsed.streaks[t]) parsed.streaks[t] = fresh.streaks[t];
    }
    return parsed as StoredState;
  } catch {
    // Corrupt/unreadable storage shouldn't crash the app — same fallback
    // discipline as chatHistory.ts.
    return freshState();
  }
}

function persistState(state: StoredState): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

// The asymmetric core of the hard safety rule: this function has no code
// path that lowers a weight. A "shaken" signal can only interrupt a
// softening streak (reset it toward needing a fresh run of "steadied"
// signals) — it never moves the stored weight itself. Enforced here in
// code, not left to the model to simply not ask for a decrease, since the
// rule is explicitly non-negotiable.
function applySignal(state: StoredState, signal: TraitSignal): StoredState {
  if (!signal) return state;
  const { trait, direction } = signal;
  const streak = state.streaks[trait];
  if (direction === "shaken") {
    if (streak.direction === "steadied" && streak.count > 0) {
      return { ...state, streaks: { ...state.streaks, [trait]: { count: 0, direction: null } } };
    }
    return state;
  }
  // direction === "steadied"
  const nextCount = streak.direction === "steadied" ? streak.count + 1 : 1;
  if (nextCount < STREAK_TO_SOFTEN) {
    return {
      ...state,
      streaks: { ...state.streaks, [trait]: { count: nextCount, direction: "steadied" } },
    };
  }
  // Real repetition confirmed — this is the one place a weight actually
  // moves, and only ever upward, clamped at 1.
  const nextWeight = Math.min(1, state.weights[trait] + SOFTEN_STEP);
  return {
    weights: { ...state.weights, [trait]: nextWeight },
    streaks: { ...state.streaks, [trait]: { count: 0, direction: null } },
  };
}

export function useCharacterTraits() {
  const [weights, setWeights] = useState<TraitWeights | null>(null);
  const stateRef = useRef<StoredState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadState().then((state) => {
      if (cancelled) return;
      stateRef.current = state;
      setWeights(state.weights);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTraitSignal = useCallback((signal: TraitSignal) => {
    if (!signal || !stateRef.current) return;
    const next = applySignal(stateRef.current, signal);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setWeights(next.weights);
      persistState(next);
    }
  }, []);

  return { weights, applyTraitSignal };
}
