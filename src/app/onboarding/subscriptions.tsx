import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnboarding } from "../../lib/onboardingContext";
import type { SubscriptionTier } from "../../lib/onboardingStorage";

// Part 52 (2026-08-25): the real Free/Plus/Premium schema. Pricing is
// explicitly not decided (Part 33 item 4, still pending) — shown as "TBD",
// never invented numbers.
const TIERS: { id: SubscriptionTier; name: string; description: string; price: string | null }[] = [
  {
    id: "free",
    name: "Free",
    description: "Full companionship — Sonder's core function, unrestricted at every tier.",
    price: null,
  },
  {
    id: "plus",
    name: "Plus",
    description: "Everything in Free, plus priority queue and faster responses during high load.",
    price: "TBD",
  },
  {
    id: "premium",
    name: "Premium",
    description: "Everything in Plus, plus partner discounts and early access to new features.",
    price: "TBD",
  },
];

// Subscriptions — new Part 52 screen, second in the Registration →
// Subscriptions → Permits → (Sharing) → Intro sequence. Persists
// subscriptionTier, a real Free/Plus/Premium pick — deliberately a
// different field than the onboardingStorage `tier` reward counter, which
// belongs to the separate (and currently feature-flagged-off) sharing/
// tier-up mechanic.
export default function SubscriptionsScreen() {
  const insets = useSafeAreaInsets();
  const { state, hydrated, setSubscriptionTier } = useOnboarding();

  const canContinue = state.subscriptionTier !== null;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    // Cast: same stale-local-typegen gap as setup.tsx's Continue.
    router.push("/onboarding/permits" as never);
  }, [canContinue]);

  if (!hydrated) return null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.content}>
        <Text style={styles.heading}>Choose your plan</Text>
        {TIERS.map((tier) => {
          const selected = state.subscriptionTier === tier.id;
          return (
            <Pressable
              key={tier.id}
              onPress={() => setSubscriptionTier(tier.id)}
              style={[styles.card, selected && styles.cardSelected]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{tier.name}</Text>
                <Text style={styles.cardPrice}>{tier.price ?? "Free"}</Text>
              </View>
              <Text style={styles.cardDescription}>{tier.description}</Text>
            </Pressable>
          );
        })}
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
  content: { paddingHorizontal: 24, gap: 14 },
  heading: {
    color: "#F0E6FF",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(240,230,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
  },
  cardSelected: {
    borderColor: "#7CFFB2",
    backgroundColor: "rgba(124,255,178,0.1)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: { color: "#F0E6FF", fontSize: 17, fontWeight: "700" },
  cardPrice: { color: "#D4AF7A", fontSize: 13, fontWeight: "600" },
  cardDescription: { color: "rgba(240,230,255,0.75)", fontSize: 14, lineHeight: 19, marginTop: 6 },
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
