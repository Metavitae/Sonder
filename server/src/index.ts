import express from "express";
import { initEmbeddings, retrieveTopExamples } from "./embeddings.js";
import { describePhoto, generateReply, MAX_NOTES_CHARS, updateNotes, type ChatTurn, type Presence, type SonderGender, type Trait, type UserGender, type TraitWeights } from "./groq.js";
import {
  ORPHEUS_VOICES,
  synthesizeSpeech,
  USER_VOICES,
  type OrpheusVoice,
  type UserVoice,
} from "./voice.js";

// Server-side cap on how much history a single request can carry — a
// safeguard against unbounded token/cost growth from a buggy or malicious
// client, not something the product design asked for. Well above what a
// real conversation screen would realistically send in one turn.
const MAX_HISTORY_TURNS = 40;

// The user's own gender, picked at onboarding; anything else (older
// builds, "Not specified") means "not stated".
function parseUserGender(value: unknown): UserGender | undefined {
  return value === "female" || value === "male" ? value : undefined;
}

function parseHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: ChatTurn[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      (item.role === "user" || item.role === "sonder") &&
      typeof item.text === "string" &&
      item.text.trim().length > 0
    ) {
      turns.push({ role: item.role, text: item.text });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

const TRAIT_NAMES: readonly Trait[] = ["trust", "autonomy", "initiative", "industry"];

// Per Part 72/73: the server never stores this, just relays it into the
// prompt for the duration of this one request — a malformed/missing value
// per trait falls back independently rather than discarding the whole
// object, same defensive shape as parseHistory above.
function parseTraitWeights(value: unknown): TraitWeights | undefined {
  if (!value || typeof value !== "object") return undefined;
  const src = value as Record<string, unknown>;
  const weights = {} as TraitWeights;
  let any = false;
  for (const t of TRAIT_NAMES) {
    const n = src[t];
    if (typeof n === "number" && n >= 0 && n <= 1) {
      weights[t] = n;
      any = true;
    } else {
      weights[t] = 0.3;
    }
  }
  return any ? weights : undefined;
}

const app = express();
// Room for one shrunk diary photo (~1024 px JPEG, well under 1 MB as
// base64) on /photo; every other request stays tiny.
app.use(express.json({ limit: "3mb" }));

const startedAt = Date.now();
let modelReady = false;

// Real bug found 2026-08-17 (Part 26, from Render's live logs): app.listen
// starts accepting requests immediately, but initEmbeddings() was only
// fired from inside that callback with no way for /chat to know it wasn't
// done yet — three real requests hit retrieveTopExamples() (and, through
// it, embed()) before extractor was set, throwing "Embedding model not
// loaded yet" every time. Holding the promise here lets /chat below await
// it directly instead of racing a boolean flag.
const modelReadyPromise = initEmbeddings()
  .then(() => {
    modelReady = true;
    console.log("[server] embedding model ready");
  })
  .catch((err) => {
    console.error("[server] failed to load embedding model:", err);
    throw err;
  });
// Express 4 (no built-in async-error handling) plus Node's default of
// crashing on an unhandled rejection means this needs its own no-op
// consumer here — otherwise a startup failure with no /chat request yet
// in flight to `await` it crashes the whole process before anyone gets a
// chance to see a real error response.
modelReadyPromise.catch(() => {});

// Cheap and immediate — never waits on the embedding model — so the client
// can use response latency here as a real cold-start signal (Render's
// free-tier spin-up-after-sleep delay dominates process boot time, not
// just model load).
app.get("/health", (_req, res) => {
  res.json({ status: "ok", modelReady, uptimeMs: Date.now() - startedAt });
});

// Short free-text device context (local time, weather summary) — capped and
// type-checked so a buggy client can't smuggle a long prompt in here.
function parseShortText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 80
    ? value.trim()
    : undefined;
}

