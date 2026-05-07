import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

// ── Types ──────────────────────────────────────────────

type QQMusicSearchSong = {
  songmid: string;
  songname: string;
  singer: Array<{ name: string }>;
  albummid: string;
  albumname: string;
  interval: number;
  strMediaMid?: string;
  pay?: { payplay?: number; pay_month?: number };
};

type QQMusicSearchBody = {
  code: number;
  data: {
    body: {
      song: {
        list: QQMusicSearchSong[];
        totalnum: number;
      };
    };
  };
};

type QQMusicVkeyInfo = {
  songmid: string;
  purl: string;
  p2purl: string;
  filename: string;
};

type QQMusicVkeyBody = {
  code: number;
  data: {
    midurlinfo: QQMusicVkeyInfo[];
    sip: string[];
    testfile2g: string;
  };
};

// ── Config ─────────────────────────────────────────────

const QQ_MUSIC_API = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const COVER_TEMPLATE = "https://y.qq.com/music/photo_new/T002R300x300M000{albummid}.jpg";

function guid() {
  return String(Math.floor(Math.random() * 1000000000));
}

function makeCookieHeader(): string {
  const cookie = process.env.QQMUSIC_COOKIE;
  if (!cookie) return "";
  return cookie;
}

// ── Search ──────────────────────────────────────────────

function buildSearchQuery(moodProfile: MoodProfile): string {
  // Use only the keywords (which are now clean Chinese keywords from the LLM)
  // + optionally the searchGenre for more targeted results
  const keywords = moodProfile.keywords.join(" ");
  const genre = moodProfile.searchGenre || "";
  const query = `${genre} ${keywords}`.replace(/\s+/g, " ").trim().slice(0, 60);
  return query || "轻音乐 安静";
}

export async function searchQQMusicTracks(
  moodProfile: MoodProfile,
  limit = 15,
): Promise<PlayableTrack[]> {
  const query = buildSearchQuery(moodProfile);

  const body = {
    music: {
      search: {
        SearchCgiService: {
          method: "DoSearchForQQMusicDesktop",
          module: "music.search.SearchCgiService",
          param: {
            num_per_page: Math.min(limit, 40),
            page_num: 1,
            query,
            search_type: 0, // 0 = song
          },
        },
      },
    },
  };

  const cookie = makeCookieHeader();

  const response = await fetch(QQ_MUSIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://y.qq.com",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    next: { revalidate: 180 },
  });

  if (!response.ok) {
    throw new Error(`QQ Music search failed: ${response.status}`);
  }

  const result = await response.json();

  const searchData =
    (result as Record<string, unknown>)?.music as
      | { search: { SearchCgiService: { DoSearchForQQMusicDesktop: QQMusicSearchBody } } }
      | undefined;

  const searchResult = searchData?.search?.SearchCgiService?.DoSearchForQQMusicDesktop;

  if (searchResult?.code !== 0 || !searchResult?.data?.body?.song?.list) {
    throw new Error(
      `QQ Music search returned no results for query: ${query.slice(0, 60)}`,
    );
  }

  return searchResult.data.body.song.list.map((song) => ({
    id: `qqmusic_${song.songmid}`,
    source: "qqmusic" as const,
    title: song.songname,
    artist: song.singer?.map((s) => s.name).join("/") || undefined,
    coverUrl: COVER_TEMPLATE.replace("{albummid}", song.albummid),
    duration: song.interval,
    tags: [
      song.albumname,
      ...moodProfile.keywords.slice(0, 3),
      moodProfile.scene,
    ].filter(Boolean),
  }));
}

// ── Play URL (vkey) ─────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getQQMusicPlayUrl(songmid: string): Promise<string | null> {
  const cookie = makeCookieHeader();

  try {
    const response = await fetchWithTimeout(
      QQ_MUSIC_API,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://y.qq.com",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({
          comm: { uin: 0, format: "json", ct: 24, cv: 0 },
          req_0: {
            module: "vkey.GetVkeyServer",
            method: "CgiGetVkey",
            param: {
              guid: guid(),
              songmid: [songmid],
              songtype: [0],
              uin: "0",
              loginflag: 1,
              platform: "20",
            },
          },
        }),
      },
    );

    if (!response.ok) return null;

    const result = await response.json();
    const vkeyData = (result as Record<string, unknown>)?.req_0 as
      | QQMusicVkeyBody
      | undefined;

    if (vkeyData?.code !== 0) return null;

    const info = vkeyData.data.midurlinfo[0];
    const sip = vkeyData.data.sip[0];

    if (info?.purl && sip) {
      return info.purl.startsWith("http") ? info.purl : `${sip}${info.purl}`;
    }

    return null;
  } catch {
    return null;
  }
}

// ── Batch fetch play URLs (parallel with timeout) ────────

export async function hydrateQQMusicTracks(
  tracks: PlayableTrack[],
): Promise<PlayableTrack[]> {
  // Only hydrate top tracks to avoid excessive API calls
  const toHydrate = tracks.filter((t) => t.source === "qqmusic" && !t.audioUrl).slice(0, 8);

  if (toHydrate.length === 0) return tracks;

  const results = await Promise.all(
    toHydrate.map(async (track) => {
      const songmid = track.id.replace("qqmusic_", "");
      const playUrl = await getQQMusicPlayUrl(songmid);
      return { ...track, audioUrl: playUrl || undefined };
    }),
  );

  // Build map for quick lookup
  const hydratedMap = new Map(results.map((t) => [t.id, t]));

  return tracks
    .map((t) => hydratedMap.get(t.id) || t)
    .filter((t) => t.audioUrl);
}
