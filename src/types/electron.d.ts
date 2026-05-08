export type MusicAgentShell = {
  platform: string;
  isElectron: boolean;
  loginQQMusic: () => Promise<{ success: boolean; cookie?: string }>;
  getQQMusicCookieStatus: () => Promise<{ loggedIn: boolean; cookie: string }>;
  logoutQQMusic: () => Promise<{ success: boolean }>;
  getQQMusicPlayUrl: (songmid: string) => Promise<{ url: string | null; error: string | null }>;
  getMicrophoneStatus?: () => Promise<{
    platform: string;
    status: string;
    canOpenSettings: boolean;
  }>;
  openMicrophoneSettings?: () => Promise<{ success: boolean }>;
};

declare global {
  interface Window {
    musicAgentShell?: MusicAgentShell;
  }
}
