import { createContext, useContext } from "react";

// Lets the Kithe → Sonder logo opening hide onboarding's screen-wide mist
// while the logos show their own, then bring it back once they're done.
// Visible by default, so a resumed session that skips the opening still has
// its mist.
export const OnboardingMistContext = createContext<(visible: boolean) => void>(() => {});

export function useSetOnboardingMistVisible() {
  return useContext(OnboardingMistContext);
}
