import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

// ── Types ──────────────────────────────────────────────

type ClientSearchSong = {
  mid: string;
  id: number;
  name: string;
  title: string;
  singer: Array<{ mid: string; name: string; title: string }>;
  album: { mid: string; name: string; title: string };
  interval: number;
};

type ClientSearchResponse = {
  code: number;
  data: {
    song: {
      list: ClientSearchSong[];
      curnum: number;
      curpage: number;
      totalnum: number;
    };
  };
};

// ── Config ─────────────────────────────────────────────

const SEARCH_API = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp";
const COVER_TEMPLATE = "https://y.qq.com/music/photo_new/T002R300x300M000{albummid}.jpg";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

import { getQQMusicCookie } from "./qqmusicAuth";

// ── Search ──────────────────────────────────────────────

function buildSearchQuery(moodProfile: MoodProfile): string {
  const keywords = moodProfile.keywords.join(" ");
  const genre = moodProfile.searchGenre || "";
  return `${genre} ${keywords}`.replace(/\s+/g, " ").trim().slice(0, 50) || "安静 轻音乐";
}

export async function searchQQMusicTracks(
  moodProfile: MoodProfile,
  limit = 15,
): Promise<PlayableTrack[]> {
  const query = buildSearchQuery(moodProfile);
  const cookie = getQQMusicCookie();

  const params = new URLSearchParams({
    p: "1",
    n: String(Math.min(limit, 30)),
    w: query,
    format: "json",
    new_json: "1",
  });

  const url = `${SEARCH_API}?${params}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://y.qq.com",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`QQ Music search failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as ClientSearchResponse;

  if (data.code !== 0 || !data.data?.song?.list?.length) {
    throw new Error(`QQ Music: no results for "${query}"`);
  }

  return data.data.song.list.map((song) => ({
    id: `qqmusic_${song.mid}`,
    source: "qqmusic" as const,
    title: song.name || song.title,
    artist: song.singer?.map((s) => s.name || s.title).join("/") || undefined,
    coverUrl: COVER_TEMPLATE.replace("{albummid}", song.album?.mid || ""),
    duration: song.interval,
    tags: [
      song.album?.name || "",
      song.album?.title || "",
      ...moodProfile.keywords.slice(0, 2),
    ].filter(Boolean),
    // audioUrl is NOT set here — it will be fetched client-side via Electron IPC
  }));

  // Note: audioUrl is intentionally not set.
  // QQ Music requires a signed vkey request which only works from
  // Electron's Chromium session (via IPC). The PlayerCard component
  // handles this by calling window.musicAgentShell.getQQMusicPlayUrl().
}
