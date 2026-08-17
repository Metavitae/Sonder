import { useEffect, useRef } from "react";
import type { ChatMessage } from "./useSonderChat";
import type { UserVoice } from "./voicePreference";
import { useSpeak } from "./speak";

// Per "Sonder - Voice Two-Phase Plan (canonical 2026-08-17)" Phase 1 —
// speaks each new Sonder reply aloud in the user's chosen voice
// (voicePreference.ts), via the shared speak pipeline (speak.ts).
export function useSpeakReplies(messages: ChatMessage[], voice: UserVoice) {
  const spokenCountRef = useRef(0);
  const speak = useSpeak();

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
    if (!lastReply) return;
    speak(lastReply.text, voice);
  }, [messages, voice, speak]);
}
