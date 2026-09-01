import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatMessage } from "./useSonderChat";

// Part 33 item 1 — cross-session memory. Deliberately local-device storage,
// not a backend user-context store: no accounts/auth exist yet (item 3),
// so there's no real user identity to key a backend row on. Migrate to a
// backend store once accounts land, per the founder's own call on this.
const STORAGE_KEY = "sonder_chat_history_v1";

// The server already caps what it sends to Groq to the last 40 items
// (MAX_HISTORY_TURNS in index.ts) — this cap is only about bounding
// on-device storage/scrollback, not the model's context window.
const MAX_STORED_MESSAGES = 200;

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
const ANY_MOOD_TAG_RE = /[*_`~]*\[\[mood:[^\]]*\]\][*_`~]*/gi;
const ANY_TRAIT_TAG_RE = /[*_`~]*\[\[trait:[^\]]*\]\][*_`~]*/gi;

function stripLeakedTags(text: string): string {
  return text.replace(ANY_MOOD_TAG_RE, "").replace(ANY_TRAIT_TAG_RE, "").trim();
}

export async function loadStoredMessages(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is ChatMessage =>
          !!m &&
          (m.role === "user" || m.role === "sonder") &&
          typeof m.text === "string"
      )
      .map((m) => ({ ...m, text: stripLeakedTags(m.text) }));
  } catch {
    // Corrupt/unreadable storage shouldn't crash the app — worst case,
    // this session starts blank, same as before memory existed.
    return [];
  }
}

export function persistMessages(messages: ChatMessage[]): void {
  const capped = messages
    .slice(-MAX_STORED_MESSAGES)
    .map((m) => ({ ...m, text: stripLeakedTags(m.text) }));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped)).catch(() => {});
}
