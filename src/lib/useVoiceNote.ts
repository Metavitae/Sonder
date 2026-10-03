import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { File } from "expo-file-system";
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import { t } from "./i18n";

// Speaking to Sonder (Faro, Part 58 item 1, built 2026-10-03): record the
// whole turn, then turn it into text once — a voice message, not live
// transcription. The text is written on the page like anything typed; the
// recording is deleted from the phone as soon as it's been read, and the
// server passes it to Whisper without keeping it (server/src/voice.ts).

const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";

// Speech only: mono, 16 kHz, 32 kbps — about 4 KB a second, so even the
// longest turn stays far under the server's limit.
const VOICE_NOTE_OPTIONS: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 32000 },
};

// One turn stops itself here and is sent as it is.
export const VOICE_NOTE_MAX_MS = 3 * 60 * 1000;

export type VoiceNotePhase = "idle" | "recording" | "transcribing";

async function transcribe(base64: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: base64 }),
  });
  if (!res.ok) throw new Error(`server responded ${res.status}`);
  const data = (await res.json()) as { text?: unknown };
  if (typeof data.text !== "string") throw new Error("no text in response");
  return data.text.trim();
}

function deleteRecording(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone — nothing to do.
  }
}

// Tap once to start, tap again to send. `onText` gets what they said.
export function useVoiceNote(onText: (text: string) => void) {
  const recorder = useAudioRecorder(VOICE_NOTE_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<VoiceNotePhase>("idle");
  const phaseRef = useRef<VoiceNotePhase>("idle");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const setBoth = (p: VoiceNotePhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const releaseMic = () => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  };

  const start = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        t("Sonder can't hear you", "Sonder no te puede oír"),
        t(
          "Let Sonder use the microphone in Settings > Apps > Sonder > Permissions > Microphone.",
          "Deja que Sonder use el micrófono en Ajustes > Aplicaciones > Sonder > Permisos > Micrófono."
        )
      );
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setBoth("recording");
    } catch (err) {
      console.log("[voice-note] start failed", err instanceof Error ? err.message : String(err));
      releaseMic();
      setBoth("idle");
    }
  }, [recorder]);

  const finish = useCallback(async () => {
    if (phaseRef.current !== "recording") return;
    setBoth("transcribing");
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
      releaseMic();
      if (!uri) throw new Error("no recording");
      const text = await transcribe(await new File(uri).base64());
      if (text) {
        onTextRef.current(text);
      } else {
        Alert.alert(t("I didn't catch that", "No te alcancé a oír"), t("Try again, a little closer.", "Inténtalo otra vez, un poco más cerca."));
      }
    } catch (err) {
      console.log("[voice-note] failed", err instanceof Error ? err.message : String(err));
      Alert.alert(t("I couldn't hear that one", "No pude oír eso"), t("Please try again in a moment.", "Inténtalo de nuevo en un momento."));
    } finally {
      deleteRecording(uri);
      setBoth("idle");
    }
  }, [recorder]);

  // Part 58: the microphone never keeps listening once the app isn't in
  // front. Leaving mid-turn throws that turn away.
  const cancel = useCallback(async () => {
    if (phaseRef.current !== "recording") return;
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    deleteRecording(recorder.uri);
    releaseMic();
    setBoth("idle");
  }, [recorder]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") cancel();
    });
    return () => sub.remove();
  }, [cancel]);

  // The longest turn sends itself.
  useEffect(() => {
    if (phase === "recording" && recorderState.durationMillis >= VOICE_NOTE_MAX_MS) finish();
  }, [phase, recorderState.durationMillis, finish]);

  return {
    phase,
    elapsedMs: recorderState.durationMillis,
    toggle: () => (phaseRef.current === "recording" ? finish() : start()),
  };
}
