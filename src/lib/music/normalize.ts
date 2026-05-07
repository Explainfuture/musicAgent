import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

export function uniqueTracks(tracks: PlayableTrack[]) {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return Boolean(track.audioUrl);
  });
}

export function filterPreviousTracks(
  tracks: PlayableTrack[],
  previousTrackIds: string[] = [],
) {
  const previous = new Set(previousTrackIds);
  return tracks.filter((track) => !previous.has(track.id));
}

export function scoreTrack(track: PlayableTrack, moodProfile: MoodProfile) {
  const tags = track.tags?.map((tag) => tag.toLowerCase()) ?? [];
  const text = [track.title, track.artist, ...tags].join(" ").toLowerCase();
  const keywordScore = moodProfile.keywords.reduce((score, keyword) => {
    return text.includes(keyword.toLowerCase()) ? score + 2 : score;
  }, 0);
  const avoidPenalty = moodProfile.avoid.reduce((score, avoid) => {
    const normalized = avoid.replace("too_", "");
    return text.includes(normalized) ? score + 3 : score;
  }, 0);
  const sourceScore =
    track.source === "qqmusic"
      ? 5
      : track.source === "jamendo"
        ? 3
        : track.source === "audius"
          ? 2
          : 1.5;

  return keywordScore + sourceScore - avoidPenalty;
}

export function rankTracks(
  tracks: PlayableTrack[],
  moodProfile: MoodProfile,
  previousTrackIds: string[] = [],
) {
  return filterPreviousTracks(uniqueTracks(tracks), previousTrackIds).sort(
    (left, right) => scoreTrack(right, moodProfile) - scoreTrack(left, moodProfile),
  );
}
