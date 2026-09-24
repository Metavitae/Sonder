import { useEffect } from "react";
import { AppState } from "react-native";

// Founder, 2026-09-23: Sonder's first reply (and first spoken line) was slow
// because the Render free tier puts sonder-server to sleep after ~15 min
// without traffic, and waking it takes ~25-50s. This pings /health the moment
// the app opens or comes back to the foreground, so the server is already
// awake by the time anyone reaches the chat. While the app stays open it
// keeps pinging every 10 min, under Render's idle cutoff.
const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";
const KEEP_WARM_MS = 10 * 60 * 1000;

function pingServer() {
  if (!API_BASE_URL) return;
  // Fire-and-forget: a failed ping just means the first real request wakes
  // the server instead, same as before this existed.
  fetch(`${API_BASE_URL}/health`, { cache: "no-store" }).catch(() => {});
}

export function useServerWarmup() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      pingServer();
      if (!timer) timer = setInterval(pingServer, KEEP_WARM_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, []);
}
