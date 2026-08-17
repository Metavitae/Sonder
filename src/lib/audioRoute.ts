import { useEffect, useState } from "react";
import SonderAudioRoute from "../../modules/sonder-audio-route/src/SonderAudioRouteModule";

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 22/25", item 4 —
// wraps the local SonderAudioRoute Expo module (modules/sonder-audio-route)
// in a plain hook, same shape as motion.ts's usePresence, so chat.tsx
// consumes it the same way it consumes the other ambient signals.
export function useHeadphonesConnected(): boolean {
  const [connected, setConnected] = useState(() => SonderAudioRoute.isHeadsetConnected());

  useEffect(() => {
    setConnected(SonderAudioRoute.isHeadsetConnected());
    const sub = SonderAudioRoute.addListener("onAudioRouteChanged", (event) => {
      setConnected(event.connected);
    });
    return () => sub.remove();
  }, []);

  return connected;
}
