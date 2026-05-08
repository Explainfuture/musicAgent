import type { MoodProfile, UserMusicProfile, WeightedPreference } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

export function uniqueTracks(tracks: PlayableTrack[]) {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return track.source === "qqmusic" || Boolean(track.audioUrl);
  });
}

export function filterPreviousTracks(
  tracks: PlayableTrack[],
  previousTrackIds: string[] = [],
) {
  const previous = new Set(previousTrackIds);
  return tracks.filter((track) => !previous.has(track.id));
}

function preferenceScore(text: string, signals: WeightedPreference[], multiplier: number) {
  return signals.reduce((score, signal) => {
    return text.includes(signal.value.toLowerCase()) ? score + signal.weight * multiplier : score;
  }, 0);
}

function scoreUserProfile(track: PlayableTrack, userMusicProfile?: UserMusicProfile) {
  if (!userMusicProfile) return 0;
  const tags = track.tags?.map((tag) => tag.toLowerCase()) ?? [];
  const artist = (track.artist || "").toLowerCase();
  const text = [track.title, artist, ...tags].join(" ").toLowerCase();

  const positive =
    preferenceScore(text, userMusicProfile.likedTags, 1.5) +
    preferenceScore(artist, userMusicProfile.likedArtists, 2) +
    preferenceScore(text, userMusicProfile.preferredGenres, 1);

  const negative =
    preferenceScore(text, userMusicProfile.avoidedTags, 2) +
    preferenceScore(artist, userMusicProfile.avoidedArtists, 2.5);

  return positive - negative;
}

export function scoreTrack(
  track: PlayableTrack,
  moodProfile: MoodProfile,
  userMusicProfile?: UserMusicProfile,
) {
  const tags = track.tags?.map((tag) => tag.toLowerCase()) ?? [];
  const text = [track.title, track.artist, ...tags].join(" ").toLowerCase();
  const keywordScore = moodProfile.keywords.reduce((score, keyword) => {
    return text.includes(keyword.toLowerCase()) ? score + 2 : score;
  }, 0);
  const avoidPenalty = moodProfile.avoid.reduce((score, avoid) => {
    const normalized = avoid.replace("too_", "");
    return text.includes(normalized) ? score + 3 : score;
  }, 0);
  return keywordScore - avoidPenalty + scoreUserProfile(track, userMusicProfile);
}

export function rankTracks(
  tracks: PlayableTrack[],
  moodProfile: MoodProfile,
  previousTrackIds: string[] = [],
  userMusicProfile?: UserMusicProfile,
) {
  const recentSkippedIds =
    userMusicProfile?.recentEvents
      .filter((event) => event.type === "skipped" || event.type === "play_error")
      .slice(0, 20)
      .map((event) => event.trackId) ?? [];
  const blockedIds = Array.from(new Set([...previousTrackIds, ...recentSkippedIds]));

  return filterPreviousTracks(uniqueTracks(tracks), blockedIds).sort(
    (left, right) =>
      scoreTrack(right, moodProfile, userMusicProfile) -
      scoreTrack(left, moodProfile, userMusicProfile),
  );
}
