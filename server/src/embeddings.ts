// Per "Sonder - Log - Embedding retrieval mechanism proposed, pending Faro
// review (Aug 11 2026)": all-MiniLM-L6-v2, no database — embeddings held as
// a plain in-memory array, precomputed once at startup. @xenova/transformers
// runs the model via ONNX Runtime in pure Node (no Python, no external
// embedding API/cost), keeping the whole stack in one language like the
// rest of this project.
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { EXAMPLE_LIBRARY, type LibraryExample } from "./library.js";

let extractor: FeatureExtractionPipeline | null = null;

type EmbeddedExample = LibraryExample & { embedding: Float32Array };
let libraryEmbeddings: EmbeddedExample[] = [];

async function embed(text: string): Promise<Float32Array> {
  if (!extractor) {
    throw new Error("Embedding model not loaded yet — call initEmbeddings() first");
  }
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data as Float32Array;
}

// Precomputes embeddings for every library example once. Re-run only if
// library content changes (matches the Aug 11 proposal's "storage" section)
// — this is deliberately called once at server startup, not per-request.
export async function initEmbeddings(): Promise<void> {
  extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  libraryEmbeddings = await Promise.all(
    EXAMPLE_LIBRARY.map(async (example) => ({
      ...example,
      // Embed the example's own user-side line — retrieval is matching
      // "what situation is this like," not comparing against the reply.
      embedding: await embed(example.userLine),
    }))
  );
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Query flow per the Aug 11 proposal: embed the message, cosine-similarity
// against every in-memory library embedding, return only the top-K closest
// matches (deliberately narrow — avoids prompt bloat and cost creep).
export async function retrieveTopExamples(
  message: string,
  topK = 2
): Promise<LibraryExample[]> {
  const queryEmbedding = await embed(message);
  return [...libraryEmbeddings]
    .sort(
      (a, b) =>
        cosineSimilarity(b.embedding, queryEmbedding) -
        cosineSimilarity(a.embedding, queryEmbedding)
    )
    .slice(0, topK)
    .map(({ embedding: _embedding, ...rest }) => rest);
}
