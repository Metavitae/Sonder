import { useEffect } from "react";
import { BackHandler, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { setTestClockDays } from "../lib/testClock";

// Test path only (see testClock.ts): sets the date shift, then closes the
// app; the next launch writes entries on the shifted day.
export default function TestDate() {
  const { days } = useLocalSearchParams<{ days?: string }>();
  useEffect(() => {
    setTestClockDays(Number(days) || 0)
      .catch(() => {})
      .finally(() => BackHandler.exitApp());
  }, [days]);
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}
