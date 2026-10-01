import { useCallback, useEffect, useRef, useState } from "react";
import { pickColdStartMessage } from "./coldStartMessages";
import type { MistColor } from "./mistAtlas";
import { moodToMist } from "./moodToMist";
import { nowMs } from "./testClock";
import { takeSightSummary } from "./sightReading";
import { currentWeatherSummary, localTimeLabel } from "./localContext";
import { currentSonderGender } from "./voicePreference";
import { currentUserGender } from "./onboardingStorage";
import { isCrisisMessage, crisisResponseFor } from "./crisisTripwire";
import { loadStoredMessages, persistMessages } from "./chatHistory";
import { currentSonderNotes, maybeUpdateSonderNotes } from "./sonderNotes";
import type { Presence } from "./motion";
import type { TraitSignal, TraitWeights } from "./characterTraits";
import { noteUserMessageLanguage, say } from "./i18n";
import { forgetDiaryPhoto } from "./diaryPhotos";

// Set by the founder once the Render service exists — see server/README.md.
// EXPO_PUBLIC_ vars are inlined at bundle time (Expo convention), so this
// needs a real .env value (or an EAS build-time env var) to reach anything
// beyond a local dev server. Empty by default rather than guessing a URL.
const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";

// How long a request must be outstanding before we treat the wait as a
// genuine cold start rather than ordinary response latency — per "Sonder -
// Cold-Start Character Messages (canonical 2026-08-13)": "Only on genuine
// cold-start wait, never on normal response latency." A fast reply never
// reveals a character line at all; only a request that's still pending
// past this threshold does, which is what actually distinguishes a real
// Render spin-up delay from normal generation time — no server-side flag
// needed for that distinction.
const COLD_START_REVEAL_MS = 1200;

// `at` (when it was written) and `ink` (the feeling Sonder wrote it with)
// feed the diary pages (founder, 2026-09-27): a new day gets a date line,
// and each of Sonder's lines keeps the color of the feeling of its moment.
// Both are optional — entries stored before then have neither.
export type ChatMessage = {
  role: "user" | "sonder";
  text: string;
  at?: number;
  ink?: MistColor;
  // A photo pasted onto the page (diaryPhotos.ts): the picture stays on the
  // phone at `uri`; `description` is what Sonder saw, the only part that
  // ever travels again.
  photo?: { uri: string; description?: string };
  // A line Sonder said on its own while dozing off ("dream") or on waking
  // back up ("wake"). Founder, 2026-09-30: these used to show only for the
  // moment and were never kept, so Sonder didn't remember saying them —
  // now they're diary entries like any other, marked for Sonder's memory.
  idle?: "dream" | "wake";
};

// What a diary entry says, in words — a photo is shared as what Sonder saw
// in it, never as the image.
export function wordsOf(m: ChatMessage): string {
  // The server's TALKING_TO_ITSELF_NOTE explains these to Sonder (founder,
  // 2026-09-30: Sonder likes to talk to itself when bored or distracted).
  if (m.idle === "dream") return `[Talking to myself while drifting off, bored or distracted] ${m.text}`;
  if (m.idle === "wake") return `[Talking to myself on waking back up] ${m.text}`;
  if (!m.photo) return m.text;
  const seen = m.photo.description
    ? `[Photo pasted into the diary — what it shows: ${m.photo.description}]`
    : "[Photo pasted into the diary]";
  return m.text.trim() ? `${seen} ${m.text}` : seen;
}

// Duplicated from server/src/groq.ts's Warmth/Arousal/Mood — client and
// server are separate packages with no shared types module, and this is a
// small enough contract that a shared package would be overhead the
// project doesn't need yet. Keep both sides in sync by hand if this ever
// changes (see server/README.md for the canonical contract doc).
export type Warmth = "warm" | "cool" | "neutral";
export type Arousal = "low" | "med" | "high";
export type Mood = { warmth: Warmth; arousal: Arousal };

const DEFAULT_MOOD: Mood = { warmth: "neutral", arousal: "med" };

type ChatResponse = { reply: string; mood?: Mood; traitSignal?: TraitSignal; voiceOn?: boolean };

// Sonder's reply as a diary entry: dated, in the ink of the feeling it came
// with (no mood tag → the neutral default, same as the mist's).
function sonderEntry(text: string, mood: Mood | undefined): ChatMessage {
  return { role: "sonder", text, at: nowMs(), ink: moodToMist(mood ?? DEFAULT_MOOD).color };
}

