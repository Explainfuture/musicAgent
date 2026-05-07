import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";
import { getQQMusicCookie } from "./qqmusicAuth";

// ── Types ──────────────────────────────────────────────

type QQMusicSearchSong = {
  songmid: string;
  songname: string;
  singer: Array<{ name: string }>;
  albummid: string;
  albumname: string;
  interval: number;
  strMediaMid?: string;
};

type QQMusicVkeyInfo = {
  songmid: string;
  purl: string;
  filename: string;
};

type QQMusicVkeyBody = {
  code: number;
  data: {
    midurlinfo: QQMusicVkeyInfo[];
    sip: string[];
  };
};

// ── Config ─────────────────────────────────────────────

const QQ_MUSIC_API = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const COVER_TEMPLATE = "https://y.qq.com/music/photo_new/T002R300x300M000{albummid}.jpg";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Persistent guid (changes per process, not per call)
const GLOBAL_GUID = String(Math.floor(Math.random() * 10000000000));

// ── Cookie helpers ─────────────────────────────────────

function parseUin(cookie: string): string {
  const uinMatch = cookie.match(/(?:^|;\s*)uin=([^;]+)/);
  return uinMatch ? uinMatch[1].replace(/\D/g, "") : "0";
}

function getCookie(): string {
  return getQQMusicCookie();
}

// ── Search ──────────────────────────────────────────────

function buildSearchQuery(moodProfile: MoodProfile): string {
  const keywords = moodProfile.keywords.join(" ");
  const genre = moodProfile.searchGenre || "";
  return `${genre} ${keywords}`.replace(/\s+/g, " ").trim().slice(0, 60) || "轻音乐 安静";
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
            search_type: 0,
          },
        },
      },
    },
  };

  const cookie = getCookie();

  const response = await fetch(QQ_MUSIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Referer: "https://y.qq.com",
      Origin: "https://y.qq.com",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`QQ Music search failed: ${response.status}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchResult = (result as any)?.music?.search?.SearchCgiService
    ?.DoSearchForQQMusicDesktop as
    | { code: number; data: { body: { song: { list: QQMusicSearchSong[] } } } }
    | undefined;

  if (searchResult?.code !== 0 || !searchResult?.data?.body?.song?.list?.length) {
    throw new Error(`QQ Music search returned no results for: ${query.slice(0, 60)}`);
  }

  return searchResult.data.body.song.list.map((song) => ({
    id: `qqmusic_${song.songmid}`,
    source: "qqmusic" as const,
    title: song.songname,
    artist: song.singer?.map((s) => s.name).join("/") || undefined,
    coverUrl: COVER_TEMPLATE.replace("{albummid}", song.albummid),
    duration: song.interval,
    tags: [song.albumname, ...moodProfile.keywords.slice(0, 3), moodProfile.scene].filter(Boolean),
  }));
}

// ── Play URL (vkey) ─────────────────────────────────────

export async function getQQMusicPlayUrl(
  songmid: string,
): Promise<{ url: string | null; diagnostic: string }> {
  const cookie = getCookie();
  const uin = cookie ? parseUin(cookie) : "0";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(QQ_MUSIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Referer: "https://y.qq.com",
        Origin: "https://y.qq.com",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        comm: {
          uin: Number(uin) || 0,
          format: "json",
          ct: 24,
          cv: 0,
        },
        req_0: {
          module: "vkey.GetVkeyServer",
          method: "CgiGetVkey",
          param: {
            guid: GLOBAL_GUID,
            songmid: [songmid],
            songtype: [0],
            uin: String(uin),
            loginflag: cookie ? 1 : 0,
            platform: "20",
          },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { url: null, diagnostic: `HTTP ${response.status}` };
    }

    const result = (await response.json()) as Record<string, unknown>;
    const vkeyData = (result as Record<string, unknown>)?.req_0 as QQMusicVkeyBody | undefined;

    if (!vkeyData || vkeyData.code !== 0) {
      return { url: null, diagnostic: `vkey code ${vkeyData?.code ?? "null"}` };
    }

    const info = vkeyData.data.midurlinfo[0];
    const sip = vkeyData.data.sip[0];

    if (!info?.purl) {
      return {
        url: null,
        diagnostic: `purl empty (${info?.filename?.slice(0, 20) || "no filename"})`,
      };
    }

    if (!sip) {
      return { url: null, diagnostic: "no sip" };
    }

    const playUrl = info.purl.startsWith("http") ? info.purl : `${sip}${info.purl}`;
    return { url: playUrl, diagnostic: "ok" };
  } catch (err) {
    return { url: null, diagnostic: (err as Error).message };
  }
}

// ── Batch hydrate ───────────────────────────────────────

export async function hydrateQQMusicTracks(
  tracks: PlayableTrack[],
): Promise<{ tracks: PlayableTrack[]; diagnostics: string[] }> {
  const toHydrate = tracks.filter((t) => t.source === "qqmusic" && !t.audioUrl).slice(0, 8);
  const diagnostics: string[] = [];

  if (toHydrate.length === 0) {
    return { tracks: tracks.filter((t) => t.audioUrl), diagnostics };
  }

  const results = await Promise.all(
    toHydrate.map(async (track) => {
      const songmid = track.id.replace("qqmusic_", "");
      const { url, diagnostic } = await getQQMusicPlayUrl(songmid);
      diagnostics.push(`${track.title.slice(0, 20)}: ${diagnostic}`);
      return { ...track, audioUrl: url || undefined };
    }),
  );

  const hydratedMap = new Map(results.map((t) => [t.id, t]));

  const hydrated = tracks
    .map((t) => hydratedMap.get(t.id) || t)
    .filter((t) => t.audioUrl);

  return { tracks: hydrated, diagnostics };
}
