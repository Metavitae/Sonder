import Groq from "groq-sdk";
import type { LibraryExample } from "./library.js";

// GROQ_MODEL is deliberately configurable, not hardcoded: the canonical
// docs lock the retrieval mechanism and embedding model, but never lock a
// specific Groq-hosted conversational model for the live chat call itself
// (only that generation for the example library used "Gemma/Groq-routed
// models" — a different use case). Defaulting to a current Groq general-
// purpose model as a working placeholder; override via GROQ_MODEL when a
// real choice is made.
// `||`, not `??` — Render's dashboard leaves a cleared env var set to an
// empty string rather than deleting it, and `??` only falls back on
// null/undefined, so it was silently passing "" as the model name.
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Section-level governing principles from "Sonder Example Library — Batch 1
// (canonical 2026-08-13)" that apply to every example in a function rather
// than one specific row — kept here instead of duplicated per library entry.
const FUNCTION_GUIDANCE: Partial<Record<LibraryExample["fn"], string>> = {
  "Advice-Seeking":
    "Depth scales with stakes — light reaction for low-stakes choices, real follow-through for high-stakes ones.",
  Challenge:
    "Used sparingly — only once trust exists in the conversation, roughly 30% of the empathy/challenge mix. Questions paired with pushback are appropriate here, unlike elsewhere — that's what makes it a challenge rather than just a correction.",
};

function formatExample(ex: LibraryExample): string {
  const lines = [
    `[${ex.fn}] ${ex.title}`,
    `User: ${ex.userLine}`,
    `Sonder: ${ex.sonderLine}`,
  ];
  if (ex.note) lines.push(`(Note: ${ex.note})`);
  const guidance = FUNCTION_GUIDANCE[ex.fn];
  if (guidance) lines.push(`(${ex.fn} guidance: ${guidance})`);
  return lines.join("\n");
}

export type Warmth = "warm" | "cool" | "neutral";
export type Arousal = "low" | "med" | "high";
export type Mood = { warmth: Warmth; arousal: Arousal };
export type ChatTurn = { role: "user" | "sonder"; text: string };

const DEFAULT_MOOD: Mood = { warmth: "neutral", arousal: "med" };

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 21 Addendum":
// same mood-tag convention as the earlier HTML prototype (Part 13's doc) —
// the model ends each reply with an invisible tag, parsed and stripped
// server-side (never shown to the client, same "raw mechanism stays
// server/dev-side" discipline as the rest of this project) to drive the
// mist's color/pulse. Exact tag syntax wasn't specified anywhere prior —
// [[mood:WARMTH:AROUSAL]] on its own trailing line, chosen for being both
// easy for the model to reproduce exactly and trivial to regex out.
const MOOD_TAG_INSTRUCTION =
  "After your reply, on its own new line, append exactly one tag in this " +
  "form: [[mood:WARMTH:AROUSAL]] — WARMTH is one of warm/cool/neutral, " +
  "AROUSAL is one of low/med/high, reflecting the emotional tone of your " +
  "own reply. This tag is invisible to the user; it will be stripped " +
  "before display, so always include it exactly in this format.";

// Real bug found 2026-08-14 (founder's first live test, Part 24):
// reproduced directly — a question touching Sonder's own memory/nature
// ("do you remember my dog's name," never actually mentioned) made the
// model break character into generic "I'm a conversational AI, I don't
// have prior knowledge about you" disclaimer boilerplate, even with
// retrieval-grounded examples in context. The examples nudge tone for
// emotional content but don't cover this specific topic, so the model's
// default RLHF self-disclosure instinct won when asked about itself. This
// doesn't ask the model to be dishonest — it's fine and true to say "you
// haven't told me that yet" — just to say it as Sonder, not as a generic
// assistant reciting its own limitations.
const STAY_IN_CHARACTER_INSTRUCTION =
  "Stay in character as Sonder at all times, including when asked about " +
  "your own memory, nature, or limitations. It's fine to say something " +
  "hasn't come up yet or that you don't know it — but say that the way " +
  "Sonder would, warm and present, never as a generic AI assistant " +
  "reciting a disclaimer (\"I'm a conversational AI,\" \"I don't have " +
  "prior knowledge about you,\" \"I'm a new conversation each time,\" " +
  "and similar phrasing are never acceptable, regardless of what's asked).";

const MOOD_TAG_RE = /\[\[mood:(warm|cool|neutral):(low|med|high)\]\]\s*$/i;

function extractMood(raw: string): { reply: string; mood: Mood } {
  const match = raw.match(MOOD_TAG_RE);
  if (!match) {
    // Not a hard failure — the chat still works, just without a mood
    // signal for that turn. Logged so a consistently-missing tag (e.g. the
    // model ignoring the instruction) is visible in Render's logs.
    console.warn("[mood] no tag found in reply, defaulting:", raw.slice(-80));
    return { reply: raw.trim(), mood: DEFAULT_MOOD };
  }
  const warmth = match[1].toLowerCase() as Warmth;
  const arousal = match[2].toLowerCase() as Arousal;
  return { reply: raw.slice(0, match.index).trim(), mood: { warmth, arousal } };
}

// Per "Sonder - Example-Library Retrieval Scope and Mechanism (canonical
// 2026-08-09)": retrieval happens server-side, right before the Groq call —
// pulls the closest-matching examples and feeds them into the prompt as
// guidance, not as text the model should quote verbatim. Retrieval keys off
// the current message only, per that doc's "reads the moment's tone" —
// history (added per Part 21 Addendum) is conversational context for the
// model, not part of what the retrieval query embeds.
export async function generateReply(
  message: string,
  history: ChatTurn[],
  retrievedExamples: LibraryExample[]
): Promise<{ reply: string; mood: Mood }> {
  const groundingBlock = retrievedExamples.map(formatExample).join("\n\n");

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are Sonder. Below are retrieved example exchanges closest to " +
          "this moment — let them guide your tone, register, and technique. " +
          "Never quote them verbatim; the current message is a different " +
          "situation even when the shape is similar.\n\n" +
          groundingBlock +
          "\n\n" +
          STAY_IN_CHARACTER_INSTRUCTION +
          "\n\n" +
          MOOD_TAG_INSTRUCTION,
      },
      ...history.map((turn) => ({
        role: (turn.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: turn.text,
      })),
      { role: "user", content: message },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  return extractMood(raw);
}

let client: Groq | null = null;
function getClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set");
    }
    client = new Groq({ apiKey });
  }
  return client;
}
