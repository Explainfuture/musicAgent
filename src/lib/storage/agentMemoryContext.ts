import type {
  AgentMemoryContext,
  AgentLocalTimeContext,
  FeedbackRecord,
  FeedbackType,
  MemoryDayPeriod,
  MemoryFeedbackRef,
  MemorySignal,
  MemoryTrackRef,
  UserMusicProfile,
  WeightedPreference,
} from "@/types/agent";
import type { PlayableTrack } from "@/types/music";
import type { PlaybackLibrary } from "@/lib/storage/playbackLibrary";

export const TARGET_MEMORY_CONTEXT_BYTES = 12_000;

const MAX_RECENT_PLAYED = 8;
const MAX_LIKED_TRACKS = 8;
const MAX_NEGATIVE_FEEDBACK = 8;
const MAX_PROFILE_SIGNALS = 6;
const MAX_BPM_HINTS = 5;
const MAX_RECENT_CONVERSATION = 6;
const MAX_CONVERSATION_CHARS = 220;
const MAX_TEXT_CHARS = 80;
const MAX_TAGS = 6;

const NEGATIVE_FEEDBACK = new Set<FeedbackType>([
  "not_fit",
  "too_loud",
  "too_sad",
  "too_flat",
  "skipped",
]);

type RecentConversationItem = { role: "user" | "agent"; content: string };

type BuildAgentMemoryContextInput = {
  playbackLibrary: PlaybackLibrary;
  feedbackMemory: FeedbackRecord[];
  userMusicProfile: UserMusicProfile;
  recentConversation: RecentConversationItem[];
  now?: Date;
};

type MemoryContextLimits = {
  recentPlayed: number;
  likedTracks: number;
  negativeFeedback: number;
  recentConversation: number;
};

function safeText(value: string | undefined, maxLength = MAX_TEXT_CHARS) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function compactSignals(signals: WeightedPreference[] = []): MemorySignal[] {
  return signals.slice(0, MAX_PROFILE_SIGNALS).flatMap((signal) => {
    const value = safeText(signal.value, 48);
    if (!value) return [];
    return [{
      value,
      weight: Number(signal.weight.toFixed(2)),
      count: signal.count,
    }];
  });
}

function compactTags(tags: string[] | undefined) {
  return tags?.flatMap((tag) => {
    const value = safeText(tag, 32);
    return value ? [value] : [];
  }).slice(0, MAX_TAGS);
}

function compactTrack(track: PlayableTrack): Pick<MemoryTrackRef, "id" | "source" | "title" | "artist" | "tags"> {
  return {
    id: track.id,
    source: track.source,
    title: safeText(track.title) || track.id,
    artist: safeText(track.artist),
    tags: compactTags(track.tags),
  };
}

function compactRecentPlayed(
  playbackLibrary: PlaybackLibrary,
  limit: number,
): MemoryTrackRef[] {
  return playbackLibrary.played.slice(0, limit).map((entry) => ({
    ...compactTrack(entry.track),
    playedAt: entry.playedAt,
    playCount: entry.playCount,
  }));
}

function compactLikedTracks(
  playbackLibrary: PlaybackLibrary,
  limit: number,
): MemoryTrackRef[] {
  return playbackLibrary.liked.slice(0, limit).map((entry) => ({
    ...compactTrack(entry.track),
    likedAt: entry.likedAt,
  }));
}

function compactNegativeFeedback(
  feedbackMemory: FeedbackRecord[],
  limit: number,
): MemoryFeedbackRef[] {
  return feedbackMemory
    .filter((record) => NEGATIVE_FEEDBACK.has(record.feedback))
    .slice(0, limit)
    .map((record) => ({
      trackId: record.trackId,
      source: record.source,
      feedback: record.feedback,
      originalText: safeText(record.originalText, 120),
      createdAt: record.createdAt,
    }));
}

function compactConversation(
  recentConversation: RecentConversationItem[],
  limit: number,
): RecentConversationItem[] {
  return recentConversation.slice(-limit).flatMap((message) => {
    const content = safeText(message.content, MAX_CONVERSATION_CHARS);
    return content ? [{ role: message.role, content }] : [];
  });
}

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch {
    return "local";
  }
}

