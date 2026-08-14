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

// Dev-only verification screen for the Task 2 build in "Sonder - Direct
// Instructions for CC (2026-08-13, Part 19)": proves the cold-start
// character-message mechanism actually fires on a genuine Render cold
// start, against the real deployed /chat endpoint — not a mock. No real
// chat UI exists in the app yet (that's separate, unbuilt product work);
// this exists only to verify the mechanism, same pattern as Part 18's
// dedicated mist test screen before mist was promoted into the real build.
export default function ChatTestScreen() {
  const { messages, isWaiting, coldStartLine, error, send } = useSonderChat();
  const [input, setInput] = useState("");

  const handleSend = () => {
    const text = input;
    setInput("");
    send(text);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
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
            <Text style={styles.bubbleText}>
              {coldStartLine ?? "..."}
            </Text>
            {coldStartLine && <Text style={styles.coldStartTag}>(cold-start line)</Text>}
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
          placeholderTextColor="#888"
          onSubmitEditing={handleSend}
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  bubble: { padding: 12, borderRadius: 12, maxWidth: "85%" },
  userBubble: { backgroundColor: "#3a2c52", alignSelf: "flex-end" },
  sonderBubble: { backgroundColor: "#1a1a1a", alignSelf: "flex-start" },
  bubbleText: { color: "#F0E6FF", fontSize: 15 },
  coldStartTag: { color: "#7CFFB2", fontSize: 11, marginTop: 4 },
  error: { color: "#ff6b6b", padding: 8 },
  inputRow: { flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: "#222" },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1a",
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
