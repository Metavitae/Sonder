import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BirthdateWheelPicker, isBirthdateAdult } from "../../components/onboarding/BirthdateWheelPicker";
import { FogGemPicker, type FogGemOption } from "../../components/onboarding/FogGemPicker";
import { FogLogoSequence } from "../../components/onboarding/FogLogoSequence";
import type { MistColor } from "../../lib/mistAtlas";
import { useOnboarding } from "../../lib/onboardingContext";

// Arbitrary starting point for the wheel picker's initial position — old
// enough that it clears the 18+ gate by default, so a user who never
// touches the wheel isn't blocked by an unpicked date. Not a "default
// birthdate" in any other sense.
const DEFAULT_BIRTHDATE = new Date(2000, 0, 1);

// Registration's email field (Part 52) — local-only per the founder's
// scoping call (2026-08-25): no auth backend exists anywhere in this app,
// so this is a format check, not real verification. Simple presence of an
// "@" and a "." after it, same spirit as the rest of this screen's gating
// (18+ date math, not a real ID check either).
function isValidEmail(email: string): boolean {
  const at = email.indexOf("@");
  if (at <= 0) return false;
  const dot = email.indexOf(".", at + 1);
  return dot > at + 1 && dot < email.length - 1;
}

// Per the founder's direct correction (2026-08-20): these are gender
// pickers, not a 5-color exhibit — Male/Female/Not specified for the user,
// Male/Female for Sonder. Reuses existing mist colors (no new atlas assets
// needed) purely as the visual fill for each option's fog swatch; the
// color itself carries no separate meaning here.
const USER_GENDER_OPTIONS: FogGemOption[] = [
  { color: "blue", label: "Male" },
  { color: "magenta", label: "Female" },
  { color: "violet", label: "Not specified" },
];
const SONDER_GENDER_OPTIONS: FogGemOption[] = [
  { color: "blue", label: "Male" },
  { color: "magenta", label: "Female" },
];

// Registration (Part 52's name for this screen; still Stage 1 underneath) —
// per the founder's direct correction (2026-08-20, supersedes the
// crystal-lid opener): no lid at all. The screen opens straight into the
// Kithe→Sonder fog/logo sequence, whose third fog pulse reveals the real
// fields (email, 18+ gate, two FogGemPickers). Continue is disabled until all
// four answers are in; real navigation to Subscriptions happens only once
// that's true.
export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { state, hydrated, setBirthdate, setUserColor, setSonderColor, setEmail } =
    useOnboarding();
  const [introDone, setIntroDone] = useState(false);
  const handleIntroComplete = useCallback(() => setIntroDone(true), []);

  const birthdateValue = useMemo(
    () => (state.birthdate ? new Date(state.birthdate) : DEFAULT_BIRTHDATE),
    [state.birthdate]
  );
  const [isAdult, setIsAdult] = useState(() => isBirthdateAdult(birthdateValue));

  const handleBirthdateChange = useCallback(
    (date: Date, adult: boolean) => {
      setBirthdate(date.toISOString().slice(0, 10));
      setIsAdult(adult);
    },
    [setBirthdate]
  );

  const emailValid = isValidEmail(state.email ?? "");
  const canContinue =
    isAdult && emailValid && state.userColor !== null && state.sonderColor !== null;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    // Cast: same stale-local-typegen gap noted in index.tsx's chatLink —
    // .expo/types/router.d.ts only regenerates against a live dev server,
    // so a route this new typechecks against a stale union locally even
    // though it resolves fine at runtime. Part 52 (2026-08-25): Subscriptions
    // now comes right after Registration, before the permits/sharing panels.
    router.push("/onboarding/subscriptions" as never);
  }, [canContinue]);

  // Holds off rendering until the persisted state (if any) is loaded, so a
  // resumed mid-flow session doesn't flash the wheel/pickers back to their
  // unset defaults for a frame before jumping to the real values.
  if (!hydrated) return null;

  if (!introDone) {
    return <FogLogoSequence onComplete={handleIntroComplete} />;
  }

  return (
    // Founder correction (2026-08-23): the page itself must not need
    // scrolling — only the birthdate wheel's own internal scroll (that's
    // its normal picker behavior) is acceptable. So this is a fixed,
    // non-scrolling layout sized to fit in one screen; everything below is
    // spacing tight enough to make that true rather than a ScrollView.
    // Continue still sits in its own footer block (not mixed into the
    // middle content) so its position is deterministic and always clear of
    // the phone's nav bar, per Part 45's Bug 2 (verified live 2026-08-23).
    //
    // Real regression found via on-device screenshot (2026-08-20): an
    // earlier non-scrolling attempt used the *same* generous spacing as a
    // scrolling layout and ran taller than the viewport, making Continue
    // unreachable. This version's fix is to actually shrink the spacing
    // (title margins, inter-row gaps) to fit — not to reintroduce scrolling.
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.content}>
        <Text style={styles.title}>What's your email?</Text>
        <TextInput
          style={styles.emailInput}
          value={state.email ?? ""}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="rgba(240,230,255,0.35)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        {state.email !== null && state.email.length > 0 && !emailValid && (
          <Text style={styles.gateText}>That doesn't look like a valid email yet.</Text>
        )}

        <Text style={styles.title}>When were you born?</Text>
        <BirthdateWheelPicker value={birthdateValue} onChange={handleBirthdateChange} />
        {!isAdult && <Text style={styles.gateText}>Sonder is for adults 18 and up.</Text>}

        <Text style={styles.title}>What's your gender?</Text>
        <FogGemPicker
          options={USER_GENDER_OPTIONS}
          selected={state.userColor}
          onSelect={(color: MistColor) => setUserColor(color)}
          idPrefix="user"
        />

        <Text style={styles.title}>What's Sonder's gender?</Text>
        <FogGemPicker
          options={SONDER_GENDER_OPTIONS}
          selected={state.sonderColor}
          onSelect={(color: MistColor) => setSonderColor(color)}
          idPrefix="sonder"
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "space-between" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 24,
  },
  title: { color: "#F0E6FF", fontSize: 17, fontWeight: "600", textAlign: "center" },
  gateText: { color: "#ff8a8a", fontSize: 12, textAlign: "center", marginTop: -6 },
  emailInput: {
    color: "#F0E6FF",
    fontSize: 15,
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(240,230,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    textAlign: "center",
  },
  footer: { alignItems: "center", paddingTop: 8, paddingHorizontal: 24 },
  continueButton: {
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  continueButtonDisabled: { backgroundColor: "rgba(124,255,178,0.3)" },
  continueText: { color: "#000", fontWeight: "700", fontSize: 15 },
});
