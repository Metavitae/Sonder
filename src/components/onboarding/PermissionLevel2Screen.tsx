import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  LEVEL2_ASK,
  LEVEL2_BUTTON_NO_THANKS,
  LEVEL2_BUTTON_SEE_WHAT_THIS_MEANS,
  LEVEL2_BUTTON_SHARE,
} from "../../lib/permissionCopy";
import { PermissionFaqSheet } from "./PermissionFaqSheet";

// Distinct screen presentation from Level 1 (plan: "never blended into a
// Level 1 moment") — rendered as a plain screen section, not a chat bubble.
//
// Known open content gap (plan, not blocking): the specific capability-
// toggle list for what gets shared isn't enumerated anywhere in the locked
// copy — "you choose what to share" is the only description on record.
// This builds the ask/FAQ/tier mechanism for real; the toggle list itself
// needs the founder's actual content before it's complete.
export function PermissionLevel2Screen({
  onShare,
  onNoThanks,
}: {
  onShare: () => void;
  onNoThanks: () => void;
}) {
  const [faqVisible, setFaqVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.ask}>{LEVEL2_ASK}</Text>
      <View style={styles.buttonColumn}>
        <Pressable style={styles.linkButton} onPress={() => setFaqVisible(true)}>
          <Text style={styles.linkButtonText}>{LEVEL2_BUTTON_SEE_WHAT_THIS_MEANS}</Text>
        </Pressable>
        <Pressable style={styles.shareButton} onPress={onShare}>
          <Text style={styles.shareButtonText}>{LEVEL2_BUTTON_SHARE}</Text>
        </Pressable>
        <Pressable style={styles.declineButton} onPress={onNoThanks}>
          <Text style={styles.declineButtonText}>{LEVEL2_BUTTON_NO_THANKS}</Text>
        </Pressable>
      </View>
      <PermissionFaqSheet visible={faqVisible} onClose={() => setFaqVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 20, paddingHorizontal: 24 },
  ask: { color: "#F0E6FF", fontSize: 18, fontWeight: "600", textAlign: "center", lineHeight: 26 },
  buttonColumn: { width: "100%", gap: 12, alignItems: "center" },
  linkButton: { paddingVertical: 8 },
  linkButtonText: { color: "#D4AF7A", fontSize: 14, textDecorationLine: "underline" },
  shareButton: {
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  shareButtonText: { color: "#000", fontWeight: "700", fontSize: 15 },
  declineButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  declineButtonText: { color: "#F0E6FF", fontSize: 15 },
});
