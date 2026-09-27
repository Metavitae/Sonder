import { Redirect } from "expo-router";

// Founder decision 2026-09-27: Sonder is a diary, and a diary opens straight
// to its pages — the app lands on /chat (the diary) every launch. The old
// launch screen (the camera "sight" sense with a "Talk to Sonder →" link)
// lives on at sense-test.tsx until the camera moves into the diary itself.
export default function Index() {
  return <Redirect href={"/chat" as never} />;
}
