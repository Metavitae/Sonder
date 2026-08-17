import { useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSonderChat } from "../lib/useSonderChat";
import { moodToMist } from "../lib/moodToMist";
import { usePresence } from "../lib/motion";
import { useIdleSleep } from "../lib/useIdleSleep";
import { pickDreamLine, pickWakeLine } from "../lib/sleepBit";
import { useHeadphonesConnected } from "../lib/audioRoute";
import { usePreferredVoice, USER_VOICES } from "../lib/voicePreference";
import { useSpeakReplies } from "../lib/useSpeakReplies";
import { SpriteMistPoC } from "../components/SpriteMistPoC";

// Item 6's "performed only" dreaming state forces the mist to a slow,
// dim pulse regardless of the last real mood — dimming via a separate
// overlay layer, same pattern index.tsx already uses for tracking-quality
// dimming, rather than teaching SpriteMistPoC itself about sleep.
const DREAM_INTENSITY = 0.1;
const DREAM_OVERLAY_OPACITY = 0.45;
const WAKE_LINE_DURATION_MS = 2500;

// Item 4's "quiet tonal/behavioral change" — a much subtler cue than the
// dream overlay above, on purpose: this is closeness, not sleep. A low-
// opacity warm tint plus a calmer pulse, same overlay-layer pattern.
const HEADPHONES_INTENSITY_SCALE = 0.6;
const HEADPHONES_OVERLAY_OPACITY = 0.12;

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
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  // Per Part 22/25 item 9 — read continuously, but only the reading at the
  // moment the opening send fires actually matters; useSonderChat only acts
  // on it when this is the first turn of the session.
  const presence = usePresence();

  // Item 6 — performed sleep/dreaming bit. `noteActivity` marks the moment
  // as real interaction (resets the idle clock, and if we were dreaming,
  // flags a genuine wake rather than just cancelling a near-miss).
  const { isDreaming, justWoke, noteActivity, clearJustWoke } = useIdleSleep();
  const [dreamLine, setDreamLine] = useState("");
  const [wakeLine, setWakeLine] = useState<string | null>(null);
  const dreamOverlay = useSharedValue(0);

  useEffect(() => {
    if (isDreaming) setDreamLine(pickDreamLine());
    dreamOverlay.value = withTiming(isDreaming ? DREAM_OVERLAY_OPACITY : 0, { duration: 600 });
  }, [isDreaming, dreamOverlay]);

  useEffect(() => {
    if (!justWoke) return;
    setWakeLine(pickWakeLine());
    clearJustWoke();
    const id = setTimeout(() => setWakeLine(null), WAKE_LINE_DURATION_MS);
    return () => clearTimeout(id);
  }, [justWoke, clearJustWoke]);

  const dreamOverlayStyle = useAnimatedStyle(() => ({ opacity: dreamOverlay.value }));

  // Item 4 — read continuously, applied to both the ambient visual (below)
  // and sent with every turn (not opening-gated like presence) so Sonder's
  // actual language shifts too, per groq.ts's HEADPHONES_GUIDANCE.
  const headphonesConnected = useHeadphonesConnected();
  const headphonesOverlay = useSharedValue(0);
  useEffect(() => {
    headphonesOverlay.value = withTiming(headphonesConnected ? HEADPHONES_OVERLAY_OPACITY : 0, {
      duration: 800,
    });
  }, [headphonesConnected, headphonesOverlay]);
  const headphonesOverlayStyle = useAnimatedStyle(() => ({ opacity: headphonesOverlay.value }));

  const mistIntensity = isDreaming
    ? DREAM_INTENSITY
    : headphonesConnected
      ? intensity * HEADPHONES_INTENSITY_SCALE
      : intensity;

  // Per "Sonder - Voice Two-Phase Plan (canonical 2026-08-17)" Phase 1 —
  // the user's pick, persisted across sessions (voicePreference.ts), not a
  // fixed persona. useSpeakReplies watches `messages` and speaks each new
  // Sonder reply aloud in whichever voice is currently selected.
  const { voice, setVoice } = usePreferredVoice();
  useSpeakReplies(messages, voice);

  const handleInputChange = (text: string) => {
    noteActivity();
    setInput(text);
  };

  const handleSend = () => {
    const text = input;
    setInput("");
    noteActivity();
    send(text, presence, headphonesConnected);
    // Keep the cursor live in the field after sending, rather than making
    // the user tap back in every time — pressing the Send button (as
    // opposed to the keyboard's own submit key) blurs the input by default.
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <SpriteMistPoC color={color} intensity={mistIntensity} />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.headphonesOverlay, headphonesOverlayStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.dreamOverlay, dreamOverlayStyle]}
      />
      <View style={[styles.voicePicker, { top: 12 + insets.top }]}>
        {USER_VOICES.map((v) => (
          <Pressable
            key={v}
            style={[styles.voicePill, v === voice && styles.voicePillActive]}
            onPress={() => setVoice(v)}
          >
            <Text style={[styles.voicePillText, v === voice && styles.voicePillTextActive]}>
              {v}
            </Text>
          </Pressable>
        ))}
      </View>
      {
        // Real bug (founder report, Part 24): `behavior: undefined` on
        // Android means KeyboardAvoidingView is a complete no-op there,
        // leaving the input reachability entirely up to the Activity's
        // adjustResize mode — which wasn't reliably keeping the input row
        // visible above the keyboard on real hardware, matching "keyboard
        // almost unaccessible." "height" actively resizes this view's
        // content when the keyboard opens instead of trusting that alone.
      }
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          {!isWaiting && isDreaming && (
            <View style={[styles.bubble, styles.sonderBubble, styles.dreamBubble]}>
              <Text style={[styles.bubbleText, styles.dreamText]}>{dreamLine}</Text>
            </View>
          )}
          {!isWaiting && !isDreaming && wakeLine && (
            <View style={[styles.bubble, styles.sonderBubble]}>
              <Text style={styles.bubbleText}>{wakeLine}</Text>
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={[styles.inputRow, { paddingBottom: 12 + insets.bottom }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={handleInputChange}
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
  dreamBubble: { opacity: 0.8 },
  dreamText: { fontStyle: "italic" },
  dreamOverlay: { backgroundColor: "#000" },
  headphonesOverlay: { backgroundColor: "#7a4a2b" },
  voicePicker: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    gap: 6,
    zIndex: 10,
  },
  voicePill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  voicePillActive: { backgroundColor: "#7CFFB2" },
  voicePillText: { color: "#F0E6FF", fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  voicePillTextActive: { color: "#000" },
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
