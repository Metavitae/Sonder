import { createContext, useContext } from "react";

// Bridges onboarding completion (fired deep in the onboarding screen tree,
// in intro.tsx) to the root layout's Stack.Protected guard, which owns
// navigation between the onboarding group and the real app.
//
// Real bug found live (2026-08-24): the root gate's onboardingComplete is
// local state read once from storage at launch. Calling markComplete() +
// router.replace("/chat") from intro.tsx flipped AsyncStorage but never
// touched that state, so Stack.Protected still excluded "chat" from the
// navigator and the replace landed nowhere (blank screen, confirmed
// on-device). This context lets intro.tsx flip the guard's actual state
// live instead of just persisting to storage.
export const OnboardingGateContext = createContext<() => void>(() => {});

export function useCompleteOnboardingGate() {
  return useContext(OnboardingGateContext);
}

// The reverse, for testing (founder, 2026-09-30: watch the whole opening —
// Kithe's logo, Sonder's, then onboarding — without a reinstall wiping the
// diary). replay-onboarding.tsx marks onboarding incomplete in storage,
// then this flips the root guard back so the onboarding group returns.
export const OnboardingReopenContext = createContext<() => void>(() => {});

export function useReopenOnboardingGate() {
  return useContext(OnboardingReopenContext);
}
