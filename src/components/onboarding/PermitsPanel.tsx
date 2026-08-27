import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PERMITS_EXPLANATION, DECLINE_RESPONSE } from "../../lib/permissionCopy";
import { supportedSenses, type Sense } from "../../lib/senses";

type SenseResult = "granted" | "denied";

// Part 52's Permits panel: ONE panel, one row per sense the device
// actually supports (src/lib/senses.ts, dynamically detected per Part 58
// item 3 — not a hardcoded list), with ONE shared explanation covering all
// of them together (not per-sense text, per Part 45 Addendum's "do not
// write individual per-sense explanations" rule, which Part 52 carries
// forward). Part 60 item 1: the old LEVEL1_ASK opening line was cut here —
// it duplicated PERMITS_EXPLANATION (both said "I can be closer to you"),
// written originally for a different, one-on-one in-chat context. The
// constant itself is untouched in permissionCopy.ts in case that original
// context ever needs it — only this panel's render stopped using it.
export function PermitsPanel({ onDone }: { onDone: (anyGranted: boolean) => void }) {
  const [senses, setSenses] = useState<Sense[] | null>(null);
  const [results, setResults] = useState<Record<string, SenseResult>>({});

  useEffect(() => {
    let cancelled = false;
    supportedSenses().then(async (s) => {
      if (cancelled) return;
      setSenses(s);
      // Reflect already-granted state on load — matters for motion/
      // headphones (Part 55: "defaulted on/active") and equally for
      // camera/calendar/notifications/biometric on a reinstall where the
      // permission was already granted previously.
      const already = await Promise.all(s.map((sense) => sense.isGranted()));
      if (cancelled) return;
      setResults((prev) => {
        const next = { ...prev };
        s.forEach((sense, i) => {
          if (already[i]) next[sense.id] = "granted";
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRequest = useCallback(async (sense: Sense) => {
    const granted = await sense.request();
    setResults((prev) => ({ ...prev, [sense.id]: granted ? "granted" : "denied" }));
  }, []);

  const handleContinue = useCallback(async () => {
    if (!senses) return;
    const already = await Promise.all(
      senses.map(async (s) => results[s.id] === "granted" || (await s.isGranted()))
    );
    onDone(already.some(Boolean));
  }, [senses, results, onDone]);

  if (!senses) return null;

  return (
    <View style={styles.bubble}>
      <Text style={styles.explanation}>{PERMITS_EXPLANATION}</Text>

      <View style={styles.senseList}>
        {senses.map((sense) => {
          const result = results[sense.id];

          // Part 60 item 2: motion/headphone-detection never trigger a
          // real system dialog (Android auto-grants them, no popup
          // exists) — styling them identically to a real "Allow" button
          // misleadingly implies an equivalent ask. Rendered as plain
          // informational status instead: no Pressable, no button chrome.
          if (!sense.requiresAction) {
            return (
              <View key={sense.id} style={styles.statusRow}>
                <Text style={styles.statusText}>{sense.label} — always on</Text>
              </View>
            );
          }

          return (
            <View key={sense.id} style={styles.senseRow}>
              <Pressable
                style={[styles.senseButton, result === "granted" && styles.senseButtonGranted]}
                onPress={() => handleRequest(sense)}
                disabled={result === "granted"}
              >
                <Text style={styles.senseButtonText}>
                  {result === "granted" ? `${sense.label} allowed` : `Allow ${sense.label}`}
                </Text>
              </Pressable>
              {result === "denied" && <Text style={styles.declineText}>{DECLINE_RESPONSE}</Text>}
            </View>
          );
        })}
      </View>

      <Pressable style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

// Gold accent shared with FogGemSwatch's museum-placard borders/labels —
// reused here so the permits panel reads as the same fog-themed onboarding
// object language, not a generic UI component. These are translucent
// frosted panels rather than flat fills so the ambient violet mist mounted
// behind every onboarding screen (onboarding/_layout.tsx's SpriteMistPoC)
// shows through, instead of a solid button sitting on top of it.
const GOLD = "#D4AF7A";

const styles = StyleSheet.create({
  bubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: "90%",
    backgroundColor: "rgba(0,0,0,0.45)",
    alignSelf: "flex-start",
    gap: 12,
  },
  explanation: { color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 18 },
  senseList: { gap: 8 },
  senseRow: { gap: 4 },
  senseButton: {
    backgroundColor: "rgba(212,175,122,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,122,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  senseButtonGranted: {
    backgroundColor: "rgba(212,175,122,0.28)",
    borderColor: GOLD,
  },
  senseButtonText: { color: GOLD, fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
  declineText: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  statusRow: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,122,0.25)",
  },
  statusText: { color: "rgba(212,175,122,0.7)", fontSize: 13, fontStyle: "italic" },
  continueButton: {
    backgroundColor: "rgba(212,175,122,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,122,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  continueButtonText: { color: GOLD, fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
});
