import type { MistColor } from "./mistAtlas";
import { uiSpanish } from "./i18n";

// Diary redesign (founder, 2026-09-27): Sonder is "a diary with
// personality". Pages fill up like a real notebook (~18-20 ruled lines on a
// phone, about a pocket notebook), writing flows onto the next page, and a
// new day adds a small date line wherever the writing happens to be — NOT
// one page per day (founder: that "loses the feeling of being a diary").
//
// This file is the pure part: given each entry already broken into the
// lines it occupies at the page's width (measured by the real Text engine
// in DiaryBook — see measureKey), build the ruled rows and cut them into
// pages. Every row is exactly one ruled line tall.

export type Paper = "white" | "brown";

export type DiaryEntry = {
  key: string;
  role: "user" | "sonder";
  text: string;
  at?: number;
  ink?: MistColor;
  // Transient lines (Sonder thinking, dozing, waking) — drawn like Sonder's
  // writing but never stored.
  tone?: "pending" | "dream";
  // A photo pasted onto the page (local file on this phone).
  photoUri?: string;
};

// A pasted photo takes this many ruled lines of the page, like a snapshot
// tucked into a pocket notebook.
export const PHOTO_LINES = 7;

export type DiaryRow =
  | { kind: "date"; text: string }
  // An empty ruled line left before a new day (founder, 2026-10-01: "a line
  // or two of spacing" between one day's writing and the next date).
  | { kind: "gap" }
  | { kind: "photo"; uri: string; entryKey: string; at?: number }
  | {
      kind: "line";
      role: "user" | "sonder";
      text: string;
      ink?: MistColor;
      tone?: "pending" | "dream";
      // Which entry, and which of its lines — what a bookmark anchors to.
      entryKey: string;
      lineIdx: number;
      at?: number;
    };

// Stable per entry and per text, so an edit (or a transient line changing
// its words) is re-measured but an unchanged entry never is.
export function measureKey(entry: DiaryEntry): string {
  return `${entry.key}:${entry.role}:${entry.tone ?? ""}:${entry.text}`;
}

function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatDiaryDate(at: number): string {
  try {
    return new Date(at).toLocaleDateString(uiSpanish ? "es-MX" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return new Date(at).toDateString();
  }
}

export function buildRows(
  entries: DiaryEntry[],
  measured: Map<string, string[]>
): DiaryRow[] {
  const rows: DiaryRow[] = [];
  let lastDay: string | null = null;
  for (const entry of entries) {
    // Entries written before dates were kept (pre-2026-09-27) carry none —
    // they just continue the page with no heading, like an undated start.
    if (entry.at !== undefined) {
      const day = dayKey(entry.at);
      if (day !== lastDay) {
        if (rows.length > 0) rows.push({ kind: "gap" });
        rows.push({ kind: "date", text: formatDiaryDate(entry.at) });
        lastDay = day;
      }
    }
    if (entry.photoUri) {
      rows.push({ kind: "photo", uri: entry.photoUri, entryKey: entry.key, at: entry.at });
      continue;
    }
    const lines = measured.get(measureKey(entry)) ?? [entry.text];
    lines.forEach((text, lineIdx) => {
      rows.push({
        kind: "line",
        role: entry.role,
        text,
        ink: entry.ink,
        tone: entry.tone,
        entryKey: entry.key,
        lineIdx,
        at: entry.at,
      });
    });
  }
  return rows;
}

// How many ruled lines a row takes up — one, except a photo.
export function rowLines(row: DiaryRow): number {
  return row.kind === "photo" ? PHOTO_LINES : 1;
}

export function pageLines(page: DiaryRow[]): number {
  return page.reduce((n, row) => n + rowLines(row), 0);
}

export function paginate(rows: DiaryRow[], linesPerPage: number): DiaryRow[][] {
  const perPage = Math.max(PHOTO_LINES, linesPerPage);
  const pages: DiaryRow[][] = [];
  let page: DiaryRow[] = [];
  let used = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const size = rowLines(row);
    // A date never sits alone at the foot of a page — it moves over with
    // the writing it introduces, the way you'd start the new day overleaf.
    const dateWouldBeLast = row.kind === "date" && used === perPage - 1;
    // A photo is never cut in half — if it doesn't fit, it starts the next page.
    if (used + size > perPage || (dateWouldBeLast && i < rows.length - 1)) {
      pages.push(page);
      page = [];
      used = 0;
    }
    // A blank line never opens a page — the new day just starts overleaf.
    // (Checked after the break: a full page used to push the blank line
    // onto the top of the next one — 8T, 2026-10-01.)
    if (row.kind === "gap" && used === 0) continue;
    page.push(row);
    used += size;
  }
  pages.push(page);
  return pages;
}
