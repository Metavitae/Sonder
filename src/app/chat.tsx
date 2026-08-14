import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSonderChat } from "../lib/useSonderChat";
import { moodToMist } from "../lib/moodToMist";
import { SpriteMistPoC } from "../components/SpriteMistPoC";

// The real chat surface, per "Sonder - Direct Instructions for CC
// 2026-08-14 Part 21" Step 2 — supersedes chat-test.tsx (Part 19's dev-only
// verification screen, now removed). Differences from that screen: the
// mist renders here as a live backdrop (not a bare black screen), its
// color/pulse driven by the mood tag Sonder's own reply carries — see
// moodToMist.ts for how warmth/arousal map onto the mist's existing
// 5-color palette — and conversation history is sent with every turn
// (useSonderChat.ts) instead of each message being stateless.
//
// No camera here — that's index.tsx's separate concern (the needs-boundary
// face-tracking PoC). This screen never requests camera permission.
export default function ChatScreen() {
  const { messages, isWaiting, coldStartLine, error, mood, send } = useSonderChat();
  const [input, setInput] = useState("");
  const { color, intensity } = moodToMist(mood);

  const handleSend = () => {
    const text = input;
    setInput("");
    send(text);
  };

  return (
    <View style={styles.container}>
      <SpriteMistPoC color={color} intensity={intensity} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.sonderBubble]}
            >
              <Text style={styles.bubbleText}>{m.text}</Text>
            </View>
          ))}
          {isWaiting && (
            <View style={[styles.bubble, styles.sonderBubble]}>
              <Text style={styles.bubbleText}>{coldStartLine ?? "..."}</Text>
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Say something to Sonder..."
            placeholderTextColor="#c9c9c9"
            onSubmitEditing={handleSend}
          />
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  bubble: { padding: 12, borderRadius: 12, maxWidth: "85%" },
  userBubble: { backgroundColor: "rgba(58,44,82,0.75)", alignSelf: "flex-end" },
  sonderBubble: { backgroundColor: "rgba(0,0,0,0.45)", alignSelf: "flex-start" },
  bubbleText: { color: "#FFFFFF", fontSize: 15 },
  error: { color: "#ff8a8a", padding: 8 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: "#7CFFB2",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendText: { color: "#000", fontWeight: "700" },
});
