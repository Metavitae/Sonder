import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FAQ_QA, FAQ_TITLE } from "../../lib/permissionCopy";

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
          <ScrollView style={styles.qaScroll}>
            {FAQ_QA.map(({ q, a }) => (
              <View key={q} style={styles.qaRow}>
                <Text style={styles.label}>{q}</Text>
                <Text style={styles.body}>{a}</Text>
              </View>
            ))}
          </ScrollView>
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
    maxHeight: "80%",
  },
  title: { color: "#F0E6FF", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  qaScroll: { flexGrow: 0 },
  qaRow: { marginTop: 10 },
  label: { color: "#D4AF7A", fontSize: 14, fontWeight: "700" },
  body: { color: "#F0E6FF", fontSize: 14, lineHeight: 20, marginTop: 2 },
  closeButton: {
    marginTop: 12,
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeButtonText: { color: "#000", fontWeight: "700", fontSize: 14 },
});
