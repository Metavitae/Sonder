import { LogBox } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FreefallStartle } from "../components/FreefallStartle";
import { loadOnboardingState } from "../lib/onboardingStorage";

SplashScreen.preventAutoHideAsync();

// Accepted tradeoff (setup.tsx, Part 36-39 build order step 5): the
// birthdate wheel's three FlatLists are deliberately nested inside a
// vertical ScrollView so the Continue button stays reachable on short
// screens. At <=31 items per column this is far below where RN's real
// windowing/recycling concern bites — silencing just this one warning so
// it doesn't hide the actual UI during dev.
LogBox.ignoreLogs(["VirtualizedLists should never be nested"]);

export default function RootLayout() {
  // null = still loading — keep splash up rather than flashing index.tsx
  // before we know whether to redirect into onboarding (build order step 8).
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    loadOnboardingState().then((s) => {
      setOnboardingComplete(s.complete);
      SplashScreen.hideAsync();
    });
  }, []);

  if (onboardingComplete === null) return null;

  // Required for useSafeAreaInsets (chat.tsx's input row) to resolve real
  // system-bar insets — this app renders edge-to-edge (mandatory since RN
  // 0.76+, can't be opted out of), so content draws under the gesture/nav
  // bar without this.
  //
  // Stack.Protected (not a plain conditional Redirect/Slot swap) is
  // required here: this is the true router root, so a branch that skips
  // rendering any navigator at all leaves expo-router with nothing to
  // attach a Redirect's router.replace to, causing an infinite
  // null->false->redirect->remount loop (confirmed live on-device, build
  // order step 8/9 verification). Stack.Protected keeps the navigator
  // always mounted and both branches always declared, so gating never
  // tears down the router itself.
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={onboardingComplete}>
          <Stack.Screen name="index" />
          <Stack.Screen name="chat" />
        </Stack.Protected>
        <Stack.Protected guard={!onboardingComplete}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
      <FreefallStartle />
    </SafeAreaProvider>
  );
}