async function requestChat(
  text: string,
  history: ChatMessage[],
  sessionOpening: boolean,
  openingPresence?: Presence,
  headphonesConnected?: boolean,
  traitWeights?: TraitWeights,
  voiceEnabled = false,
  opener = false,
  sight: string | null = null
): Promise<ChatResponse> {
  if (!API_BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_SONDER_API_URL is not set — point it at the deployed Render service"
    );
  }
  // The server only ever reads the last 40 (MAX_HISTORY_TURNS in
  // server/src/index.ts), and the diary now keeps everything — so only the
  // recent part travels, and only the words.
  const recent = history.slice(-40).map((m) => ({ role: m.role, text: wordsOf(m) }));
  const body: Record<string, unknown> = { message: text, history: recent, sessionOpening };
  // Per Part 72 — sent every turn, same stateless-per-request shape as
  // headphones/presence below; the server never persists this.
  if (traitWeights) {
    body.traits = traitWeights;
  }
  // Per "Sonder - Direct Instructions for CC 2026-08-14 Part 22", item 9 —
  // only meaningful as an "opening" signal. Originally gated server-side on
  // history.length === 0, but Part 33's cross-session memory now restores
  // prior history on launch, so that condition would never be true again
  // after someone's first-ever session — silently killing this signal.
  // sessionOpening (set in send(), below) tracks "first send since this
  // app process launched" independently of how much history is loaded.
  if (openingPresence && openingPresence !== "unknown") {
    body.presence = openingPresence;
  }
  // Per Part 22/25 item 4 — unlike presence, this is an ongoing state, not
  // an opening-only one: sent on every turn while headphones stay
  // connected, not just the first.
  if (headphonesConnected) {
    body.headphones = true;
  }
  // Voice on/off toggle (2026-09-14 voice-regression instructions, item 3)
  // — lets groq.ts's VOICE_CAPABILITY_NOTE tell the truth about whether
  // Sonder is being heard. Only sent when off; the server defaults to on.
  if (!voiceEnabled) {
    body.voice = false;
  }
  // 2026-09-14 proactive-conversation instructions, items 1-3: local time
  // every turn (phone clock, no permission), weather only if coarse
  // location was granted — see localContext.ts for the privacy shape.
  body.localTime = localTimeLabel();
  body.sonderGender = currentSonderGender();
  const userGender = await currentUserGender();
  if (userGender) body.userGender = userGender;
  const weather = await currentWeatherSummary();
  if (weather) body.weather = weather;
  if (opener) body.opener = true;
  // Sonder's sight (2026-09-27): a few plain words about the user's face
  // while they wrote this — see sightReading.ts. Never an image.
  if (sight) body.sight = sight;
  // Sonder's private notes (sonderNotes.ts) — what it remembers from
  // before the last 40 messages.
  const notes = await currentSonderNotes();
  if (notes) body.notes = notes;
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`server responded ${res.status}`);
  return (await res.json()) as ChatResponse;
}

