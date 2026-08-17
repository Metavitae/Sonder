export type AudioRouteChangedPayload = {
  connected: boolean;
};

export type SonderAudioRouteModuleEvents = {
  onAudioRouteChanged: (params: AudioRouteChangedPayload) => void;
};
