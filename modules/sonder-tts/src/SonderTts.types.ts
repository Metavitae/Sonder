export type InstallProgressEvent = {
  voiceId: string;
  fraction: number;
};

export type SonderTtsModuleEvents = {
  onInstallProgress: (event: InstallProgressEvent) => void;
};
