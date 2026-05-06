export type MusicSource = "jamendo" | "audius";

export type PlayableTrack = {
  id: string;
  source: MusicSource;
  title: string;
  artist?: string;
  audioUrl?: string;
  coverUrl?: string;
  duration?: number;
  tags?: string[];
};
