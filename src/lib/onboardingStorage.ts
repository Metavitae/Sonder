import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MistColor } from "./mistAtlas";

// Mirrors chatHistory.ts's conventions exactly (versioned key, sonder_
// prefix, parse+validate+fallback on read, silent-catch on write) per the
// onboarding rebuild plan.
const STORAGE_KEY = "sonder_onboarding_v1";

export type SubscriptionTier = "free" | "plus" | "premium";

export type OnboardingState = {
  complete: boolean;
  birthdate: string | null; // ISO date, e.g. "1994-03-12"
  userColor: MistColor | null;
  sonderColor: MistColor | null;
  // Registration's email field (Part 52) — local-only, no auth backend
  // exists yet, so this is captured/validated but never sent anywhere.
  email: string | null;
  // Subscriptions screen's real Free/Plus/Premium pick (Part 52). Deliberately
  // a separate field from `tier` below — that's an unrelated reward counter,
  // not this plan selection (see the 2026-08-25 CC Log note on the two
  // concepts colliding if merged).
  subscriptionTier: SubscriptionTier | null;
  // Permits panel decision (formerly "Level 1").
  level1Decision: "shared" | "declined" | null;
  // Sharing panel decision (formerly "Level 2"). Path is feature-flagged
  // off for now — see src/lib/featureFlags.ts.
  level2Decision: "shared" | "declined" | null;
  tier: number;
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  complete: false,
  birthdate: null,
  userColor: null,
  sonderColor: null,
  email: null,
  subscriptionTier: null,
  level1Decision: null,
  level2Decision: null,
  tier: 0,
};

const VALID_COLORS: MistColor[] = ["violet", "magenta", "cyan", "amber", "blue"];
const VALID_DECISIONS = ["shared", "declined"] as const;
const VALID_SUBSCRIPTION_TIERS: SubscriptionTier[] = ["free", "plus", "premium"];

function isValidColor(v: unknown): v is MistColor | null {
  return v === null || VALID_COLORS.includes(v as MistColor);
}

function isValidDecision(v: unknown): v is "shared" | "declined" | null {
  return v === null || VALID_DECISIONS.includes(v as "shared" | "declined");
}

function isValidSubscriptionTier(v: unknown): v is SubscriptionTier | null {
  return v === null || VALID_SUBSCRIPTION_TIERS.includes(v as SubscriptionTier);
}

function isValidState(v: unknown): v is OnboardingState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.complete === "boolean" &&
    (s.birthdate === null || typeof s.birthdate === "string") &&
    isValidColor(s.userColor) &&
    isValidColor(s.sonderColor) &&
    (s.email === null || typeof s.email === "string") &&
    isValidSubscriptionTier(s.subscriptionTier) &&
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