// onVoiceOn: the user asked Sonder, in words, to talk (founder addition
// 2026-09-23) — the server reports it via groq.ts's [[voice:on]] tag. Fired
// before the reply is added to messages, so the voice is already on in the
// same render useSpeakReplies sees that reply, and it gets spoken.
export function useSonderChat(onVoiceOn?: () => void) {
  // Ref, not a dep of send() below — send is deliberately stable ([] deps).
  const onVoiceOnRef = useRef(onVoiceOn);
  onVoiceOnRef.current = onVoiceOn;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [coldStartLine, setColdStartLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood>(DEFAULT_MOOD);
  const [traitSignal, setTraitSignal] = useState<TraitSignal>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true the moment the cold-start line actually reveals — i.e. this
  // specific request has already run past COLD_START_REVEAL_MS, a genuine
  // signal (not a guess) that this is a real cold-start wait.
  const coldStartFiredRef = useRef(false);
  // Part 33 — true only for the first send() call since this app process
  // launched, regardless of how much persisted history got restored below.
  // Distinct from historyForRequest.length === 0, which is no longer a
  // reliable "first turn ever" signal now that history survives a restart.
  const sessionOpeningRef = useRef(true);
  // Guards the persist effect below so it never fires on the initial empty
  // render (before loadStoredMessages() resolves) and overwrite real
  // storage with [].
  const hasLoadedHistoryRef = useRef(false);
  // Same moment as hasLoadedHistoryRef, but as state so useSpeakReplies can
  // wait for it: restored history must not be mistaken for new replies.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // Real bug found 2026-08-18 (live on-device retest of Part 33, chasing
  // Part 34 item 1): loadStoredMessages() is async, but nothing stopped
  // send() from firing before it resolved — a message sent in that window
  // captured historyForRequest from the still-empty initial `messages`
  // state, went out with no context, and the model correctly (if
  // unhelpfully) said it didn't know whatever the user had told it in a
  // prior session. send() below awaits this so it can't race the load.
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPromiseRef.current = loadStoredMessages().then((stored) => {
      if (cancelled) return;
      if (stored.length > 0) setMessages(stored);
      hasLoadedHistoryRef.current = true;
      setHistoryLoaded(true);
      // The first-conversation opener (2026-09-14, Sonder writing the first
      // line itself) is retired — founder, 2026-09-27: "Leave the page
      // blank." A new diary opens on an empty page with the cursor waiting.
      // The server still supports `opener`; nothing sends it now.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedHistoryRef.current) return;
    persistMessages(messages);
    maybeUpdateSonderNotes(messages);
  }, [messages]);

  // The part of a turn after the user's entry is on the page: wait for
  // Sonder (showing a cold-start line if the server is waking), retry once
  // on a genuine cold start, then put Sonder's reply on the page.
  const replyTo = useCallback(async (
    text: string,
    historyForRequest: ChatMessage[],
    {
      sessionOpening,
      openingPresence,
      headphonesConnected,
      traitWeights,
      voiceEnabled,
      sight,
    }: {
      sessionOpening: boolean;
      openingPresence?: Presence;
      headphonesConnected?: boolean;
      traitWeights?: TraitWeights;
      voiceEnabled?: boolean;
      sight: string | null;
    }
  ) => {
    setIsWaiting(true);
    setColdStartLine(null);
    coldStartFiredRef.current = false;

    revealTimerRef.current = setTimeout(() => {
      coldStartFiredRef.current = true;
      setColdStartLine(pickColdStartMessage());
    }, COLD_START_REVEAL_MS);

    try {
      let data: ChatResponse;
      try {
        data = await requestChat(
          text,
          historyForRequest,
          sessionOpening,
          openingPresence,
          headphonesConnected,
          traitWeights,
          voiceEnabled,
          false,
          sight
        );
      } catch (firstErr) {
        // Real bug found 2026-08-14 (founder's first live test, Part 24):
        // a 500 on the very first send, not reproducible afterward with
        // identical content — points to Render's free-tier first-request-
        // after-sleep instability (the container can still be finishing
        // initialization even after health checks pass), not a
        // deterministic code bug. One automatic retry, but ONLY when we
        // know this was a genuine cold-start wait (coldStartFiredRef) —
        // an ordinary fast failure (bad input, a real server bug) should
        // still surface immediately, not be masked by a silent retry.
        if (!coldStartFiredRef.current) throw firstErr;
        data = await requestChat(
          text,
          historyForRequest,
          sessionOpening,
          openingPresence,
          headphonesConnected,
          traitWeights,
          voiceEnabled,
          false,
          sight
        );
      }
      if (data.voiceOn) onVoiceOnRef.current?.();
      // Founder, 2026-09-29: the mist and Sonder's ink react together, from
      // the same feeling — a reply without a mood tag is the neutral default
      // for both, never a new-colored line under an old mist. Past lines
      // keep the ink they were written with.
      const feeling = data.mood ?? DEFAULT_MOOD;
      setMessages((prev) => [...prev, sonderEntry(data.reply, feeling)]);
      setMood(feeling);
      setTraitSignal(data.traitSignal ?? null);
    } catch (err) {
      // Founder-approved (2026-09-25): a friendly line in the conversation's
      // language instead of raw technical text ("server responded 500"),
      // which stays in the log for debugging.
      console.log("[chat] request failed", err instanceof Error ? err.message : String(err));
      setError(say("Something went wrong on my end. Want to try again?", "Algo falló de mi lado. ¿Lo intentamos otra vez?"));
    } finally {
      if (revealTimerRef.current !== null) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setIsWaiting(false);
      setColdStartLine(null);
    }
  }, []);

  const send = useCallback(async (
    text: string,
    openingPresence?: Presence,
    headphonesConnected?: boolean,
    traitWeights?: TraitWeights,
    voiceEnabled?: boolean
  ) => {
    if (!text.trim()) return;
    noteUserMessageLanguage(text);
    setError(null);
    const sessionOpening = sessionOpeningRef.current;
    sessionOpeningRef.current = false;
    // Taken now, once — a cold-start retry below reuses the same words.
    const sight = takeSightSummary();

    // Per "Kithe - Sonder's Complete Reference" §7 (Crisis Protocol) and
    // "Sonder - Direct Instructions for CC 2026-08-17 Part 32" — runs
    // first, on-device, before anything else touches this message: no
    // network call, no LLM, regardless of tier, permissions, or onboarding
    // stage. See crisisTripwire.ts for scope/rationale. useSpeakReplies
    // (chat.tsx) picks this reply up the same way as any other — no extra
    // wiring needed for it to be spoken, not just displayed.
    if (isCrisisMessage(text)) {
      setMessages((prev) => [
        ...prev,
        { role: "user", text, at: nowMs() },
        sonderEntry(crisisResponseFor(text), DEFAULT_MOOD),
      ]);
      setMood(DEFAULT_MOOD);
      return;
    }

    // Make sure persisted history has actually finished loading before
    // capturing it as context below — see loadPromiseRef's comment above.
    // A no-op after the first send of a session, since the load has
    // almost always resolved by then; only matters in the narrow window
    // right after a fresh launch.
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
    }

    // Captured before the state update below — the server's `history` is
    // everything BEFORE this turn, and `message` is this turn itself.
    let historyForRequest: ChatMessage[] = [];
    setMessages((prev) => {
      historyForRequest = prev;
      return [...prev, { role: "user", text, at: nowMs() }];
    });
    await replyTo(text, historyForRequest, {
      sessionOpening,
      openingPresence,
      headphonesConnected,
      traitWeights,
      voiceEnabled,
      sight,
    });
  }, [replyTo]);

  // A photo pasted onto the page (diaryPhotos.ts): it goes on the page at
  // once, then Sonder takes its one look and writes back about it.
  const sendPhoto = useCallback(async (
    photo: { uri: string; base64: string },
    describe: (base64: string) => Promise<string>,
    openingPresence?: Presence,
    headphonesConnected?: boolean,
    traitWeights?: TraitWeights,
    voiceEnabled?: boolean
  ) => {
    setError(null);
    const sessionOpening = sessionOpeningRef.current;
    sessionOpeningRef.current = false;
    const sight = takeSightSummary();
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
    }
    const at = nowMs();
    let historyForRequest: ChatMessage[] = [];
    setMessages((prev) => {
      historyForRequest = prev;
      return [...prev, { role: "user", text: "", at, photo: { uri: photo.uri } }];
    });
    setIsWaiting(true);
    let description: string;
    try {
      description = await describe(photo.base64);
    } catch (err) {
      // The photo stays on the page; Sonder just couldn't see it this time.
      console.log("[photo] describe failed", err instanceof Error ? err.message : String(err));
      setIsWaiting(false);
      setError(say("I couldn't quite see that photo. Want to try again?", "No alcancé a ver bien esa foto. ¿Lo intentamos otra vez?"));
      return;
    }
    const pasted: ChatMessage = { role: "user", text: "", at, photo: { uri: photo.uri, description } };
    setMessages((prev) => prev.map((m) => (m.at === at && m.photo ? pasted : m)));
    await replyTo(wordsOf(pasted), historyForRequest, {
      sessionOpening,
      openingPresence,
      headphonesConnected,
      traitWeights,
      voiceEnabled,
      sight,
    });
  }, [replyTo]);

  // Founder, 2026-09-28: entries can be torn out of the diary — writing or
  // a photo (whose file is deleted from the phone as well).
  const deleteMessage = useCallback((index: number) => {
    setMessages((prev) => {
      const gone = prev[index];
      if (!gone) return prev;
      if (gone.photo) forgetDiaryPhoto(gone.photo.uri);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // A line Sonder says on its own (dozing off / waking): written into the
  // diary in the ink of its current feeling, so it's kept and remembered.
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const addIdleLine = useCallback((text: string, idle: "dream" | "wake") => {
    setMessages((prev) => [...prev, { ...sonderEntry(text, moodRef.current), idle }]);
  }, []);

  return { messages, isWaiting, coldStartLine, error, mood, traitSignal, send, sendPhoto, deleteMessage, addIdleLine, historyLoaded };
}
