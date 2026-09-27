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
};

export type DiaryRow =
  | { kind: "date"; text: string }
  | {
      kind: "line";
      role: "user" | "sonder";
      text: string;
      ink?: MistColor;
      tone?: "pending" | "dream";
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
        rows.push({ kind: "date", text: formatDiaryDate(entry.at) });
        lastDay = day;
      }
    }
    const lines = measured.get(measureKey(entry)) ?? [entry.text];
    for (const text of lines) {
      rows.push({ kind: "line", role: entry.role, text, ink: entry.ink, tone: entry.tone });
    }
  }
  return rows;
}

export function paginate(rows: DiaryRow[], linesPerPage: number): DiaryRow[][] {
  const perPage = Math.max(1, linesPerPage);
  const pages: DiaryRow[][] = [];
  let page: DiaryRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // A date never sits alone at the foot of a page — it moves over with
    // the writing it introduces, the way you'd start the new day overleaf.
    const dateWouldBeLast = row.kind === "date" && page.length === perPage - 1;
    if (page.length >= perPage || (dateWouldBeLast && i < rows.length - 1)) {
      pages.push(page);
      page = [];
    }
    page.push(row);
  }
  pages.push(page);
  return pages;
}
