import SonderTts from "../../modules/sonder-tts/src/SonderTtsModule";
import type { UserVoice } from "./voicePreference";

// Per founder decision 2026-09-25: Sonder speaks with an on-device voice
// (Piper, run by the sonder-tts native module) so the voice never depends
// on a paid or quota-limited server. Orpheus (server) and the phone's
// built-in voice stay as fallbacks until this is proven on real phones.
//
// Licence matters here: only voices trained on public-domain / commercial-
// safe recordings can ship in Kithe. Piper "lessac" and "hfc_female" are
// research/non-commercial only and must not be used. "kristin" is trained
// on LibriVox recordings (public domain).
type LocalVoice = {
  // Folder name on the phone; bump it to force a fresh download.
  id: string;
  url: string;
  modelFile: string;
};

const LOCAL_VOICES: Partial<Record<UserVoice, LocalVoice>> = {
  // Founder's pick by ear, 2026-09-25 ("A or C" → Kristin; Cori was the
  // British alternative: vits-piper-en_GB-cori-medium / en_GB-cori-medium.onnx).
  autumn: {
    id: "piper-kristin-medium",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-kristin-medium.tar.bz2",
    modelFile: "en_US-kristin-medium.onnx",
  },
  // No male on-device voice picked yet — male Sonder keeps Orpheus "troy".
};

let preparing: Promise<void> | null = null;
let preparedFor: string | null = null;

// Downloads (once, ~65 MB) and warms up the on-device voice in the
// background. Safe to call often; only the first call per voice does work.
// Failures are swallowed: speaking just keeps using the fallbacks, and the
// next call retries.
export function prepareLocalVoice(voice: UserVoice): void {
  const local = LOCAL_VOICES[voice];
  if (!SonderTts || !local) return;
  if (preparing && preparedFor === local.id) return;
  preparedFor = local.id;
  preparing = (async () => {
    if (!SonderTts.isInstalled(local.id)) {
      await SonderTts.install(local.id, local.url);
    }
    await SonderTts.preload(local.id, local.modelFile);
  })().catch((e) => {
    console.log("[SonderVoice] local voice prepare failed", String(e));
    preparing = null;
    preparedFor = null;
  });
}

// True when this voice can be spoken on the phone right now.
export function hasLocalVoice(voice: UserVoice): boolean {
  const local = LOCAL_VOICES[voice];
  return !!SonderTts && !!local && SonderTts.isInstalled(local.id);
}

// Resolves true if the line played to the end on-device, false if it was
// cut off by a newer line. Throws if the on-device voice failed, so the
// caller can fall back.
export function speakLocally(text: string, voice: UserVoice): Promise<boolean> {
  const local = LOCAL_VOICES[voice];
  if (!SonderTts || !local) return Promise.reject(new Error("No local voice"));
  return SonderTts.speak(local.id, local.modelFile, text);
}

export function stopLocalVoice(): void {
  SonderTts?.stop();
}
