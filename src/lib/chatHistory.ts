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

export async function loadStoredMessages(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "sonder") &&
        typeof m.text === "string"
    );
  } catch {
    // Corrupt/unreadable storage shouldn't crash the app — worst case,
    // this session starts blank, same as before memory existed.
    return [];
  }
}

export function persistMessages(messages: ChatMessage[]): void {
  const capped = messages.slice(-MAX_STORED_MESSAGES);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped)).catch(() => {});
}
