export type MusicAgentShell = {
  platform: string;
  isElectron: boolean;
  loginQQMusic: () => Promise<{ success: boolean; cookie?: string }>;
  getQQMusicCookieStatus: () => Promise<{ loggedIn: boolean; cookie: string }>;
};

declare global {
  interface Window {
    musicAgentShell?: MusicAgentShell;
  }
}