function getDayPeriod(hour: number): MemoryDayPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "late_night";
}

function buildLocalTimeContext(now: Date): AgentLocalTimeContext {
  const weekday = now.getDay();
  const hour = now.getHours();

  return {
    iso: now.toISOString(),
    timezone: getTimezone(),
    hour,
    weekday,
    dayPeriod: getDayPeriod(hour),
    isWeekend: weekday === 0 || weekday === 6,
  };
}

function buildWithLimits(
  input: Required<BuildAgentMemoryContextInput>,
  limits: MemoryContextLimits,
  budgetTrimmed: boolean,
): AgentMemoryContext {
  const negativeFeedbackCount = input.feedbackMemory.filter((record) => NEGATIVE_FEEDBACK.has(record.feedback)).length;
  const trimmed =
    budgetTrimmed ||
    input.playbackLibrary.played.length > limits.recentPlayed ||
    input.playbackLibrary.liked.length > limits.likedTracks ||
    negativeFeedbackCount > limits.negativeFeedback ||
    input.recentConversation.length > limits.recentConversation;

  return {
    version: 1,
    generatedAt: input.now.toISOString(),
    localTime: buildLocalTimeContext(input.now),
    profile: {
      preferredGenres: compactSignals(input.userMusicProfile.preferredGenres),
      preferredScenes: compactSignals(input.userMusicProfile.preferredScenes),
      preferredMoods: compactSignals(input.userMusicProfile.preferredMoods),
      likedArtists: compactSignals(input.userMusicProfile.likedArtists),
      avoidedArtists: compactSignals(input.userMusicProfile.avoidedArtists),
      likedTags: compactSignals(input.userMusicProfile.likedTags),
      avoidedTags: compactSignals(input.userMusicProfile.avoidedTags),
      languagePreference: input.userMusicProfile.languagePreference,
      energyPreference: input.userMusicProfile.energyPreference,
      bpmHints: input.userMusicProfile.bpmHints.flatMap((hint) => {
        const value = safeText(hint, 32);
        return value ? [value] : [];
      }).slice(0, MAX_BPM_HINTS),
    },
    history: {
      recentPlayed: compactRecentPlayed(input.playbackLibrary, limits.recentPlayed),
      likedTracks: compactLikedTracks(input.playbackLibrary, limits.likedTracks),
      negativeFeedback: compactNegativeFeedback(input.feedbackMemory, limits.negativeFeedback),
    },
    recentConversation: compactConversation(input.recentConversation, limits.recentConversation),
    stats: {
      totalPlayed: input.playbackLibrary.played.length,
      totalLiked: input.playbackLibrary.liked.length,
      totalFeedback: input.feedbackMemory.length,
      trimmed,
    },
  };
}

function jsonByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function buildAgentMemoryContext(input: BuildAgentMemoryContextInput): AgentMemoryContext {
  const normalizedInput: Required<BuildAgentMemoryContextInput> = {
    ...input,
    now: input.now ?? new Date(),
  };
  const limits: MemoryContextLimits = {
    recentPlayed: MAX_RECENT_PLAYED,
    likedTracks: MAX_LIKED_TRACKS,
    negativeFeedback: MAX_NEGATIVE_FEEDBACK,
    recentConversation: MAX_RECENT_CONVERSATION,
  };

  let budgetTrimmed = false;
  let context = buildWithLimits(normalizedInput, limits, budgetTrimmed);

  for (let guard = 0; guard < 32 && jsonByteLength(context) > TARGET_MEMORY_CONTEXT_BYTES; guard += 1) {
    budgetTrimmed = true;
    if (limits.recentConversation > 0) limits.recentConversation -= 1;
    else if (limits.recentPlayed > 0) limits.recentPlayed -= 1;
    else if (limits.likedTracks > 0) limits.likedTracks -= 1;
    else if (limits.negativeFeedback > 0) limits.negativeFeedback -= 1;
    else break;

    context = buildWithLimits(normalizedInput, limits, budgetTrimmed);
  }

  return context;
}
