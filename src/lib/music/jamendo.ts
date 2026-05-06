import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

type JamendoTrack = {
  id: string;
  name: string;
  artist_name?: string;
  audio?: string;
  image?: string;
  duration?: number;
  musicinfo?: {
    tags?: {
      genres?: string[];
      instruments?: string[];
      vartags?: string[];
    };
  };
};

type JamendoResponse = {
  results?: JamendoTrack[];
};

export async function searchJamendoTracks(
  moodProfile: MoodProfile,
  limit = 8,
): Promise<PlayableTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;

  if (!clientId) {
    throw new Error("JAMENDO_CLIENT_ID is not configured.");
  }

  const query = moodProfile.keywords.slice(0, 3).join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: String(limit),
    include: "musicinfo",
    audioformat: "mp32",
    order: "popularity_total",
    search: query,
  });

  const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Jamendo request failed: ${response.status}`);
  }

  const data = (await response.json()) as JamendoResponse;

  return (data.results ?? [])
    .filter((track) => track.audio)
    .map((track) => ({
      id: `jamendo_${track.id}`,
      source: "jamendo",
      title: track.name,
      artist: track.artist_name,
      audioUrl: track.audio,
      coverUrl: track.image,
      duration: track.duration,
      tags: [
        ...(track.musicinfo?.tags?.genres ?? []),
        ...(track.musicinfo?.tags?.instruments ?? []),
        ...(track.musicinfo?.tags?.vartags ?? []),
      ].slice(0, 10),
    }));
}
