import type { PlayableTrack } from "./music";

export type AgentStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "searching"
  | "playing"
  | "paused"
  | "error";

export type MoodProfile = {
  scene: string;
  mood: string[];
  energy: "low" | "medium" | "high";
  valence: "sad" | "warm" | "neutral" | "happy";
  avoid: string[];
  keywords: string[];
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

export type AgentResolveRequest = {
  text: string;
  previousTrackIds?: string[];
  feedbackMemory?: FeedbackRecord[];
};

export type AgentResolveResponse = {
  moodProfile: MoodProfile;
  track: PlayableTrack;
  explanationSegments: string[];
  sourceDiagnostics?: string[];
};
