import express from "express";
import { initEmbeddings, retrieveTopExamples } from "./embeddings.js";
import { generateReply } from "./groq.js";

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
  try {
    const examples = await retrieveTopExamples(message);
    const reply = await generateReply(message, examples);
    res.json({ reply, retrievedExampleIds: examples.map((e) => e.id) });
  } catch (err) {
    console.error("[chat] error:", err);
    // TEMPORARY: leaking the real error message to diagnose the first live
    // deploy failure without needing Render dashboard log access. Revert to
    // a generic message once diagnosed — this is a private pre-launch
    // service, not a public API, but still shouldn't leak internals
    // long-term.
    res.status(500).json({ error: "generation failed", detail: err instanceof Error ? err.message : String(err) });
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
