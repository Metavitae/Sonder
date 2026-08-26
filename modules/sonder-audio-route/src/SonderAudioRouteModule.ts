import { NativeModule, requireNativeModule } from "expo";

import { SonderAudioRouteModuleEvents } from "./SonderAudioRoute.types";

declare class SonderAudioRouteModule extends NativeModule<SonderAudioRouteModuleEvents> {
  isHeadsetConnected(): boolean;
  hasAudioOutput(): boolean;
  hasMicrophone(): boolean;
  hasNotificationService(): boolean;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<SonderAudioRouteModule>("SonderAudioRoute");
