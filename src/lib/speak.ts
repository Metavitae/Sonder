import { useCallback, useEffect, useRef } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
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

// Per "Sonder - Direct Instructions for CC 2026-08-17 Part 31" — the same
// speak pipeline (Orpheus first, expo-speech fallback) used for every
// voiced line Sonder produces, not just chat replies: also the sleep bit's
// dream/wake lines and the freefall gag's line. One implementation shared
// by useSpeakReplies (chat) and any app-triggered caller (ambient lines),
// rather than three copies of the Orpheus-timeout/fallback dance.
//
// Unlike chat replies (which only exist when a backend call already
// succeeded, so API_BASE_URL is always set by the time one arrives),
// ambient lines are generated locally and can fire with no backend
// configured at all — so this always falls through to the free, unlimited
// native fallback rather than silently doing nothing.
export function useSpeak() {
  const activePlayerRef = useRef<AudioPlayer | null>(null);
  // Real bug found 2026-08-17 (founder live test, Part 31 verification):
  // removing a superseded AudioPlayer only stops that *player* — the
  // speakViaOrpheus() call that created it keeps running its own
  // independent ORPHEUS_START_TIMEOUT_MS timer in its own closure,
  // unaware it was interrupted. When that timer later fires, it falls
  // through to Speech.speak() with its now-stale line, audibly layering
  // over whatever the newer call is already playing — two different lines
  // "superimposed," exactly as reported. A generation counter lets a
  // superseded call detect this and go silent instead of finishing late.
  const generationRef = useRef(0);

  const speak = useCallback(async (text: string, voice: UserVoice) => {
    const myGeneration = ++generationRef.current;
    // Barge-in: a new line always wins outright rather than layering over
    // whatever hasn't finished yet, on either channel.
    activePlayerRef.current?.remove();
    activePlayerRef.current = null;
    Speech.stop();

    if (API_BASE_URL) {
      await ensureAudioMode();
      const spoke = await speakViaOrpheus(text, voice, (player) => {
        if (myGeneration !== generationRef.current) {
          // A newer call already barged in while this one was still
          // starting up — don't let this late player start playing too.
          player.remove();
          return;
        }
        activePlayerRef.current?.remove();
        activePlayerRef.current = player;
      });
      if (myGeneration !== generationRef.current) return;
      if (spoke) return;
    }
    if (myGeneration !== generationRef.current) return;
    Speech.speak(text);
  }, []);

  useEffect(() => {
    return () => {
      activePlayerRef.current?.remove();
      Speech.stop();
    };
  }, []);

  return speak;
}
