# Sonder retrieval/embedding backend

Deploys the mechanism locked in "Sonder - Example-Library Retrieval Scope
and Mechanism (canonical 2026-08-09)" and "Sonder - Log - Embedding
retrieval mechanism proposed, pending Faro review (Aug 11 2026)": embed the
user's message with `all-MiniLM-L6-v2` (via `@xenova/transformers`, pure
Node — no Python, no per-call embedding API cost), cosine-similarity it
against an in-memory library of examples, feed the top matches into a Groq
chat completion as tone/register grounding.

## The library content

`src/library.ts` holds "Sonder Example Library — Batch 1 (canonical
2026-08-13)" — 25 real, hand-reviewed examples across Comfort, Disclosure,
Advice-Seeking, and Challenge (per the Aug 9 canonical scope decision).
This is a v1 starting set, not a ceiling — future batches expand it via the
generator tool referenced in that doc, run through the Two-Tier Quality
Framework's automated filter. Each example's `userLine` is what gets
embedded and matched; the full exchange (plus any per-example or
per-function guidance note) is what's fed to Groq as grounding once
retrieved — see `groq.ts`.

## Local dev

```
cd server
npm install
cp .env.example .env   # fill in GROQ_API_KEY
npm run dev
```

`GET /health` — cheap, immediate, doesn't wait on the model. `POST /chat`
with `{"message": "..."}` — retrieves grounding examples and returns a
generated reply.

## Deploying to Render

`render.yaml` at the repo root is a Blueprint spec (rootDir: `server`, free
plan). In the Render dashboard: **New → Blueprint**, select the
`Metavitae/Sonder` repo. Render reads `render.yaml` automatically. The one
thing to fill in by hand in Render's dashboard (never committed —
`render.yaml` marks it `sync: false`): **`GROQ_API_KEY`**, pasted directly
into Render's own env-var field.

Free-tier note (per "Sonder - Backend Hosting Render (canonical
2026-08-13)"): the service sleeps after inactivity; the first request after
a cold spell pays a real reload delay (~90MB model). That's the accepted
tradeoff addressed by the cold-start character messages on the client side.
