import * as Notifications from "expo-notifications";
import { ALL_SENSES } from "./senses";

// Per "Sonder - Direct Instructions for CC 2026-08-31 Part 76" item 1
// (Option 3, founder-confirmed): the dream state's only signal used to be a
// screen overlay, which never actually fired for anyone in real use — the
// 2026-08-31 forced-screen-on retest confirmed the root cause was
// screen_off_timeout locking the device before IDLE_THRESHOLD_MS was ever
// reached, not a rendering bug. Founder's call: don't fight that with a
// wake lock or forced-awake hack (real battery cost for a decorative effect
// almost nobody would see) — replace the screen-dependent visual's role
// with something that survives the screen actually being locked. A local
// notification does: Android still posts/vibrates it with the screen off
// or the app backgrounded, no special power state needed.
//
// Gated on the existing "notifications" sense (Part 57/58's permits panel)
// — never fires if the user hasn't granted it, same discipline as every
// other sense in this project (senses.ts). The in-app dim overlay + dream
// bubble (chat.tsx) stay as-is for whenever the screen does happen to be
// on — this is the durable path alongside them, not a replacement for them.
const notificationsSense = ALL_SENSES.find((s) => s.id === "notifications");

export async function notifyDreaming(line: string): Promise<void> {
  try {
    if (!notificationsSense || !(await notificationsSense.isGranted())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: "Sonder", body: line },
      trigger: null,
    });
  } catch {
    // A missed notification shouldn't break the dream-state transition —
    // same fallback discipline as chatHistory.ts/characterTraits.ts.
  }
}
