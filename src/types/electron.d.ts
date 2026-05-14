export type MusicAgentShell = {
  platform: string;
  isElectron: boolean;
  loginQQMusic: () => Promise<{ success: boolean }>;
  getQQMusicCookieStatus: () => Promise<{ loggedIn: boolean }>;
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
