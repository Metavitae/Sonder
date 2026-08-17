import { useEffect, useRef } from "react";
import type { ChatMessage } from "./useSonderChat";
import type { UserVoice } from "./voicePreference";
import { useSpeak } from "./speak";

// Per "Sonder - Voice Two-Phase Plan (canonical 2026-08-17)" Phase 1 —
// speaks each new Sonder reply aloud in the user's chosen voice
// (voicePreference.ts), via the shared speak pipeline (speak.ts).
export function useSpeakReplies(messages: ChatMessage[], voice: UserVoice) {
  // Real bug found 2026-08-17 (Part 32 crisis-tripwire verification): -1,
  // not 0 — the "first mount" guard below used to compare against 0, which
  // collides with a *legitimate* first-ever messages.length of 0. That
  // collision was invisible in the normal flow (the user's message and
  // Sonder's reply land in two separate state updates, so the sentinel
  // gets consumed by the harmless first one) but silently ate the very
  // first reply whenever both messages land in one atomic update instead —
  // exactly what the crisis tripwire does (user + Sonder's safety response
  // pushed together), so a crisis reply on a fresh session never spoke.
  const spokenCountRef = useRef(-1);
  const speak = useSpeak();

  useEffect(() => {
    // First mount: don't speak whatever history already exists (e.g. after
    // a reload), only replies that arrive from here on.
    if (spokenCountRef.current === -1) {
      spokenCountRef.current = messages.length;
      return;
    }
    if (messages.length <= spokenCountRef.current) return;
    const newOnes = messages.slice(spokenCountRef.current);
    spokenCountRef.current = messages.length;
    const lastReply = [...newOnes].reverse().find((m) => m.role === "sonder");
    if (!lastReply) return;
    speak(lastReply.text, voice);
  }, [messages, voice, speak]);
}
