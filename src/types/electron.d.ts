export type MusicAgentShell = {
  platform: string;
  isElectron: boolean;
  loginQQMusic: () => Promise<{ success: boolean; cookie?: string }>;
  getQQMusicCookieStatus: () => Promise<{ loggedIn: boolean; cookie: string }>;
  getQQMusicPlayUrl: (songmid: string) => Promise<{ url: string | null; error: string | null }>;
};

declare global {
  interface Window {
    musicAgentShell?: MusicAgentShell;
  }
}
