import { z } from "zod";

export const moodProfileSchema = z.object({
  scene: z.string().min(1),
  mood: z.array(z.string()).min(1),
  energy: z.enum(["low", "medium", "high"]),
  valence: z.enum(["sad", "warm", "neutral", "happy"]),
  avoid: z.array(z.string()),
  keywords: z.array(z.string()).min(1),
  summary: z.string().min(1),
});

export const playableTrackSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["jamendo", "audius"]),
  title: z.string().min(1),
  artist: z.string().optional(),
  audioUrl: z.string().min(1).optional(),
  coverUrl: z.string().url().optional(),
  duration: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export const selectedTrackSchema = z.object({
  selectedTrackId: z.string().min(1),
  reason: z.string().min(1),
  explanationSegments: z.array(z.string()).min(2).max(5),
});

export const agentResolveResponseSchema = z.object({
  moodProfile: moodProfileSchema,
  track: playableTrackSchema,
  explanationSegments: z.array(z.string()).min(2),
  sourceDiagnostics: z.array(z.string()).optional(),
});
