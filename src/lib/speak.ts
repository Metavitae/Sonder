import { useCallback, useEffect, useRef } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import type { UserVoice } from "./voicePreference";
import { hasLocalVoice, speakLocally, stopLocalVoice } from "./localVoice";
import { looksSpanish } from "./replyLanguage";

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

// Diagnostic (2026-09-25): on the POCO, Orpheus replies start playing and
// stop ~20ms later with no fallback, so the founder hears nothing. These
// lines show up in `adb logcat -s ReactNativeJS` and trace every step of
// the speak pipeline so the real stop cause can be read off the device.
const t0 = Date.now();
function vlog(...args: unknown[]) {
  console.log(`[SonderVoice +${Date.now() - t0}ms]`, ...args);
}

function speakViaOrpheus(
  text: string,
  voice: UserVoice,
  onPlayerCreated: (player: AudioPlayer) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const uri = `${API_BASE_URL}/speak?voice=${voice}&text=${encodeURIComponent(text)}`;
    const player = createAudioPlayer({ uri });
    vlog("player created", player.id, "chars", text.length);
    onPlayerCreated(player);
    let settled = false;
    // Only true when the timeout below gave up on this player. `settled`
    // alone can't be used for the late-arrival guard: it's also true right
    // after a *successful* start. Real bug found 2026-09-25 (POCO, logged
    // trace): the status update just after "playing" saw settled=true and
    // paused the reply ~30ms in — the founder heard nothing, and since
    // Orpheus had "succeeded" the built-in fallback never spoke either. The
    // same early return also skipped didJustFinish, so finished players
    // were never removed and piled up.
    let gaveUp = false;

    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(success);
    };

    const timer = setTimeout(() => {
      // Never actually started — treat as a real failure, not just slow.
      // Real bug found 2026-08-17 (Part 32 crisis-tripwire verification):
      // on a cold Render free-tier instance, the request can still be
      // mid-flight well past this timeout and start playing anyway much
      // later (observed: ~35s after send) unless explicitly paused —
      // remove() alone didn't reliably stop an in-flight native buffer
      // from eventually transitioning to playing, so a late arrival could
      // speak right over whatever the native fallback (below) had already
      // said. pause() first, then remove().
      vlog("start timeout fired, giving up on", player.id);
      gaveUp = true;
      player.pause();
      player.remove();
      finish(false);
    }, ORPHEUS_START_TIMEOUT_MS);

    player.addListener("playbackStatusUpdate", (status) => {
      vlog("status", player.id, JSON.stringify({
        settled,
        gaveUp,
        playing: status.playing,
        loaded: status.isLoaded,
        buffering: status.isBuffering,
        state: status.playbackState,
        time: status.currentTime,
        duration: status.duration,
        finished: status.didJustFinish,
        muted: status.mute,
      }));
      if (gaveUp) {
        // Arrived after we already gave up on this call (the slow-cold-
        // start case above) — don't let it start playing over whatever's
        // already speaking instead.
        if (status.playing) player.pause();
        return;
      }
      if (status.playing) finish(true);
      if (status.didJustFinish) {
        vlog("didJustFinish, removing", player.id);
        player.remove();
      }
    });

    vlog("play()", player.id);
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

  const speak = useCallback(async (text: string, voice: UserVoice, options?: { instant?: boolean }) => {
    const myGeneration = ++generationRef.current;
    vlog("speak called, generation", myGeneration, "instant", !!options?.instant, "hasApi", !!API_BASE_URL);
    if (activePlayerRef.current) vlog("barge-in: removing", activePlayerRef.current.id);
    // Barge-in: a new line always wins outright rather than layering over
    // whatever hasn't finished yet, on either channel.
    activePlayerRef.current?.remove();
    activePlayerRef.current = null;
    Speech.stop();
    stopLocalVoice();

    // On-device voice first (founder decision 2026-09-25: no paid/quota
    // server for the voice). Fast enough for reflex lines too, so `instant`
    // doesn't skip it. Orpheus and the built-in voice below only run when
    // the on-device voice isn't downloaded yet or fails.
    // Spanish replies (Sonder mirrors the user's language) go to the phone's
    // own Mexican-Spanish voice: free, on-device, no server — Kristin/Joe
    // and Orpheus only speak English. Founder rejected the Piper Mexican
    // voices by ear (2026-09-25: far too slow).
    if (looksSpanish(text)) {
      vlog("spanish line, built-in es-MX voice");
      // Founder: the Spanish voice was too fast — slowed to 0.85.
      Speech.speak(text, { language: "es-MX", rate: 0.85 });
      return;
    }

    if (hasLocalVoice(voice)) {
      try {
        vlog("speaking on-device, generation", myGeneration);
        const finished = await speakLocally(text, voice);
        vlog("on-device result", finished, "generation", myGeneration);
        return;
      } catch (e) {
        vlog("on-device voice failed", String(e));
        if (myGeneration !== generationRef.current) return;
      }
    }

    // Reflex lines (freefall gag, dream/wake) need to land the instant they
    // fire, same as a person's own startle reflex — Orpheus is a real
    // network round-trip to a Render free-tier instance (up to
    // ORPHEUS_START_TIMEOUT_MS before even falling back), which reads as a
    // late, delayed reaction for something that's supposed to be immediate.
    // Chat replies (the user is reading, not reacting) can still afford to
    // wait for the higher-quality voice.
    if (!options?.instant && API_BASE_URL) {
      await ensureAudioMode();
      const spoke = await speakViaOrpheus(text, voice, (player) => {
        if (myGeneration !== generationRef.current) {
          // A newer call already barged in while this one was still
          // starting up — don't let this late player start playing too.
          vlog("stale generation, removing new player", player.id);
          player.remove();
          return;
        }
        activePlayerRef.current?.remove();
        activePlayerRef.current = player;
      });
      vlog("orpheus result", spoke, "generation", myGeneration, "current", generationRef.current);
      if (myGeneration !== generationRef.current) return;
      if (spoke) return;
    }
    if (myGeneration !== generationRef.current) return;
    vlog("falling back to built-in TTS");
    Speech.speak(text);
  }, []);

  useEffect(() => {
    return () => {
      vlog("useSpeak unmount cleanup, removing", activePlayerRef.current?.id);
      activePlayerRef.current?.remove();
      Speech.stop();
      stopLocalVoice();
    };
  }, []);

  return speak;
}