// Sonder's sight (founder, 2026-09-27: "that was the whole idea for Sonder
// to have a sense of sight"): a few plain words about the user's face while
// they wrote this turn, built on the phone from the camera — never an image,
// never numbers. Same one-request-only, never-stored treatment as weather.
function parseSight(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200
    ? value.trim()
    : undefined;
}

// Sonder's notes (see groq.ts SONDER_NOTES_NOTE): kept on the phone, relayed
// for this one request, never stored or logged here. A little slack over
// MAX_NOTES_CHARS so a note written right at the limit is never rejected.
function parseNotes(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_NOTES_CHARS + 200
    ? value.trim()
    : undefined;
}

app.post("/chat", async (req, res) => {
  // First-conversation opener (2026-09-14 proactive instructions, item 3):
  // Sonder speaks first, so there's no user message to require.
  const opener = req.body?.opener === true;
  const message = opener ? "" : req.body?.message;
  if (!opener && (typeof message !== "string" || message.trim().length === 0)) {
    res.status(400).json({ error: "message (non-empty string) is required" });
    return;
  }
  const history = parseHistory(req.body?.history);
  // Per Part 22/25 item 9 — "opening" only means something on a session's
  // actual first turn. Originally gated on history.length === 0, but Part
  // 33's client-side persisted history means history is no longer empty on
  // a fresh app launch — the client now tracks and reports its own
  // sessionOpening flag (true only for the first send() since the app
  // process started), which this still enforces server-side rather than
  // trusting blindly: a stale/buggy client sending `presence` on a later
  // turn should be silently ignored, not bias every reply in the
  // conversation.
  const rawPresence = req.body?.presence;
  const sessionOpening = req.body?.sessionOpening === true;
  const openingPresence: Presence | undefined =
    sessionOpening && (rawPresence === "held" || rawPresence === "set-down")
      ? rawPresence
      : undefined;
  // Per Part 22/25 item 4 — unlike presence, an ongoing state: honored on
  // every turn the client reports it, not just the first.
  const headphonesConnected = req.body?.headphones === true;
  const traitWeights = parseTraitWeights(req.body?.traits);
  // Voice on/off toggle — only an explicit false means off, so builds that
  // predate the toggle (and never send it) keep the voice-on default.
  const spokenAloud = req.body?.voice !== false;
  // Sonder's own gender (set at onboarding) for grammatical agreement in
  // Spanish; anything else (older builds) means "not stated".
  const sonderGender =
    req.body?.sonderGender === "female" || req.body?.sonderGender === "male"
      ? (req.body.sonderGender as SonderGender)
      : undefined;
  const local = {
    localTime: parseShortText(req.body?.localTime),
    weather: parseShortText(req.body?.weather),
    sight: parseSight(req.body?.sight),
  };
  try {
    // Waits out any in-flight startup load instead of racing it — a real
    // fix, not just a longer window to still race within. Inside the try
    // block (not before it) so Express 4, which has no built-in async-
    // error handling, still turns a genuine init failure into the normal
    // 500 response below instead of hanging the request.
    await modelReadyPromise;
    // Retrieval keys off the current message only, not history — see
    // groq.ts's comment on generateReply for why.
    const examples = opener ? [] : await retrieveTopExamples(message);
    const { reply, mood, traitSignal, voiceOn } = await generateReply(
      message,
      history,
      examples,
      openingPresence,
      headphonesConnected,
      traitWeights,
      { spokenAloud, local, opener, sonderGender, userGender: parseUserGender(req.body?.userGender), notes: parseNotes(req.body?.notes) }
    );
    res.json({ reply, mood, traitSignal, voiceOn, retrievedExampleIds: examples.map((e) => e.id) });
  } catch (err) {
    console.error("[chat] error:", err);
    res.status(500).json({ error: "generation failed" });
  }
});

