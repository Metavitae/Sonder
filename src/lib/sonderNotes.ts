import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatMessage } from "./useSonderChat";
import { currentUserGender } from "./onboardingStorage";

// Diary build order step 3 — Sonder's notes (founder approved 2026-09-27,
// "fully private" 2026-09-28). The server only ever sees the last 40
// messages, so anything older Sonder simply didn't remember. Now Sonder
// keeps a few short notes about what matters, on this phone only; they
// travel with every message and the server forgets them again, as it
// forgets everything. The notes never show in the diary.
const STORAGE_KEY = "sonder_notes_v1";

// Rewrite the notes every NOTE_EVERY new messages. Must stay below the
// server's 40-message window (MAX_HISTORY_TURNS) so nothing ever slides out
// of what Sonder sees before it has been noted.
const NOTE_EVERY = 30;
// How much of the diary one rewrite reads — the new messages plus a little
// overlap for context.
const NOTE_READ_MAX = 40;

const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";

type Stored = { notes: string; notedThrough: number };

let cache: Stored | null = null;
let loading: Promise<Stored> | null = null;
let updating = false;

function load(): Promise<Stored> {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : null;
        cache =
          parsed && typeof parsed.notes === "string" && typeof parsed.notedThrough === "number"
            ? parsed
            : { notes: "", notedThrough: 0 };
        return cache!;
      })
      .catch(() => (cache = { notes: "", notedThrough: 0 }));
  }
  return loading;
}

function save(next: Stored) {
  cache = next;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

// What gets sent with each message ("" = no notes yet).
export async function currentSonderNotes(): Promise<string> {
  return (await load()).notes;
}

// Called whenever the diary changes. Quiet and best-effort: a failed
// rewrite just tries again on the next message, and never touches the chat.
export async function maybeUpdateSonderNotes(messages: ChatMessage[]): Promise<void> {
  if (updating || !API_BASE_URL) return;
  const stored = await load();
  // The diary got shorter than what was noted (e.g. history reset) — start
  // counting again from here.
  if (messages.length < stored.notedThrough) {
    save({ ...stored, notedThrough: messages.length });
    return;
  }
  if (messages.length - stored.notedThrough < NOTE_EVERY) return;
  updating = true;
  try {
    const through = messages.length;
    const turns = messages
      .slice(Math.max(0, through - NOTE_READ_MAX), through)
      .map((m) => ({ role: m.role, text: m.text }));
    const res = await fetch(`${API_BASE_URL}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: stored.notes, turns, userGender: await currentUserGender() }),
    });
    if (!res.ok) throw new Error(`server responded ${res.status}`);
    const data = (await res.json()) as { notes?: unknown };
    if (typeof data.notes !== "string") throw new Error("no notes in response");
    save({ notes: data.notes, notedThrough: through });
  } catch (err) {
    console.log("[notes] update failed", err instanceof Error ? err.message : String(err));
  } finally {
    updating = false;
  }
}
