import { NativeModule, requireOptionalNativeModule } from "expo";

import { SonderTtsModuleEvents } from "./SonderTts.types";

declare class SonderTtsModule extends NativeModule<SonderTtsModuleEvents> {
  isInstalled(voiceId: string): boolean;
  install(voiceId: string, url: string): Promise<boolean>;
  preload(voiceId: string, modelFile: string): Promise<boolean>;
  speak(voiceId: string, modelFile: string, text: string): Promise<boolean>;
  stop(): void;
}

// Optional: null on platforms/builds without the native side (iOS, web,
// or an older installed APK), so callers fall back to the server voice.
export default requireOptionalNativeModule<SonderTtsModule>("SonderTts");
