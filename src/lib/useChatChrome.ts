import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { setStatusBarHidden } from "expo-status-bar";

// Founder report (2026-09-25): an empty band sat under the chat input with
// the keyboard closed. Cause is in RN 0.81's Android keyboard events under
// edge-to-edge (mandatory on Android 15+): keyboardDidHide reports the
// keyboard's top as the visible area's height, which excludes the status and
// navigation bars, so KeyboardAvoidingView kept ~240px of "keyboard" after it
// closed. keyboardDidShow's height (IME minus the navigation bar) is right, so
// on Android we take the height from show and force 0 on hide ourselves.
export function useKeyboardSpace(): number {
  const [space, setSpace] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setSpace(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setSpace(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return space;
}

const STATUS_BAR_HIDE_MS = 3000;

// Founder request (2026-09-26): the time/battery row should fade away after a
// while. Hidden after a few seconds without a touch; any touch brings it back
// and restarts the countdown. Restored when the screen unmounts.
export function useAutoHideStatusBar(): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidden = useRef(false);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      hidden.current = true;
      setStatusBarHidden(true, "fade");
    }, STATUS_BAR_HIDE_MS);
  }, []);

  const reveal = useCallback(() => {
    if (hidden.current) {
      hidden.current = false;
      setStatusBarHidden(false, "fade");
    }
    schedule();
  }, [schedule]);

  useEffect(() => {
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      setStatusBarHidden(false, "fade");
    };
  }, [schedule]);

  return reveal;
}
