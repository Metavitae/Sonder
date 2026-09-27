import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSonderChat } from "../lib/useSonderChat";
import { moodToMist } from "../lib/moodToMist";
import { usePresence } from "../lib/motion";
import { useIdleSleep } from "../lib/useIdleSleep";
import { pickDreamLine, pickWakeLine } from "../lib/sleepBit";
import { notifyDreaming } from "../lib/dreamNotify";
import { useHeadphonesConnected } from "../lib/audioRoute";
import { useSonderVoice } from "../lib/voicePreference";
import { useSpeakReplies } from "../lib/useSpeakReplies";
import { useSpeak } from "../lib/speak";
import { prepareLocalVoice } from "../lib/localVoice";
import { useCharacterTraits } from "../lib/characterTraits";
import { SpriteMistPoC } from "../components/SpriteMistPoC";
import { SightSense } from "../components/SightSense";
import { useCameraPermission } from "react-native-vision-camera";
import { t } from "../lib/i18n";
import { useAutoHideStatusBar, useKeyboardSpace } from "../lib/useChatChrome";
import { hasSeenDiaryDisclosure, markDiaryDisclosureSeen } from "../lib/diaryDisclosure";
import { DiaryBook, type DiaryBookHandle } from "../components/diary/DiaryBook";
import type { DiaryEntry } from "../lib/diaryLayout";
import { useDiaryPaper } from "../lib/diaryPaper";
import { PAPER_STYLE, SONDER_FONT, SONDER_INK } from "../lib/diaryInk";

// Item 6's "performed only" dreaming state forces the mist to a slow,
// dim pulse regardless of the last real mood — dimming via a separate
// overlay layer, same pattern index.tsx already uses for tracking-quality
// dimming, rather than teaching SpriteMistPoC itself about sleep.
const DREAM_INTENSITY = 0.1;
const DREAM_OVERLAY_OPACITY = 0.45;
const WAKE_LINE_DURATION_MS = 2500;
const TOP_BAR = 44;

