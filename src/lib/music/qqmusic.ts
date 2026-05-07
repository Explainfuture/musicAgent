import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

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
    };
  };
};

type MusicuSearchResponse = {
  req_0?: {
    code?: number;
    data?: {
      body?: {
        song?: {
          list?: ClientSearchSong[];
        };
      };
    };
  };
};

const SEARCH_API = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp";
const SEARCH_API_FALLBACK = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const COVER_TEMPLATE = "https://y.qq.com/music/photo_new/T002R300x300M000{albummid}.jpg";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

import { getQQMusicCookie } from "./qqmusicAuth";

export function buildSearchQuery(moodProfile: MoodProfile): string {
  const keywords = moodProfile.keywords.join(" ");
  const genre = moodProfile.searchGenre || "";
  return `${genre} ${keywords}`.replace(/\s+/g, " ").trim().slice(0, 50) || "安静 轻音乐";
}

function toPlayableTracks(list: ClientSearchSong[], moodProfile: MoodProfile): PlayableTrack[] {
  return list.map((song) => ({
    id: `qqmusic_${song.mid}`,
    source: "qqmusic" as const,
    title: song.name || song.title,
    artist: song.singer?.map((s) => s.name || s.title).join("/") || undefined,
    coverUrl: COVER_TEMPLATE.replace("{albummid}", song.album?.mid || ""),
    duration: song.interval,
    tags: [song.album?.name || "", song.album?.title || "", ...moodProfile.keywords.slice(0, 2)].filter(Boolean),
  }));
}

async function searchClassic(query: string, limit: number, cookie: string): Promise<ClientSearchSong[]> {
  const params = new URLSearchParams({
    p: "1",
    n: String(Math.min(limit, 30)),
    w: query,
    format: "json",
    new_json: "1",
  });

  const response = await fetch(`${SEARCH_API}?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://y.qq.com",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`classic HTTP ${response.status}`);
  }

  const data = (await response.json()) as ClientSearchResponse;
  return data.code === 0 ? data.data?.song?.list || [] : [];
}

async function searchMusicu(query: string, limit: number, cookie: string): Promise<ClientSearchSong[]> {
  const response = await fetch(SEARCH_API_FALLBACK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Referer: "https://y.qq.com",
      Origin: "https://y.qq.com",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      comm: { ct: 24, cv: 0, uin: 0, format: "json" },
      req_0: {
        module: "music.search.SearchCgiService",
        method: "DoSearchForQQMusicDesktop",
        param: {
          query,
          page_num: 1,
          num_per_page: Math.min(limit, 30),
          search_type: 0,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`musicu HTTP ${response.status}`);
  }

  const data = (await response.json()) as MusicuSearchResponse;
  if (data.req_0?.code !== 0) return [];
  return data.req_0?.data?.body?.song?.list || [];
}

export async function searchQQMusicTracks(moodProfile: MoodProfile, limit = 15): Promise<PlayableTrack[]> {
  const query = buildSearchQuery(moodProfile);
  const cookie = getQQMusicCookie();

  let songs: ClientSearchSong[] = [];
  try {
    songs = await searchClassic(query, limit, cookie);
  } catch {
    songs = [];
  }

  if (songs.length === 0) {

    songs = await searchMusicu(query, limit, cookie);
  }

  if (!songs.length) {
    throw new Error(`QQ Music: no results for "${query}"`);
  }

  return toPlayableTracks(songs, moodProfile);
}
