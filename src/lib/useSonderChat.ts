import { useCallback, useRef, useState } from "react";
import { pickColdStartMessage } from "./coldStartMessages";

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

type ChatResponse = { reply: string; mood?: Mood };

async function requestChat(text: string, history: ChatMessage[]): Promise<ChatResponse> {
  if (!API_BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_SONDER_API_URL is not set — point it at the deployed Render service"
    );
  }
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, history }),
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
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true the moment the cold-start line actually reveals — i.e. this
  // specific request has already run past COLD_START_REVEAL_MS, a genuine
  // signal (not a guess) that this is a real cold-start wait.
  const coldStartFiredRef = useRef(false);

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError(null);
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
        data = await requestChat(text, historyForRequest);
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
        data = await requestChat(text, historyForRequest);
      }
      setMessages((prev) => [...prev, { role: "sonder", text: data.reply }]);
      if (data.mood) setMood(data.mood);
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

  return { messages, isWaiting, coldStartLine, error, mood, send };
}
