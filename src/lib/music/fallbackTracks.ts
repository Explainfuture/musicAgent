import type { PlayableTrack } from "@/types/music";

export const fallbackTracks: PlayableTrack[] = [
  {
    id: "direct_soundhelix_1",
    source: "direct",
    title: "Soft Fallback Current",
    artist: "SoundHelix",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    coverUrl: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
    duration: 372,
    tags: ["warm", "soft", "mellow", "calm", "focus"],
  },
  {
    id: "direct_soundhelix_2",
    source: "direct",
    title: "Gentle Focus Fallback",
    artist: "SoundHelix",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    coverUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    duration: 345,
    tags: ["focus", "instrumental", "peaceful", "coding", "chill"],
  },
  {
    id: "direct_soundhelix_3",
    source: "direct",
    title: "Warm Reset Fallback",
    artist: "SoundHelix",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    coverUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    duration: 356,
    tags: ["healing", "warm", "gentle", "neutral", "resting"],
  },
];
