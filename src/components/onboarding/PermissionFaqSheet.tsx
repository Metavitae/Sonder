import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  FAQ_LEVEL1_DEFAULT,
  FAQ_LEVEL2_OPTIONAL,
  FAQ_TITLE,
} from "../../lib/permissionCopy";

// Neutral-voice modal — UI/settings copy, deliberately never rendered as a
// Sonder bubble (per the plan: the FAQ is kept entirely out of Sonder's own
// voice). Dismissing returns to Level 2 without recording any decision.
export function PermissionFaqSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{FAQ_TITLE}</Text>
          <Text style={styles.label}>Level 1 (default)</Text>
          <Text style={styles.body}>{FAQ_LEVEL1_DEFAULT}</Text>
          <Text style={styles.label}>Level 2 (optional)</Text>
          <Text style={styles.body}>{FAQ_LEVEL2_OPTIONAL}</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#1a1330",
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  title: { color: "#F0E6FF", fontSize: 17, fontWeight: "700" },
  label: { color: "#D4AF7A", fontSize: 12, fontWeight: "700", marginTop: 6, textTransform: "uppercase" },
  body: { color: "#F0E6FF", fontSize: 14, lineHeight: 20 },
  closeButton: {
    marginTop: 12,
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeButtonText: { color: "#000", fontWeight: "700", fontSize: 14 },
});
