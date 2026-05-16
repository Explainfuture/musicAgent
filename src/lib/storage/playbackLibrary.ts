"use client";

import type { PlayableTrack } from "@/types/music";

const STORAGE_KEY = "music-agent-playback-library";
const MAX_PLAYED = 300;
const MAX_LIKED = 1000;

export type PlayedTrackEntry = {
  track: PlayableTrack;
  playedAt: string;
  playCount: number;
};

export type LikedTrackEntry = {
  track: PlayableTrack;
  likedAt: string;
};

export type PlaybackLibrary = {
  version: 1;
  played: PlayedTrackEntry[];
  liked: LikedTrackEntry[];
};

function emptyLibrary(): PlaybackLibrary {
  return { version: 1, played: [], liked: [] };
}

export function getTrackKey(track: Pick<PlayableTrack, "source" | "id">) {
  return `${track.source}:${track.id}`;
}

function isQQTrack(track: PlayableTrack) {
  return track.source === "qqmusic";
}

function normalizeLibrary(raw: unknown): PlaybackLibrary {
  if (!raw || typeof raw !== "object") return emptyLibrary();
  const source = raw as Partial<PlaybackLibrary>;
  return {
    version: 1,
    played: Array.isArray(source.played)
      ? source.played.filter((entry) => entry.track && isQQTrack(entry.track)).slice(0, MAX_PLAYED)
      : [],
    liked: Array.isArray(source.liked)
      ? source.liked.filter((entry) => entry.track && isQQTrack(entry.track)).slice(0, MAX_LIKED)
      : [],
  };
}

export function readPlaybackLibrary(): PlaybackLibrary {
  if (typeof window === "undefined") return emptyLibrary();

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? normalizeLibrary(JSON.parse(rawValue)) : emptyLibrary();
  } catch {
    return emptyLibrary();
  }
}

function writePlaybackLibrary(library: PlaybackLibrary) {
  if (typeof window === "undefined") return library;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  return library;
}

export function recordPlayedTrack(track: PlayableTrack) {
  const library = readPlaybackLibrary();
  if (!isQQTrack(track)) return library;

  const key = getTrackKey(track);
  const existing = library.played.find((entry) => getTrackKey(entry.track) === key);
  const nextPlayed: PlayedTrackEntry[] = [
    {
      track,
      playedAt: new Date().toISOString(),
      playCount: (existing?.playCount ?? 0) + 1,
    },
    ...library.played.filter((entry) => getTrackKey(entry.track) !== key),
  ].slice(0, MAX_PLAYED);

  return writePlaybackLibrary({ ...library, played: nextPlayed });
}

export function setTrackLiked(track: PlayableTrack, liked: boolean) {
  const library = readPlaybackLibrary();
  if (!isQQTrack(track)) return library;

  const key = getTrackKey(track);
  const nextLiked = liked
    ? [
        { track, likedAt: new Date().toISOString() },
        ...library.liked.filter((entry) => getTrackKey(entry.track) !== key),
      ].slice(0, MAX_LIKED)
    : library.liked.filter((entry) => getTrackKey(entry.track) !== key);

  return writePlaybackLibrary({ ...library, liked: nextLiked });
}

export function isTrackLiked(track: PlayableTrack | null, liked: LikedTrackEntry[]) {
  if (!track) return false;
  const key = getTrackKey(track);
  return liked.some((entry) => getTrackKey(entry.track) === key);
}

export function clearPlayedHistory() {
  const library = readPlaybackLibrary();
  return writePlaybackLibrary({ ...library, played: [] });
}

export function clearLikedTracks() {
  const library = readPlaybackLibrary();
  return writePlaybackLibrary({ ...library, liked: [] });
}
