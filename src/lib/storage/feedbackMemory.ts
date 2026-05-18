"use client";

import type { FeedbackRecord, FeedbackType } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

const STORAGE_KEY = "music-agent-feedback-memory";
const MAX_RECORDS = 50;

function normalizeFeedbackMemory(raw: unknown): FeedbackRecord[] {
  return Array.isArray(raw) ? (raw as FeedbackRecord[]).slice(0, MAX_RECORDS) : [];
}

export function readFeedbackMemory(): FeedbackRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? normalizeFeedbackMemory(JSON.parse(rawValue)) : [];
  } catch {
    return [];
  }
}

export function saveFeedbackRecord(input: {
  track: PlayableTrack;
  feedback: FeedbackType;
  originalText: string;
}) {
  if (typeof window === "undefined") return [];

  const nextRecord: FeedbackRecord = {
    trackId: input.track.id,
    source: input.track.source,
    feedback: input.feedback,
    originalText: input.originalText,
    createdAt: new Date().toISOString(),
  };
  const records = [nextRecord, ...readFeedbackMemory()].slice(0, MAX_RECORDS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

  return records;
}

export function clearFeedbackMemory() {
  if (typeof window === "undefined") return [];
  window.localStorage.removeItem(STORAGE_KEY);
  return [];
}
