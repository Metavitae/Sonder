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
  return fixStreamedWavHeader(Buffer.from(arrayBuffer));
}

// Real bug found 2026-09-23 (founder heard no voice at all): Groq sends a
// "streaming" WAV whose RIFF and data sizes are 0xFFFFFFFF (unknown length),
// plus an extra LIST chunk. Desktop players cope; the phone's ExoPlayer
// logged "Data exceeds input length: 4294967373" and played silence. Since
// the whole file is already buffered here, rebuild it as a plain WAV (fmt +
// data, real sizes) before it goes out.
export function fixStreamedWavHeader(wav: Buffer): Buffer {
  if (wav.length < 12 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    return wav;
  }
  let fmt: Buffer | null = null;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      fmt = wav.subarray(body, body + size);
    } else if (id === "data") {
      if (!fmt) return wav;
      const data = wav.subarray(body);
      const header = Buffer.alloc(20);
      header.write("RIFF", 0, "ascii");
      header.writeUInt32LE(4 + 8 + fmt.length + 8 + data.length, 4);
      header.write("WAVE", 8, "ascii");
      header.write("fmt ", 12, "ascii");
      header.writeUInt32LE(fmt.length, 16);
      const dataHeader = Buffer.alloc(8);
      dataHeader.write("data", 0, "ascii");
      dataHeader.writeUInt32LE(data.length, 4);
      return Buffer.concat([header, fmt, dataHeader, data]);
    }
    offset = body + size + (size % 2);
  }
  return wav;
}

// Speaking to Sonder (Faro, Part 58 item 1, built 2026-10-03): record the
// whole turn on the phone, then turn it into text here — a voice message,
// not live transcription. The audio is passed straight to Groq's Whisper and
// dropped; nothing is stored or logged. Language is left to Whisper so
// English and Spanish both work without the user choosing.
const TRANSCRIBE_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const TRANSCRIBE_MODEL = "whisper-large-v3-turbo";

export async function transcribeSpeech(audio: Buffer): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mp4" }), "speech.m4a");
  form.append("model", TRANSCRIBE_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const res = await fetch(TRANSCRIBE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Whisper request failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}
