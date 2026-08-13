#!/usr/bin/env node
// Generates the sprite-sheet texture atlas for SpriteMistPoC.tsx — Part 18
// option 3 ("Sonder - Direct Instructions for CC 2026-08-11, Part 18"):
// pre-rendered frames as a texture atlas, GPU texture sampling instead of
// video decode. This is a build-time asset generator, not app code: it runs
// once in Node (via pngjs, already present in node_modules as a transitive
// dep — no new dependency needed) to bake a uniform grid of frames, one row
// per mist color, each row a looping sequence of a soft drifting blob. The
// app only ever reads the resulting PNG + this same layout math at runtime;
// it never computes noise or a shader per pixel per frame, which is the
// actual thing under test versus ProceduralMistPoC (option 1).
//
// Placeholder art, same spirit as the hand-authored Lottie JSON for option
// 2: proving the mechanism performs on real hardware, not a color-match or
// final-art exercise.
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const FRAME_SIZE = 96;
const FRAMES_PER_COLOR = 12;
const COLORS = ["violet", "magenta", "cyan", "amber", "blue"];

// Same approximate palette as ProceduralMistPoC's MIST_RGB, 0-255 range.
const MIST_RGB = {
  violet: [107, 61, 184],
  magenta: [199, 46, 140],
  cyan: [38, 166, 199],
  amber: [217, 140, 38],
  blue: [46, 82, 209],
};

const width = FRAME_SIZE * FRAMES_PER_COLOR;
const height = FRAME_SIZE * COLORS.length;
const png = new PNG({ width, height });

function gaussian(dx, dy, sigma) {
  const d2 = dx * dx + dy * dy;
  return Math.exp(-d2 / (2 * sigma * sigma));
}

for (let row = 0; row < COLORS.length; row++) {
  const [r, g, b] = MIST_RGB[COLORS[row]];
  for (let frame = 0; frame < FRAMES_PER_COLOR; frame++) {
    const t = frame / FRAMES_PER_COLOR;
    const angle = t * Math.PI * 2;
    const cx = FRAME_SIZE / 2;
    const cy = FRAME_SIZE / 2;
    // Two blobs orbiting out of phase so the loop reads as drifting fog,
    // not a single pulsing dot — same organic-loop intent as the Lottie
    // blob keyframes in option 2, expressed as pre-baked raster math here
    // instead of live shape-layer animation.
    const c1x = cx + Math.cos(angle) * 22;
    const c1y = cy + Math.sin(angle) * 22;
    const c2x = cx + Math.cos(angle * 1.3 + Math.PI) * 16;
    const c2y = cy + Math.sin(angle * 1.3 + Math.PI) * 16;

    for (let y = 0; y < FRAME_SIZE; y++) {
      for (let x = 0; x < FRAME_SIZE; x++) {
        const brightness = Math.min(
          1,
          gaussian(x - c1x, y - c1y, 26) * 0.75 +
            gaussian(x - c2x, y - c2y, 20) * 0.6
        );
        const idx = ((row * FRAME_SIZE + y) * width + (frame * FRAME_SIZE + x)) << 2;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = Math.round(brightness * 255);
      }
    }
  }
}

const outDir = path.join(__dirname, "..", "assets", "mist", "sprites");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "mist_atlas.png");
png.pack().pipe(fs.createWriteStream(outPath)).on("finish", () => {
  console.log(`Wrote ${outPath} (${width}x${height})`);
});

fs.writeFileSync(
  path.join(outDir, "mist_atlas_manifest.json"),
  JSON.stringify({ frameSize: FRAME_SIZE, framesPerColor: FRAMES_PER_COLOR, colors: COLORS }, null, 2)
);
console.log("Wrote mist_atlas_manifest.json");
