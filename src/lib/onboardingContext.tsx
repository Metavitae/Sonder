import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { MistColor } from "./mistAtlas";
import {
  DEFAULT_ONBOARDING_STATE,
  loadOnboardingState,
  persistOnboardingState,
  type OnboardingState,
} from "./onboardingStorage";

type OnboardingContextValue = {
  state: OnboardingState;
  // false until the initial AsyncStorage read resolves — lets callers hold
  // off rendering picker defaults that would otherwise flash briefly before
  // a resumed mid-flow value replaces them (plan §State flow: an app kill
  // between Stage 1 and Stage 5 must resume, not restart).
  hydrated: boolean;
  setBirthdate: (birthdateIso: string) => void;
  setUserColor: (color: MistColor) => void;
  setSonderColor: (color: MistColor) => void;
  setLevel1Decision: (decision: "shared" | "declined") => void;
  setLevel2Decision: (decision: "shared" | "declined") => void;
  // Level 2 "Share" is a real state change (plan §Confirmed answers), not
  // cosmetic — sets level2Decision and increments tier atomically so a
  // promote call can never race a separately-dispatched decision update.
  promoteTier: () => void;
  markComplete: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// Mounted once in src/app/onboarding/_layout.tsx, wraps setup/permissions/
// intro — never global (chat.tsx/index.tsx have no onboarding state and
// don't need this provider).
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    loadOnboardingState().then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fire-and-forget persist on every change, same idiom as chatHistory.ts's
  // persistMessages. Gated on hydrated so the initial default state can't
  // briefly overwrite whatever's already on disk before the load resolves.
  useEffect(() => {
    if (!hydrated) return;
    persistOnboardingState(state);
  }, [state, hydrated]);

  const setBirthdate = useCallback(
    (birthdateIso: string) => setState((prev) => ({ ...prev, birthdate: birthdateIso })),
    []
  );
  const setUserColor = useCallback(
    (color: MistColor) => setState((prev) => ({ ...prev, userColor: color })),
    []
  );
  const setSonderColor = useCallback(
    (color: MistColor) => setState((prev) => ({ ...prev, sonderColor: color })),
    []
  );
  const setLevel1Decision = useCallback(
    (decision: "shared" | "declined") =>
      setState((prev) => ({ ...prev, level1Decision: decision })),
    []
  );
  const setLevel2Decision = useCallback(
    (decision: "shared" | "declined") =>
      setState((prev) => ({ ...prev, level2Decision: decision })),
    []
  );
  const promoteTier = useCallback(() => {
    setState((prev) => ({ ...prev, level2Decision: "shared", tier: prev.tier + 1 }));
  }, []);
  // Writes to storage directly, not via the reactive persist effect above.
  // Real bug found live (2026-08-24): intro.tsx calls markComplete() then
  // immediately completeOnboardingGate() in the same handler, which flips
  // the root layout's guard and unmounts OnboardingProvider in that same
  // commit — before the persist effect ever got to run for the
  // complete:true update. AsyncStorage never saw it (confirmed by reading
  // the on-device database after a full walkthrough: complete stayed
  // false despite chat.tsx rendering correctly). Firing the write here
  // means it's in flight before anything can unmount.
  const markComplete = useCallback(() => {
    const next = { ...stateRef.current, complete: true };
    persistOnboardingState(next);
    setState(next);
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      hydrated,
      setBirthdate,
      setUserColor,
      setSonderColor,
      setLevel1Decision,
      setLevel2Decision,
      promoteTier,
      markComplete,
    }),
    [
      state,
      hydrated,
      setBirthdate,
      setUserColor,
      setSonderColor,
      setLevel1Decision,
      setLevel2Decision,
      promoteTier,
      markComplete,
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
