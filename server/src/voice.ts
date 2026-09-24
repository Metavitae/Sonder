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
