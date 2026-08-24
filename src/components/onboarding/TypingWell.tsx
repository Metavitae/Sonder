import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { useSonderChat } from "../../lib/useSonderChat";

const DISSOLVE_MS = 900;
const MAX_STAGGER_MS = 700;
const REPLY_HOLD_MS = 1400;

// One word, independently randomized fade-to-zero — plan §Component notes:
// "each in its own Animated.Text with independently randomized
// withDelay-staggered fade-to-zero opacity, in place, no relocation."
function DissolvingWord({ word, dissolve }: { word: string; dissolve: boolean }) {
  const opacity = useSharedValue(1);
  const delay = useMemo(() => Math.random() * MAX_STAGGER_MS, []);

  useEffect(() => {
    if (dissolve) {
      opacity.value = withDelay(delay, withTiming(0, { duration: DISSOLVE_MS }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dissolve]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.Text style={[styles.word, style]}>{word} </Animated.Text>;
}

function DissolvingLine({
  text,
  dissolve,
  style,
}: {
  text: string;
  dissolve: boolean;
  style?: object;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <View style={[styles.line, style]}>
      {words.map((w, i) => (
        <DissolvingWord key={`${i}-${w}`} word={w} dissolve={dissolve} />
      ))}
    </View>
  );
}

// Sonder's real first-run turn — not a scripted line. Reuses useSonderChat
// exactly as chat.tsx does (same send/persist/crisis-tripwire pipeline), so
// this exchange is already in chatHistory.ts by the time router.replace
// hands off to /chat — a hard hand-off, chat.tsx's own component tree is
// never touched (plan §Component notes).
export function TypingWell({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { messages, isWaiting, error, send } = useSonderChat();
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"input" | "waiting" | "reply" | "dissolving">("input");
  const sentIndexRef = useRef(0);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sentIndexRef.current = messages.length;
    setInput("");
    setPhase("waiting");
    send(text);
  };

  // Sonder's reply lands as messages[sentIndexRef.current + 1] once the
  // request resolves — same shape useSonderChat always produces (user turn
  // pushed immediately, sonder turn appended on response).
  useEffect(() => {
    if (phase !== "waiting" || isWaiting) return;
    if (messages.length > sentIndexRef.current + 1) {
      setPhase("reply");
    }
  }, [phase, isWaiting, messages]);

  // Real bug found live (2026-08-23): this hold timer used to live inside
  // the effect above, keyed on the same `phase` it also set. Setting
  // setPhase("reply") re-runs that effect on the next render (phase is a
  // dependency), and React cleans up the *previous* effect instance first —
  // clearing the just-armed timer before it could ever fire. Screen got
  // stuck showing the reply forever, never reaching /chat. Splitting the
  // hold timer into its own effect, keyed only on `phase`, means it's set
  // once on the transition into "reply" and nothing re-triggers that same
  // effect's cleanup before REPLY_HOLD_MS elapses.
  useEffect(() => {
    if (phase !== "reply") return;
    const holdTimer = setTimeout(() => setPhase("dissolving"), REPLY_HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "dissolving") return;
    const doneTimer = setTimeout(onDone, MAX_STAGGER_MS + DISSOLVE_MS);
    return () => clearTimeout(doneTimer);
  }, [phase, onDone]);

  const userText = messages[sentIndexRef.current]?.text ?? "";
  const replyText = messages[sentIndexRef.current + 1]?.text ?? "";

  if (phase === "input") {
    return (
      <KeyboardAvoidingView
        style={styles.inputPhase}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={[styles.inputRow, { paddingBottom: 12 + insets.bottom }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Say something to Sonder..."
            placeholderTextColor="#c9c9c9"
            onSubmitEditing={handleSend}
            autoFocus
            blurOnSubmit={false}
          />
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const dissolve = phase === "dissolving";
  return (
    <View style={styles.replyPhase}>
      <DissolvingLine text={userText} dissolve={dissolve} style={styles.userLine} />
      {phase === "waiting" ? (
        <Text style={styles.waiting}>...</Text>
      ) : (
        <DissolvingLine text={replyText} dissolve={dissolve} style={styles.sonderLine} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputPhase: { width: "100%", flex: 1, justifyContent: "flex-end" },
  inputRow: { flexDirection: "row", padding: 12, gap: 8, backgroundColor: "rgba(0,0,0,0.35)" },
  input: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: { backgroundColor: "#7CFFB2", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "#000", fontWeight: "700" },
  error: { color: "#ff8a8a", textAlign: "center", marginBottom: 8, paddingHorizontal: 24 },
  replyPhase: { flex: 1, width: "100%", paddingHorizontal: 32, gap: 16, alignItems: "center", justifyContent: "center" },
  line: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  userLine: {},
  sonderLine: {},
  word: { color: "#F0E6FF", fontSize: 17, lineHeight: 24 },
  waiting: { color: "#8886a0", fontSize: 17 },
});
