import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

type AudiusTrack = {
  id: string;
  title: string;
  duration?: number;
  genre?: string;
  mood?: string;
  artwork?: {
    "150x150"?: string;
    "480x480"?: string;
    "1000x1000"?: string;
  };
  user?: {
    name?: string;
  };
  access?: {
    stream?: boolean;
  };
  stream?: {
    url?: string;
    mirrors?: string[];
  };
};

type AudiusResponse<T> = {
  data?: T;
};

const AUDIUS_APP_NAME = "musicAgentMvp";

function buildAudiusProxyUrl(track: AudiusTrack) {
  const params = new URLSearchParams();
  params.set("url", track.stream?.url ?? "");

  for (const mirror of track.stream?.mirrors ?? []) {
    params.append("mirror", mirror);
  }

  return `/api/music/stream/audius/${track.id}?${params.toString()}`;
}

async function getAudiusHost() {
  const response = await fetch("https://api.audius.co", {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Audius host request failed: ${response.status}`);
  }

  const data = (await response.json()) as AudiusResponse<string[]>;
  const host = data.data?.[0];

  if (!host) {
    throw new Error("Audius did not return a discovery host.");
  }

  return host;
}

export async function searchAudiusTracks(
  moodProfile: MoodProfile,
  limit = 8,
): Promise<PlayableTrack[]> {
  const host = await getAudiusHost();
  const params = new URLSearchParams({
    query: moodProfile.keywords.slice(0, 3).join(" "),
    app_name: AUDIUS_APP_NAME,
    limit: String(limit),
  });

  const response = await fetch(`${host}/v1/tracks/search?${params}`, {
    next: { revalidate: 180 },
  });

  if (!response.ok) {
    throw new Error(`Audius search failed: ${response.status}`);
  }

  const data = (await response.json()) as AudiusResponse<AudiusTrack[]>;

  return (data.data ?? [])
    .filter((track) => track.access?.stream !== false && Boolean(track.stream?.url))
    .map((track) => ({
      id: `audius_${track.id}`,
      source: "audius",
      title: track.title,
      artist: track.user?.name,
      audioUrl: buildAudiusProxyUrl(track),
      coverUrl:
        track.artwork?.["480x480"] ||
        track.artwork?.["1000x1000"] ||
        track.artwork?.["150x150"],
      duration: track.duration,
      tags: [track.genre, track.mood, ...moodProfile.keywords].filter(
        (tag): tag is string => Boolean(tag),
      ),
    }));
}
