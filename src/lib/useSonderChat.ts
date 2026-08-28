import { useCallback, useEffect, useRef, useState } from "react";
import { pickColdStartMessage } from "./coldStartMessages";
import { isCrisisMessage, CRISIS_RESPONSE } from "./crisisTripwire";
import { loadStoredMessages, persistMessages } from "./chatHistory";
import type { Presence } from "./motion";
import type { TraitSignal, TraitWeights } from "./characterTraits";

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

export type ChatMessage = { role: "user" | "sonder"; text: string };

// Duplicated from server/src/groq.ts's Warmth/Arousal/Mood — client and
// server are separate packages with no shared types module, and this is a
// small enough contract that a shared package would be overhead the
// project doesn't need yet. Keep both sides in sync by hand if this ever
// changes (see server/README.md for the canonical contract doc).
export type Warmth = "warm" | "cool" | "neutral";
export type Arousal = "low" | "med" | "high";
export type Mood = { warmth: Warmth; arousal: Arousal };

const DEFAULT_MOOD: Mood = { warmth: "neutral", arousal: "med" };

type ChatResponse = { reply: string; mood?: Mood; traitSignal?: TraitSignal };

async function requestChat(
  text: string,
  history: ChatMessage[],
  sessionOpening: boolean,
  openingPresence?: Presence,
  headphonesConnected?: boolean,
  traitWeights?: TraitWeights
): Promise<ChatResponse> {
  if (!API_BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_SONDER_API_URL is not set — point it at the deployed Render service"
    );
  }
  const body: Record<string, unknown> = { message: text, history, sessionOpening };
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
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`server responded ${res.status}`);
  return (await res.json()) as ChatResponse;
}

export function useSonderChat() {
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
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedHistoryRef.current) return;
    persistMessages(messages);
  }, [messages]);

  const send = useCallback(async (
    text: string,
    openingPresence?: Presence,
    headphonesConnected?: boolean,
    traitWeights?: TraitWeights
  ) => {
    if (!text.trim()) return;
    setError(null);
    const sessionOpening = sessionOpeningRef.current;
    sessionOpeningRef.current = false;

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
        { role: "user", text },
        { role: "sonder", text: CRISIS_RESPONSE },
      ]);
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
      return [...prev, { role: "user", text }];
    });
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
          traitWeights
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
          traitWeights
        );
      }
      setMessages((prev) => [...prev, { role: "sonder", text: data.reply }]);
      if (data.mood) setMood(data.mood);
      setTraitSignal(data.traitSignal ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (revealTimerRef.current !== null) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setIsWaiting(false);
      setColdStartLine(null);
    }
  }, []);

  return { messages, isWaiting, coldStartLine, error, mood, traitSignal, send };
}
