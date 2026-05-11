"use client";

import type { MoodProfile, PlaybackEvent, UserMusicProfile, WeightedPreference } from "@/types/agent";

const STORAGE_KEY = "music-agent-user-profile";
const MAX_SIGNALS = 24;
const MAX_EVENTS = 30;
const FLUSH_DEBOUNCE_MS = 600;

let memoryProfile: UserMusicProfile | null = null;
let flushTimer: number | null = null;
let lifecycleBound = false;

function emptyProfile(now = new Date().toISOString()): UserMusicProfile {
  return {
    version: 1,
    preferredGenres: [],
    preferredScenes: [],
    preferredMoods: [],
    likedArtists: [],
    avoidedArtists: [],
    likedTags: [],
    avoidedTags: [],
    energyPreference: { low: 0, medium: 0, high: 0 },
    bpmHints: [],
    recentEvents: [],
    updatedAt: now,
  };
}

function normalizeSignal(value: string) {
  return value.trim().toLowerCase();
}

function upsertSignal(
  signals: WeightedPreference[],
  value: string | undefined,
  delta: number,
  now: string,
) {
  if (!value?.trim() || delta === 0) return signals;

  const normalized = normalizeSignal(value);
  const existing = signals.find((signal) => normalizeSignal(signal.value) === normalized);
  const next = existing
    ? signals.map((signal) =>
        normalizeSignal(signal.value) === normalized
          ? {
              ...signal,
              weight: Math.max(0, Number((signal.weight + delta).toFixed(2))),
              count: signal.count + 1,
              updatedAt: now,
            }
          : signal,
      )
    : [...signals, { value: value.trim(), weight: Math.max(0, delta), count: 1, updatedAt: now }];

  return next
    .filter((signal) => signal.weight > 0)
    .sort((left, right) => right.weight - left.weight || right.count - left.count)
    .slice(0, MAX_SIGNALS);
}

function addSignals(
  signals: WeightedPreference[],
  values: Array<string | undefined>,
  delta: number,
  now: string,
) {
  return values.reduce((next, value) => upsertSignal(next, value, delta, now), signals);
}

function mergeProfile(raw: unknown): UserMusicProfile {
  if (!raw || typeof raw !== "object") return emptyProfile();
  const profile = raw as Partial<UserMusicProfile>;
  const base = emptyProfile();
  return {
    ...base,
    ...profile,
    version: 1,
    preferredGenres: profile.preferredGenres || [],
    preferredScenes: profile.preferredScenes || [],
    preferredMoods: profile.preferredMoods || [],
    likedArtists: profile.likedArtists || [],
    avoidedArtists: profile.avoidedArtists || [],
    likedTags: profile.likedTags || [],
    avoidedTags: profile.avoidedTags || [],
    energyPreference: { ...base.energyPreference, ...(profile.energyPreference || {}) },
    bpmHints: profile.bpmHints || [],
    recentEvents: profile.recentEvents || [],
    updatedAt: profile.updatedAt || base.updatedAt,
  };
}

export function readUserMusicProfile(): UserMusicProfile {
  if (typeof window === "undefined") return emptyProfile();
  if (memoryProfile) return memoryProfile;

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    memoryProfile = rawValue ? mergeProfile(JSON.parse(rawValue)) : emptyProfile();
    bindLifecycleFlush();
    return memoryProfile;
  } catch {
    memoryProfile = emptyProfile();
    bindLifecycleFlush();
    return memoryProfile;
  }
}

function flushUserMusicProfile() {
  if (typeof window === "undefined" || !memoryProfile) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryProfile));
}

function scheduleFlush() {
  if (typeof window === "undefined") return;
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushUserMusicProfile();
  }, FLUSH_DEBOUNCE_MS);
}

function bindLifecycleFlush() {
  if (typeof window === "undefined" || lifecycleBound) return;

  const flushNow = () => {
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushUserMusicProfile();
  };

  window.addEventListener("beforeunload", flushNow);
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  lifecycleBound = true;
}

function writeUserMusicProfile(profile: UserMusicProfile) {
  if (typeof window === "undefined") return profile;
  memoryProfile = profile;
  bindLifecycleFlush();
  scheduleFlush();
  return profile;
}

function shouldAffectTaste(event: PlaybackEvent) {
  return event.type === "completed" || event.type === "skipped" || event.type === "manual_feedback";
}

function skippedWeight(event: PlaybackEvent) {
  const listened = event.listenedSeconds ?? 0;
  return listened > 0 && listened < 20 ? 2 : 1;
}

function positiveWeight(event: PlaybackEvent) {
  if (event.type === "completed") return 0.75;
  if (event.type === "manual_feedback") return 1;
  return 0;
}

function negativeWeight(event: PlaybackEvent) {
  return event.type === "skipped" ? skippedWeight(event) : 0;
}

function updatePositiveSignals(profile: UserMusicProfile, event: PlaybackEvent, now: string) {
  const delta = positiveWeight(event);
  if (delta <= 0) return profile;
  const tags = event.track.tags || [];
  const moodProfile = event.moodProfile;

  return {
    ...profile,
    preferredGenres: addSignals(profile.preferredGenres, [moodProfile?.searchGenre], delta, now),
    preferredScenes: addSignals(profile.preferredScenes, [moodProfile?.scene], delta, now),
    preferredMoods: addSignals(profile.preferredMoods, moodProfile?.mood || [], delta, now),
    likedArtists: addSignals(profile.likedArtists, [event.track.artist], delta, now),
    likedTags: addSignals(profile.likedTags, tags, delta, now),
  };
}

function updateNegativeSignals(profile: UserMusicProfile, event: PlaybackEvent, now: string) {
  const delta = negativeWeight(event);
  if (delta <= 0) return profile;
  return {
    ...profile,
    avoidedArtists: addSignals(profile.avoidedArtists, [event.track.artist], delta, now),
    avoidedTags: addSignals(profile.avoidedTags, event.track.tags || [], delta, now),
  };
}

function updateMoodSignals(profile: UserMusicProfile, moodProfile: MoodProfile | undefined, weight: number) {
  if (!moodProfile || weight <= 0) return profile;
  return {
    ...profile,
    languagePreference: moodProfile.searchLanguage || profile.languagePreference,
    energyPreference: {
      ...profile.energyPreference,
      [moodProfile.energy]: Number((profile.energyPreference[moodProfile.energy] + weight).toFixed(2)),
    },
    bpmHints: moodProfile.bpmHint
      ? [moodProfile.bpmHint, ...profile.bpmHints.filter((hint) => hint !== moodProfile.bpmHint)].slice(0, 8)
      : profile.bpmHints,
  };
}

export function updateUserMusicProfile(event: PlaybackEvent): UserMusicProfile {
  const now = event.createdAt || new Date().toISOString();
  const current = readUserMusicProfile();
  const tasteWeight = shouldAffectTaste(event) ? positiveWeight(event) : 0;

  let next = updatePositiveSignals(current, event, now);
  next = updateNegativeSignals(next, event, now);
  next = updateMoodSignals(next, event.moodProfile, tasteWeight);

  next = {
    ...next,
    recentEvents: [
      {
        type: event.type,
        trackId: event.track.id,
        source: event.track.source,
        title: event.track.title,
        artist: event.track.artist,
        mood: event.moodProfile?.mood,
        scene: event.moodProfile?.scene,
        listenedSeconds: event.listenedSeconds,
        durationSeconds: event.durationSeconds,
        originalText: event.originalText,
        createdAt: now,
      },
      ...next.recentEvents,
    ].slice(0, MAX_EVENTS),
    updatedAt: now,
  };

  return writeUserMusicProfile(next);
}