// Diary reframe (2026-09-27 instructions, item 4): the one-time disclosure
// fades in over the blank page, holds long enough to read, then fades away
// on its own — tapping it dismisses it early. Never a modal.
const DISCLOSURE_FADE_IN_MS = 1200;
const DISCLOSURE_HOLD_MS = 6000;
const DISCLOSURE_FADE_OUT_MS = 900;

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
  // Voice is set by Sonder's gender at onboarding (voicePreference.ts); the
  // only user control left here is on/off. Declared before useSonderChat so
  // asking Sonder to talk (its [[voice:on]] tag) can switch it back on, and
  // before the dream/wake effects below, which speak through the same
  // pipeline as chat replies (Part 31).
  const { voice, voiceEnabled, setVoiceEnabled } = useSonderVoice();
  const turnVoiceOn = useCallback(() => setVoiceEnabled(true), [setVoiceEnabled]);
  const { messages, isWaiting, coldStartLine, error, mood, traitSignal, send, historyLoaded } =
    useSonderChat(turnVoiceOn);
  const { weights: traitWeights, applyTraitSignal } = useCharacterTraits();
  const [input, setInput] = useState("");
  const { color, intensity } = moodToMist(mood);
  const insets = useSafeAreaInsets();
  const keyboardSpace = useKeyboardSpace();
  const revealStatusBar = useAutoHideStatusBar();
  const inputRef = useRef<TextInput>(null);
  const bookRef = useRef<DiaryBookHandle>(null);
  const { paper, setPaper } = useDiaryPaper();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // The book's height with the keyboard closed, fixed for the session so
  // opening the keyboard never re-cuts the pages (see DiaryBook).
  const bookHeight = windowHeight - insets.top - TOP_BAR - insets.bottom;
  // Founder request (2026-09-25), carried into the diary: a way back to
  // the latest page after turning back to reread.
  const [atLatest, setAtLatest] = useState(true);
  const jumpToLatest = useCallback(() => {
    bookRef.current?.goToLatest();
  }, []);
  // Per Part 22/25 item 9 — read continuously, but only the reading at the
  // moment the opening send fires actually matters; useSonderChat only acts
  // on it when this is the first turn of the session.
  const presence = usePresence();

  const speak = useSpeak();

  // Item 6 — performed sleep/dreaming bit. `noteActivity` marks the moment
  // as real interaction (resets the idle clock, and if we were dreaming,
  // flags a genuine wake rather than just cancelling a near-miss).
  const { isDreaming, justWoke, noteActivity, clearJustWoke } = useIdleSleep();
  const [dreamLine, setDreamLine] = useState("");
  const [wakeLine, setWakeLine] = useState<string | null>(null);
  const dreamOverlay = useSharedValue(0);

  useEffect(() => {
    if (isDreaming) {
      const line = pickDreamLine();
      setDreamLine(line);
      if (voiceEnabled) speak(line, voice, { instant: true });
      // Part 76 item 1 (Option 3) — the durable signal, survives the
      // screen being locked; the dim overlay + bubble below are a bonus
      // for whenever the screen does happen to be on, not the real path.
      notifyDreaming(line);
    }
    dreamOverlay.value = withTiming(isDreaming ? DREAM_OVERLAY_OPACITY : 0, { duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDreaming, dreamOverlay]);

  useEffect(() => {
    if (!justWoke) return;
    const line = pickWakeLine();
    setWakeLine(line);
    if (voiceEnabled) speak(line, voice, { instant: true });
    // A real wake moment always has the screen on (it's triggered by real
    // interaction — noteActivity), so a haptic pulse here is a genuine,
    // reliable cue rather than depending on screen state like the overlay.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    clearJustWoke();
    const id = setTimeout(() => setWakeLine(null), WAKE_LINE_DURATION_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justWoke, clearJustWoke]);

  const dreamOverlayStyle = useAnimatedStyle(() => ({ opacity: dreamOverlay.value }));

  // Sonder's sight (founder, 2026-09-27): the camera keeps looking from
  // inside the diary — only if the camera was already allowed at
  // onboarding (never asked for here). How well Sonder can see the user
  // dims and cools the mist; see SightSense for the rest.
  const { hasPermission: sightAllowed } = useCameraPermission();
  const sightQuality = useSharedValue(1);
  const sightOverlayStyle = useAnimatedStyle(() => ({
    opacity: (1 - sightQuality.value) * 0.55,
  }));

  // Diary reframe item 4 — shown once ever. Marked seen the moment it
  // appears (not on dismiss), so closing the app mid-fade still counts.
  const [showDisclosure, setShowDisclosure] = useState(false);
  const disclosureOpacity = useSharedValue(0);
  useEffect(() => {
    let cancelled = false;
    hasSeenDiaryDisclosure().then((seen) => {
      if (cancelled || seen) return;
      markDiaryDisclosureSeen();
      setShowDisclosure(true);
      disclosureOpacity.value = withTiming(1, { duration: DISCLOSURE_FADE_IN_MS });
    });
    return () => {
      cancelled = true;
    };
  }, [disclosureOpacity]);
  useEffect(() => {
    if (!showDisclosure) return;
    const id = setTimeout(() => {
      disclosureOpacity.value = withTiming(0, { duration: DISCLOSURE_FADE_OUT_MS });
    }, DISCLOSURE_FADE_IN_MS + DISCLOSURE_HOLD_MS);
    const done = setTimeout(
      () => setShowDisclosure(false),
      DISCLOSURE_FADE_IN_MS + DISCLOSURE_HOLD_MS + DISCLOSURE_FADE_OUT_MS
    );
    return () => {
      clearTimeout(id);
      clearTimeout(done);
    };
  }, [showDisclosure, disclosureOpacity]);
  const dismissDisclosure = useCallback(() => {
    disclosureOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(() => setShowDisclosure(false), 300);
  }, [disclosureOpacity]);
  const disclosureStyle = useAnimatedStyle(() => ({ opacity: disclosureOpacity.value }));

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

  // useSpeakReplies watches `messages` and speaks each new Sonder reply
  // aloud in Sonder's voice (voice/speak declared above, shared with the
  // dream/wake lines) — unless the user has turned voice off.
  useSpeakReplies(messages, voice, voiceEnabled, historyLoaded);

  // On-device voice (founder decision 2026-09-25): fetched once (~65 MB)
  // and warmed up in the background, only once voice is actually on, so
  // nobody downloads it for a feature they never use. Until it's ready,
  // replies keep using Orpheus / the built-in voice.
  useEffect(() => {
    if (voiceEnabled) prepareLocalVoice(voice);
  }, [voice, voiceEnabled]);

  // Part 72 — each reply can flag a real trust/autonomy/initiative/industry
  // moment; applyTraitSignal only actually moves a stored weight once a
  // real streak forms (characterTraits.ts), so most turns are a no-op here.
  useEffect(() => {
    applyTraitSignal(traitSignal);
  }, [traitSignal, applyTraitSignal]);

  // Everything on the page: stored entries, then whatever Sonder is doing
  // right now (thinking, dozing, waking, a failed reply) as transient lines.
  const diaryEntries: DiaryEntry[] = messages.map((m, i) => ({
    key: String(i),
    role: m.role,
    text: m.text,
    at: m.at,
    ink: m.ink,
  }));
  if (isWaiting) {
    diaryEntries.push({ key: "pending", role: "sonder", text: coldStartLine ?? "...", tone: "pending" });
  } else if (isDreaming) {
    diaryEntries.push({ key: "dream", role: "sonder", text: dreamLine, tone: "dream" });
  } else if (wakeLine) {
    diaryEntries.push({ key: "wake", role: "sonder", text: wakeLine, tone: "pending" });
  }
  if (error && !isWaiting) {
    diaryEntries.push({ key: "error", role: "sonder", text: error, tone: "pending" });
  }

  const handleInputChange = (text: string) => {
    noteActivity();
    setInput(text);
  };

  const handleSend = () => {
    const text = input;
    if (!text.trim()) return;
    setInput("");
    noteActivity();
    send(text, presence, headphonesConnected, traitWeights ?? undefined, voiceEnabled);
    // Sending always brings the conversation back to the bottom.
    jumpToLatest();
    // Keep the cursor live in the field after sending, rather than making
    // the user tap back in every time — pressing the Send button (as
    // opposed to the keyboard's own submit key) blurs the input by default.
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container} onTouchStart={revealStatusBar}>
      {sightAllowed && <SightSense quality={sightQuality} />}
      {
        // Always opaque, always above the camera: its feed is never on
        // screen (founder rule, 2026-08-13).
      }
      <View style={styles.blackBackdrop} pointerEvents="none" />
      <SpriteMistPoC color={color} intensity={mistIntensity} />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.sightOverlay, sightOverlayStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.headphonesOverlay, headphonesOverlayStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.dreamOverlay, dreamOverlayStyle]}
      />
      <View style={[styles.topBar, { marginTop: insets.top }]}>
        {
          // Founder decision 2026-09-27: white page or brown page
          // ("like an adventurer's notebook"), the user's choice.
        }
        <View style={styles.paperPicker}>
          {(["white", "brown"] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPaper(p)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                p === "white" ? t("White paper", "Papel blanco") : t("Brown paper", "Papel café")
              }
              style={[
                styles.paperSwatch,
                { backgroundColor: PAPER_STYLE[p].page },
                paper === p && styles.paperSwatchActive,
              ]}
            />
          ))}
        </View>
        {
          // Autumn/Troy pills removed per founder (2026-09-14 instructions,
          // item 4) — which voice is fixed by onboarding; this only mutes it.
          // Its position is the founder's call (2026-09-26): leave it here.
        }
        <Pressable
          style={[styles.voicePill, voiceEnabled && styles.voicePillActive]}
          onPress={() => setVoiceEnabled(!voiceEnabled)}
        >
          <Text style={[styles.voicePillText, voiceEnabled && styles.voicePillTextActive]}>
            {voiceEnabled ? t("Voice on", "Con voz") : t("Voice off", "Sin voz")}
          </Text>
        </Pressable>
      </View>
      {
        // Android's own KeyboardAvoidingView math is wrong under edge-to-edge
        // (see useKeyboardSpace); there the padding does the work, and the
        // book slides up to the line being written instead of shrinking.
      }
      <KeyboardAvoidingView
        style={[styles.flex, { paddingBottom: keyboardSpace }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <DiaryBook
          ref={bookRef}
          entries={diaryEntries}
          paper={paper}
          feeling={color}
          bookHeight={bookHeight}
          pageWidth={windowWidth}
          keyboardOpen={keyboardSpace > 0}
          input={input}
          onChangeInput={handleInputChange}
          onSend={handleSend}
          inputRef={inputRef}
          onLatestChange={setAtLatest}
        />
        {showDisclosure && (
          <Animated.View style={[styles.disclosureWrap, disclosureStyle]}>
            <Pressable onPress={dismissDisclosure} hitSlop={24}>
              <Text style={[styles.disclosureText, { color: SONDER_INK[color] }]}>
                {t(
                  "This is a private page. Sonder — not a person — may write back.",
                  "Esta es una página privada. Sonder —no una persona— puede escribirte."
                )}
              </Text>
            </Pressable>
          </Animated.View>
        )}
        {!atLatest && (
          <Pressable
            style={styles.jumpButton}
            onPress={jumpToLatest}
            accessibilityRole="button"
            accessibilityLabel={t("Go to the latest page", "Ir a la página más reciente")}
            hitSlop={8}
          >
            <Text style={styles.jumpText}>»</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  topBar: {
    height: TOP_BAR,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  paperPicker: { flexDirection: "row", gap: 10 },
  paperSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  paperSwatchActive: { borderWidth: 2, borderColor: "#FFFFFF" },
  disclosureWrap: {
    position: "absolute",
    left: 48,
    right: 48,
    top: "30%",
    alignItems: "center",
  },
  disclosureText: {
    fontFamily: SONDER_FONT,
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
  },
  dreamOverlay: { backgroundColor: "#000" },
  blackBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  sightOverlay: { backgroundColor: "#0d1a2b" },
  headphonesOverlay: { backgroundColor: "#7a4a2b" },
  voicePill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  voicePillActive: { backgroundColor: "#7CFFB2" },
  voicePillText: { color: "#F0E6FF", fontSize: 12, fontWeight: "600" },
  voicePillTextActive: { color: "#000" },
  error: { color: "#ff8a8a", padding: 8 },
  jumpButton: {
    position: "absolute",
    right: 28,
    bottom: 28,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  jumpText: { color: "#F0E6FF", fontSize: 24, fontWeight: "600", lineHeight: 26 },
});
