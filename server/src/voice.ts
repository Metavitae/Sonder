// Per "Sonder - Voice Two-Phase Plan (canonical 2026-08-17)" — Phase 1:
// Groq-hosted Orpheus TTS, same Groq account already used for text
// generation. groq-sdk@0.9.1 (this project's pinned version) has no
// audio.speech resource yet — only transcriptions/translations — so this
// calls Groq's OpenAI-compatible REST endpoint directly via fetch rather
// than waiting on an SDK upgrade for one endpoint.
const SPEECH_ENDPOINT = "https://api.groq.com/openai/v1/audio/speech";
const MODEL = "canopylabs/orpheus-v1-english";

export const ORPHEUS_VOICES = ["autumn", "diana", "hannah", "austin", "daniel", "troy"] as const;
export type OrpheusVoice = (typeof ORPHEUS_VOICES)[number];

// Per founder decision 2026-08-17 (after listening to all six via
// /voice-sample): the app offers exactly these two to end users, who pick
// between them — not a single fixed persona, and not the full six-voice
// set (those two were auditioned for fit, the other four were never meant
// to be user-facing).
export const USER_VOICES = ["autumn", "troy"] as const;
export type UserVoice = (typeof USER_VOICES)[number];

export async function synthesizeSpeech(text: string, voice: OrpheusVoice): Promise<Buffer> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(SPEECH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
      voice,
      response_format: "wav",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Orpheus speech request failed: ${res.status} ${detail}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
