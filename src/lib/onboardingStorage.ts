import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MistColor } from "./mistAtlas";

// Mirrors chatHistory.ts's conventions exactly (versioned key, sonder_
// prefix, parse+validate+fallback on read, silent-catch on write) per the
// onboarding rebuild plan.
const STORAGE_KEY = "sonder_onboarding_v1";

export type OnboardingState = {
  complete: boolean;
  birthdate: string | null; // ISO date, e.g. "1994-03-12"
  userColor: MistColor | null;
  sonderColor: MistColor | null;
  level1Decision: "shared" | "declined" | null;
  level2Decision: "shared" | "declined" | null;
  tier: number;
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  complete: false,
  birthdate: null,
  userColor: null,
  sonderColor: null,
  level1Decision: null,
  level2Decision: null,
  tier: 0,
};

const VALID_COLORS: MistColor[] = ["violet", "magenta", "cyan", "amber", "blue"];
const VALID_DECISIONS = ["shared", "declined"] as const;

function isValidColor(v: unknown): v is MistColor | null {
  return v === null || VALID_COLORS.includes(v as MistColor);
}

function isValidDecision(v: unknown): v is "shared" | "declined" | null {
  return v === null || VALID_DECISIONS.includes(v as "shared" | "declined");
}

function isValidState(v: unknown): v is OnboardingState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.complete === "boolean" &&
    (s.birthdate === null || typeof s.birthdate === "string") &&
    isValidColor(s.userColor) &&
    isValidColor(s.sonderColor) &&
    isValidDecision(s.level1Decision) &&
    isValidDecision(s.level2Decision) &&
    typeof s.tier === "number"
  );
}

export async function loadOnboardingState(): Promise<OnboardingState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING_STATE;
    const parsed = JSON.parse(raw);
    return isValidState(parsed) ? parsed : DEFAULT_ONBOARDING_STATE;
  } catch {
    // Corrupt/unreadable storage shouldn't crash the app — worst case, this
    // launch re-enters onboarding from the start, same as a fresh install.
    return DEFAULT_ONBOARDING_STATE;
  }
}

export function persistOnboardingState(state: OnboardingState): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}
