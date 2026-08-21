import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  LEVEL1_ASK,
  LEVEL1_BUTTON_NOT_NOW,
  LEVEL1_BUTTON_SURE,
} from "../../lib/permissionCopy";

// Renders as an in-conversation Sonder bubble even though this is Stage 5
// UI — reuses chat.tsx's own bubble visual language (sonderBubble/
// bubbleText) so the ask reads as Sonder speaking, not a system dialog.
export function PermissionLevel1Prompt({
  onSure,
  onNotNow,
}: {
  onSure: () => void;
  onNotNow: () => void;
}) {
  return (
    <View style={styles.bubble}>
      <Text style={styles.bubbleText}>{LEVEL1_ASK}</Text>
      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={onSure}>
          <Text style={styles.buttonText}>{LEVEL1_BUTTON_SURE}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onNotNow}>
          <Text style={[styles.buttonText, styles.buttonSecondaryText]}>
            {LEVEL1_BUTTON_NOT_NOW}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches chat.tsx's sonderBubble/bubbleText exactly (same visual
  // language, same alignSelf), plus a button row this specific bubble
  // needs that chat.tsx's own bubbles don't.
  bubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: "85%",
    backgroundColor: "rgba(0,0,0,0.45)",
    alignSelf: "flex-start",
    gap: 12,
  },
  bubbleText: { color: "#FFFFFF", fontSize: 15 },
  buttonRow: { flexDirection: "row", gap: 8 },
  button: {
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonSecondary: { backgroundColor: "rgba(255,255,255,0.12)" },
  buttonText: { color: "#000", fontWeight: "700", fontSize: 14 },
  buttonSecondaryText: { color: "#F0E6FF" },
});
