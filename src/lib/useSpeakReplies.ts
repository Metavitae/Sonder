import { useEffect, useRef } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import type { ChatMessage } from "./useSonderChat";
import type { UserVoice } from "./voicePreference";

// Duplicated from useSonderChat.ts for the same reason its own Mood/Warmth/
// Arousal types are duplicated — client and server are separate packages,
// no shared config module yet.
const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";

// Real find 2026-08-17 (Part 29/30): Groq's free/on-demand tier caps
// orpheus-v1-english at 3600 tokens/day, org-wide — a handful of replies
// exhausts it for the rest of the day, and a fetch-based player pointed at
// a failing /speak URL never surfaces a clean JS-level error (ExoPlayer
// logs it natively, ".playbackStatusUpdate" never reports one). Rather
// than trying to catch an error that doesn't reliably arrive, this treats
// "never actually started playing within a few seconds" as the failure
// signal and falls back to Android's free, unlimited built-in
// TextToSpeech (expo-speech) — lower character quality, but Sonder never
// just goes silent with no explanation.
const ORPHEUS_START_TIMEOUT_MS = 6000;

function speakViaOrpheus(
  text: string,
  voice: UserVoice,
  onPlayerCreated: (player: AudioPlayer) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const uri = `${API_BASE_URL}/speak?voice=${voice}&text=${encodeURIComponent(text)}`;
    const player = createAudioPlayer({ uri });
    onPlayerCreated(player);
    let settled = false;

    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(success);
    };

    const timer = setTimeout(() => {
      // Never actually started — treat as a real failure, not just slow.
      player.remove();
      finish(false);
    }, ORPHEUS_START_TIMEOUT_MS);

    player.addListener("playbackStatusUpdate", (status) => {
      if (status.playing) finish(true);
      if (status.didJustFinish) player.remove();
    });

    player.play();
  });
}

let audioModeReady: Promise<void> | null = null;
function ensureAudioMode(): Promise<void> {
  // Only needs to run once per app session, not once per reply.
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      // Non-fatal — playback still works without this, just possibly
      // silenced by the iOS ringer switch. Android is unaffected either
      // way (the actual test platform for this project so far).
    });
  }
  return audioModeReady;
}

// Per "Sonder - Voice Two-Phase Plan (canonical 2026-08-17)" Phase 1 —
// speaks each new Sonder reply aloud in the user's chosen voice
// (voicePreference.ts), falling back to device-native TTS per Part 30
// when Orpheus is unavailable.
export function useSpeakReplies(messages: ChatMessage[], voice: UserVoice) {
  const spokenCountRef = useRef(0);
  const activePlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    // First mount: don't speak whatever history already exists (e.g. after
    // a reload), only replies that arrive from here on.
    if (spokenCountRef.current === 0) {
      spokenCountRef.current = messages.length;
      return;
    }
    if (messages.length <= spokenCountRef.current) return;
    const newOnes = messages.slice(spokenCountRef.current);
    spokenCountRef.current = messages.length;
    const lastReply = [...newOnes].reverse().find((m) => m.role === "sonder");
    if (!lastReply || !API_BASE_URL) return;

    ensureAudioMode().then(async () => {
      const spoke = await speakViaOrpheus(lastReply.text, voice, (player) => {
        activePlayerRef.current?.remove();
        activePlayerRef.current = player;
      });
      if (!spoke) Speech.speak(lastReply.text);
    });
  }, [messages, voice]);

  useEffect(() => {
    return () => {
      activePlayerRef.current?.remove();
      Speech.stop();
    };
  }, []);
}
