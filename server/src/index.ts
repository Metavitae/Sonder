import express from "express";
import { initEmbeddings, retrieveTopExamples } from "./embeddings.js";
import { generateReply, type ChatTurn } from "./groq.js";

// Server-side cap on how much history a single request can carry — a
// safeguard against unbounded token/cost growth from a buggy or malicious
// client, not something the product design asked for. Well above what a
// real conversation screen would realistically send in one turn.
const MAX_HISTORY_TURNS = 40;

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

const app = express();
app.use(express.json());

const startedAt = Date.now();
let modelReady = false;

// Cheap and immediate — never waits on the embedding model — so the client
// can use response latency here as a real cold-start signal (Render's
// free-tier spin-up-after-sleep delay dominates process boot time, not
// just model load).
app.get("/health", (_req, res) => {
  res.json({ status: "ok", modelReady, uptimeMs: Date.now() - startedAt });
});

app.post("/chat", async (req, res) => {
  const message = req.body?.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message (non-empty string) is required" });
    return;
  }
  const history = parseHistory(req.body?.history);
  try {
    // Retrieval keys off the current message only, not history — see
    // groq.ts's comment on generateReply for why.
    const examples = await retrieveTopExamples(message);
    const { reply, mood } = await generateReply(message, history, examples);
    res.json({ reply, mood, retrievedExampleIds: examples.map((e) => e.id) });
  } catch (err) {
    console.error("[chat] error:", err);
    res.status(500).json({ error: "generation failed" });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}, loading embedding model...`);
  initEmbeddings()
    .then(() => {
      modelReady = true;
      console.log("[server] embedding model ready");
    })
    .catch((err) => {
      console.error("[server] failed to load embedding model:", err);
    });
});
