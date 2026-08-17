import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FreefallStartle } from "../components/FreefallStartle";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  // Required for useSafeAreaInsets (chat.tsx's input row) to resolve real
  // system-bar insets — this app renders edge-to-edge (mandatory since RN
  // 0.76+, can't be opted out of), so content draws under the gesture/nav
  // bar without this.
  return (
    <SafeAreaProvider>
      <Slot />
      <FreefallStartle />
    </SafeAreaProvider>
  );
}
