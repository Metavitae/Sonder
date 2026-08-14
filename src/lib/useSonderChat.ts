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

export function useSonderChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWaiting, setIsWaiting] = useState(false);
  const [coldStartLine, setColdStartLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setIsWaiting(true);
    setColdStartLine(null);

    revealTimerRef.current = setTimeout(() => {
      setColdStartLine(pickColdStartMessage());
    }, COLD_START_REVEAL_MS);

    try {
      if (!API_BASE_URL) {
        throw new Error(
          "EXPO_PUBLIC_SONDER_API_URL is not set — point it at the deployed Render service"
        );
      }
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [...prev, { role: "sonder", text: data.reply }]);
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

  return { messages, isWaiting, coldStartLine, error, send };
}
