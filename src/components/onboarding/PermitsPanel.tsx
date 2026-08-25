import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LEVEL1_ASK, PERMITS_EXPLANATION, DECLINE_RESPONSE } from "../../lib/permissionCopy";
import { supportedSenses, type Sense } from "../../lib/senses";

type SenseResult = "granted" | "denied";

// Part 52's Permits panel: ONE panel, one button per sense the device
// actually supports (src/lib/senses.ts — just Camera today), with ONE
// shared explanation covering all of them together (not per-sense text,
// per Part 45 Addendum's "do not write individual per-sense explanations"
// rule, which Part 52 carries forward). Renders as a Sonder bubble, same
// visual language as the old single-ask Level 1 prompt this replaces.
export function PermitsPanel({ onDone }: { onDone: (anyGranted: boolean) => void }) {
  const [senses] = useState<Sense[]>(() => supportedSenses());
  const [results, setResults] = useState<Record<string, SenseResult>>({});

  const handleRequest = useCallback(async (sense: Sense) => {
    const granted = await sense.request();
    setResults((prev) => ({ ...prev, [sense.id]: granted ? "granted" : "denied" }));
  }, []);

  const handleContinue = useCallback(() => {
    const anyGranted = senses.some((s) => results[s.id] === "granted" || s.isGranted());
    onDone(anyGranted);
  }, [senses, results, onDone]);

  return (
    <View style={styles.bubble}>
      <Text style={styles.bubbleText}>{LEVEL1_ASK}</Text>
      <Text style={styles.explanation}>{PERMITS_EXPLANATION}</Text>

      <View style={styles.senseList}>
        {senses.map((sense) => {
          const result = results[sense.id];
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

const styles = StyleSheet.create({
  bubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: "90%",
    backgroundColor: "rgba(0,0,0,0.45)",
    alignSelf: "flex-start",
    gap: 12,
  },
  bubbleText: { color: "#FFFFFF", fontSize: 15 },
  explanation: { color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 18 },
  senseList: { gap: 8 },
  senseRow: { gap: 4 },
  senseButton: {
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  senseButtonGranted: { backgroundColor: "rgba(124,255,178,0.35)" },
  senseButtonText: { color: "#000", fontWeight: "700", fontSize: 14 },
  declineText: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  continueButton: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  continueButtonText: { color: "#F0E6FF", fontWeight: "700", fontSize: 14 },
});
