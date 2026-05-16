export type MusicSource = "qqmusic";

export type TimedLyricLine = {
  time: number;
  text: string;
};

export type PlayableTrack = {
  id: string;
  source: MusicSource;
  title: string;
  artist?: string;
  audioUrl?: string;
  coverUrl?: string;
  duration?: number;
  tags?: string[];
  lyrics?: string;
  timedLyrics?: TimedLyricLine[];
};
