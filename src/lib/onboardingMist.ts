import { createContext, useContext } from "react";

// Lets the Kithe → Sonder logo opening hide onboarding's screen-wide mist
// while the logos show their own, then bring it back once they're done.
// Visible by default, so a resumed session that skips the opening still has
// its mist.
// `fade`: hide gently instead of at once (the hand-off to the diary).
export const OnboardingMistContext = createContext<(visible: boolean, fade?: boolean) => void>(() => {});

export function useSetOnboardingMistVisible() {
  return useContext(OnboardingMistContext);
}
