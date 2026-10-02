import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatMessage } from "./useSonderChat";

// Part 33 item 1 — cross-session memory. Deliberately local-device storage,
// not a backend user-context store: no accounts/auth exist yet (item 3),
// so there's no real user identity to key a backend row on. Migrate to a
// backend store once accounts land, per the founder's own call on this.
// Founder, 2026-09-28: the old pre-diary chat kept carrying into the diary.
// v2 starts the diary blank; the v1 chat is deleted once on first load.
// (Android auto-backup is also off now — app.json allowBackup — so a
// reinstall can't bring it back either.)
const STORAGE_KEY = "sonder_chat_history_v2";
const OLD_STORAGE_KEYS = ["sonder_chat_history_v1"];

// The server already caps what it sends to Groq to the last 40 items
// (MAX_HISTORY_TURNS in index.ts) — this cap is only about bounding
// on-device storage, not the model's context window. Was 200 (scrollback
// only); raised 2026-09-27 because the chat is now a diary, and a diary
// can't quietly lose its old pages. 5000 entries stays well inside
// Android AsyncStorage's default 6 MB — move to file storage before any
// real user gets near it.
const MAX_STORED_MESSAGES = 5000;

// Real bug, resurfaced 2026-08-31 during Part 75/76 testing (same class as
// Part 71's "fixed for real this time"): [[mood:WARMTH:MED]] showed up as
// literal visible text in a *restored* conversation. Root-caused this time,
// per "Sonder - Direct Instructions for CC 2026-08-31 Part 76" item 2 — the
// server's strip regex (groq.ts's ANY_MOOD_TAG_RE/ANY_TRAIT_TAG_RE) only
// ever runs on a freshly generated reply, at generation time. It never
// touches a reply already sitting in this on-device store. Any row written
// before a fix like Part 71's shipped — or restored later by Android's
// app-data auto-backup — keeps its raw tag forever, since nothing ever
// re-processes old rows. This is the second time that exact gap has bitten,
// so the durable fix is defense-in-depth at the storage layer, not another
// generation-time patch: sanitize on load (covers whatever's already
// sitting in storage or gets restored from backup) AND on persist (so nothing
// unsanitized can ever be written going forward, regardless of source).
// Patterns duplicated from groq.ts's ANY_MOOD_TAG_RE/ANY_TRAIT_TAG_RE for
// the same reason Trait/Warmth/etc. already are (separate packages, no
// shared types module yet) — keep both sides in sync by hand if the tag
// format ever changes.
// Founder, 2026-10-02: widened to match groq.ts's LEAKED_TAG_RE — also catches
// half-written tags (one bracket, or never closed), not just [[...]].
const LEAKED_TAG_RE = /[*_`~]*\[{1,2}\s*(?:mood|trait|voice)\s*:[^\]\n]*(?:\]{1,2}|(?=\n|$))[*_`~]*/gi;

function stripLeakedTags(text: string): string {
  return text
    .replace(LEAKED_TAG_RE, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

// Founder, 2026-10-01: a diary that can't be read must never be saved over.
// `failed` means something IS stored but couldn't be read — the caller then
// shows an empty book but must not persist, or the first new line would
// replace the whole stored diary for good. Nothing stored = a new diary.
export type StoredHistory = { messages: ChatMessage[]; failed: boolean };

export async function loadStoredMessages(): Promise<StoredHistory> {
  try {
    AsyncStorage.multiRemove(OLD_STORAGE_KEYS).catch(() => {});
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], failed: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { messages: [], failed: true };
    const messages = parsed
      .filter(
        (m): m is ChatMessage =>
          !!m &&
          (m.role === "user" || m.role === "sonder") &&
          typeof m.text === "string"
      )
      .map((m) => ({ ...m, text: stripLeakedTags(m.text) }));
    return { messages, failed: false };
  } catch {
    // Corrupt/unreadable storage shouldn't crash the app — this session
    // starts blank, and the stored diary is left untouched for next time.
    return { messages: [], failed: true };
  }
}

export function persistMessages(messages: ChatMessage[]): void {
  const capped = messages
    .slice(-MAX_STORED_MESSAGES)
    .map((m) => ({ ...m, text: stripLeakedTags(m.text) }));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped)).catch(() => {});
}
