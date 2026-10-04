import AsyncStorage from "@react-native-async-storage/async-storage";

// Founder, 2026-10-03: users can rename Sonder, at sign-up or by asking it
// ("I'd like to call you Luna" — the server spots the request and sends the
// new name back). Kept on this phone only; sent with each message so Sonder
// goes by it. Its own key, so older saved sign-ups stay valid.
const STORAGE_KEY = "sonder_name_v1";
export const DEFAULT_SONDER_NAME = "Sonder";
export const MAX_SONDER_NAME_CHARS = 24;

let cached: string | null = null;
let loading: Promise<string> | null = null;

function clean(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, MAX_SONDER_NAME_CHARS);
  return trimmed || DEFAULT_SONDER_NAME;
}

export function currentSonderName(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (cached = clean(raw ?? DEFAULT_SONDER_NAME)))
      .catch(() => (cached = DEFAULT_SONDER_NAME));
  }
  return loading;
}

export function setSonderName(name: string) {
  cached = clean(name);
  AsyncStorage.setItem(STORAGE_KEY, cached).catch(() => {});
}
