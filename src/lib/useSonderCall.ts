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
import { requestChat, type ChatMessage } from "./useSonderChat";
import { noteCall } from "./sonderNotes";
import type { TraitWeights } from "./characterTraits";

// A call with Sonder (founder, 2026-10-03). The mic is only for talking
// with Sonder — writing stays typed. Tap to talk, tap again to send; Sonder
// answers by voice only and nothing goes on the page. Sonder sees the page
// they have open. The call disappears when it ends (End call, or leaving the
// app — no exceptions); what mattered goes into Sonder's private notes.
// Each recording goes once to POST /transcribe and is deleted right after.

const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";

// Speech only: mono, 16 kHz, 32 kbps — about 4 KB a second.
const TURN_OPTIONS: RecordingOptions = {
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

// One turn sends itself at this length.
export const CALL_TURN_MAX_MS = 3 * 60 * 1000;

// off: no call. ready: on a call, waiting for them to tap Talk.
// recording: they're talking. thinking: turning it into words / Sonder
// answering.
export type CallPhase = "off" | "ready" | "recording" | "thinking";

type CallContext = {
  // The diary page as Sonder should see it right now, including what
  // they're in the middle of writing.
  getPage: () => string;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  headphonesConnected?: boolean;
  traitWeights?: TraitWeights;
};

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

export function useSonderCall(context: CallContext) {
  const recorder = useAudioRecorder(TURN_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<CallPhase>("off");
  const phaseRef = useRef<CallPhase>("off");
  // This call's words — never saved, gone when it ends.
  const turnsRef = useRef<ChatMessage[]>([]);
  const contextRef = useRef(context);
  contextRef.current = context;

  // Read fresh each time: the call can end while a turn is still on its way.
  const phaseNow = (): CallPhase => phaseRef.current;
  const setBoth = (p: CallPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const start = useCallback(async () => {
    if (phaseRef.current !== "off") return;
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
    turnsRef.current = [];
    setBoth("ready");
  }, []);

  const end = useCallback(async () => {
    if (phaseRef.current === "off") return;
    if (phaseRef.current === "recording") {
      try {
        await recorder.stop();
      } catch {
        // Already stopped.
      }
      deleteRecording(recorder.uri);
    }
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    contextRef.current.stopSpeaking();
    const turns = turnsRef.current.map((m) => ({ role: m.role, text: m.text }));
    turnsRef.current = [];
    setBoth("off");
    // Best effort, after the call is already gone from the screen.
    noteCall(turns);
  }, [recorder]);

  const talk = useCallback(async () => {
    if (phaseRef.current !== "ready") return;
    contextRef.current.stopSpeaking();
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setBoth("recording");
    } catch (err) {
      console.log("[call] record failed", err instanceof Error ? err.message : String(err));
      setBoth("ready");
    }
  }, [recorder]);

  const send = useCallback(async () => {
    if (phaseRef.current !== "recording") return;
    setBoth("thinking");
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (!uri) throw new Error("no recording");
      const said = await transcribe(await new File(uri).base64());
      deleteRecording(uri);
      uri = null;
      if (phaseNow() !== "thinking") return; // the call ended meanwhile
      if (!said) {
        contextRef.current.speak(t("I didn't catch that.", "No te alcancé a oír."));
        return;
      }
      const ctx = contextRef.current;
      const data = await requestChat(
        said,
        turnsRef.current,
        false,
        undefined,
        ctx.headphonesConnected,
        ctx.traitWeights,
        true,
        false,
        null,
        { call: true, page: ctx.getPage() }
      );
      if (phaseNow() !== "thinking") return;
      turnsRef.current = [
        ...turnsRef.current,
        { role: "user", text: said },
        { role: "sonder", text: data.reply },
      ];
      ctx.speak(data.reply);
    } catch (err) {
      console.log("[call] turn failed", err instanceof Error ? err.message : String(err));
      if (phaseNow() === "thinking") {
        contextRef.current.speak(t("I lost you for a second. Say it again?", "Te perdí un segundo. ¿Me lo repites?"));
      }
    } finally {
      deleteRecording(uri);
      if (phaseNow() === "thinking") setBoth("ready");
    }
  }, [recorder]);

  // Leaving the app ends the call. No exceptions.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") end();
    });
    return () => sub.remove();
  }, [end]);

  // The longest turn sends itself.
  useEffect(() => {
    if (phase === "recording" && recorderState.durationMillis >= CALL_TURN_MAX_MS) send();
  }, [phase, recorderState.durationMillis, send]);

  return {
    phase,
    elapsedMs: recorderState.durationMillis,
    start,
    end,
    // The one Talk button: start talking, or send what was said.
    talkOrSend: () => (phaseRef.current === "recording" ? send() : talk()),
  };
}
