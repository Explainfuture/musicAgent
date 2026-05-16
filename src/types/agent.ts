import type { PlayableTrack } from "./music";

export type AgentStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "searching"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type MoodProfile = {
  scene: string;
  mood: string[];
  energy: "low" | "medium" | "high";
  valence: "sad" | "warm" | "neutral" | "happy";
  avoid: string[];
  keywords: string[];
  searchGenre?: string;
  searchLanguage?: "zh-CN" | "en" | "any";
  bpmHint?: string;
  summary: string;
};

export type FeedbackType =
  | "good_fit"
  | "not_fit"
  | "too_loud"
  | "too_sad"
  | "too_flat"
  | "skipped";

export type FeedbackRecord = {
  trackId: string;
  source: PlayableTrack["source"];
  feedback: FeedbackType;
  originalText: string;
  createdAt: string;
};

export type PlaybackEventType =
  | "completed"
  | "skipped"
  | "play_error"
  | "manual_feedback";

export type WeightedPreference = {
  value: string;
  weight: number;
  count: number;
  updatedAt: string;
};

export type UserMusicProfile = {
  version: 1;
  preferredGenres: WeightedPreference[];
  preferredScenes: WeightedPreference[];
  preferredMoods: WeightedPreference[];
  likedArtists: WeightedPreference[];
  avoidedArtists: WeightedPreference[];
  likedTags: WeightedPreference[];
  avoidedTags: WeightedPreference[];
  languagePreference?: MoodProfile["searchLanguage"];
  energyPreference: Record<MoodProfile["energy"], number>;
  bpmHints: string[];
  recentEvents: Array<{
    type: PlaybackEventType;
    feedback?: FeedbackType;
    trackId: string;
    source: PlayableTrack["source"];
    title: string;
    artist?: string;
    mood?: string[];
    scene?: string;
    listenedSeconds?: number;
    durationSeconds?: number;
    originalText?: string;
    createdAt: string;
  }>;
  updatedAt: string;
};

export type PlaybackEvent = {
  type: PlaybackEventType;
  feedback?: FeedbackType;
  track: PlayableTrack;
  moodProfile?: MoodProfile;
  originalText?: string;
  listenedSeconds?: number;
  durationSeconds?: number;
  createdAt?: string;
};

export type AgentToolTrace = {
  step: string;
  status: "running" | "success" | "failed";
  detail: string;
};

export type AgentResolveStreamEvent =
  | { type: "trace"; trace: AgentToolTrace }
  | { type: "result"; data: AgentResolveResponse }
  | { type: "error"; error: string };

export type AgentResolveRequest = {
  text: string;
  deepseekApiKey?: string;
  playbackMode?: "electron" | "web";
  previousTrackIds?: string[];
  feedbackMemory?: FeedbackRecord[];
  userMusicProfile?: UserMusicProfile;
  recentConversation?: Array<{ role: "user" | "agent"; content: string }>;
};

export type AgentResolveResponse = {
  intent: "music" | "chat";
  // Music mode
  moodProfile?: MoodProfile;
  track?: PlayableTrack;
  explanationSegments?: string[];
  recommendations?: TrackRecommendation[];
  // Chat mode
  chatReply?: string;
  sourceDiagnostics?: string[];
  toolTrace?: AgentToolTrace[];
};

export type TrackRecommendation = {
  track: PlayableTrack;
  reason?: string;
  explanationSegments: string[];
};
