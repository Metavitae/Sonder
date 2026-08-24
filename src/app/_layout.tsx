import { LogBox } from "react-native";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FreefallStartle } from "../components/FreefallStartle";

SplashScreen.preventAutoHideAsync();

// Accepted tradeoff (setup.tsx, Part 36-39 build order step 5): the
// birthdate wheel's three FlatLists are deliberately nested inside a
// vertical ScrollView so the Continue button stays reachable on short
// screens. At <=31 items per column this is far below where RN's real
// windowing/recycling concern bites — silencing just this one warning so
// it doesn't hide the actual UI during dev.
LogBox.ignoreLogs(["VirtualizedLists should never be nested"]);

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