// Sonder rewrites its private notes from the latest diary pages. The phone
// sends the notes and pages, gets the new notes back, and keeps them; this
// server stores and logs none of it (only errors, never content).
app.post("/notes", async (req, res) => {
  const turns = parseHistory(req.body?.turns);
  if (turns.length === 0) {
    res.status(400).json({ error: "turns (non-empty array) is required" });
    return;
  }
  try {
    const notes = await updateNotes(parseNotes(req.body?.notes) ?? "", turns, parseUserGender(req.body?.userGender));
    res.json({ notes });
  } catch (err) {
    console.error("[notes] error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "notes failed" });
  }
});

// A photo pasted into the diary: Sonder looks once and gets back a few
// words to remember it by. The image is neither stored nor logged here.
const MAX_PHOTO_BASE64_CHARS = 2_500_000;
app.post("/photo", async (req, res) => {
  const image = req.body?.image;
  if (typeof image !== "string" || image.length === 0 || image.length > MAX_PHOTO_BASE64_CHARS) {
    res.status(400).json({ error: "image (base64 JPEG, under ~1.8 MB) is required" });
    return;
  }
  try {
    const description = await describePhoto(image, req.body?.spanish === true);
    res.json({ description });
  } catch (err) {
    console.error("[photo] error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "photo description failed" });
  }
});

// Part 27 voice-persona audition — lets the founder open a URL directly on
// the phone's browser to hear any of the six raw Orpheus presets, no
// console navigation needed. Kept around (not just for the initial pick)
// in case the founder wants to re-audition later; unlike /speak below, all
// six voices are reachable here, not just the two picked for end users.
app.get("/voice-sample", async (req, res) => {
  const voice = req.query.voice;
  if (typeof voice !== "string" || !ORPHEUS_VOICES.includes(voice as OrpheusVoice)) {
    res.status(400).json({ error: `voice must be one of: ${ORPHEUS_VOICES.join(", ")}` });
    return;
  }
  const text =
    typeof req.query.text === "string" && req.query.text.trim().length > 0
      ? req.query.text
      : "Hey — it's good to hear your voice. I've been looking forward to this.";
  try {
    const audio = await synthesizeSpeech(text, voice as OrpheusVoice);
    res.set("Content-Type", "audio/wav");
    res.send(audio);
  } catch (err) {
    console.error("[voice-sample] error:", err);
    res.status(500).json({ error: "speech synthesis failed" });
  }
});

// Real chat-integrated TTS — per founder decision 2026-08-17, the app
// offers exactly two voices for the user to choose between (autumn,
// troy), not the full six-preset set /voice-sample exposes for audition.
// GET (not POST) deliberately: the client points an audio player straight
// at this URL (createAudioPlayer({ uri })), which needs a plain fetchable
// URL, not a request the client has to make and pipe through a file
// itself.
app.get("/speak", async (req, res) => {
  const voice = req.query.voice;
  if (typeof voice !== "string" || !USER_VOICES.includes(voice as UserVoice)) {
    res.status(400).json({ error: `voice must be one of: ${USER_VOICES.join(", ")}` });
    return;
  }
  const text = req.query.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text (non-empty string) is required" });
    return;
  }
  try {
    const audio = await synthesizeSpeech(text, voice as UserVoice);
    res.set("Content-Type", "audio/wav");
    res.send(audio);
  } catch (err) {
    // Root cause confirmed 2026-08-17 (Part 29): not a length bug —
    // Groq's free/on-demand tier caps canopylabs/orpheus-v1-english at
    // 3600 tokens per day (TPD), org-wide across every user and every
    // test. A few voice replies exhausts it for the rest of the day.
    // Real usage needs Groq's paid Dev Tier for a workable quota — a
    // founder cost decision, not something fixable in code.
    console.error("[speak] error:", err);
    res.status(500).json({ error: "speech synthesis failed" });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// initEmbeddings() is already running (kicked off above, at module load —
// not here) so it starts loading the moment the process boots rather than
// waiting for listen() first. Calling it a second time here would double-
// load the model.
app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}, loading embedding model...`);
});
