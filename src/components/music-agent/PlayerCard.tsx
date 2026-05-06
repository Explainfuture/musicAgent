"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentStatus } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

export function PlayerCard({
  track,
  status,
  onPlay,
  onPause,
  onError,
  onNext,
}: {
  track: PlayableTrack | null;
  status: AgentStatus;
  onPlay: () => void;
  onPause: () => void;
  onError: () => void;
  onNext: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState("");
  const [needsManualPlay, setNeedsManualPlay] = useState(false);

  const attemptPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.muted = false;
      audio.volume = 1;
      await audio.play();
      setNeedsManualPlay(false);
      setPlaybackNotice("");
      onPlay();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError") {
        setNeedsManualPlay(true);
        setPlaybackNotice("系统拦截了自动播放，点一下“播放这首”就能出声。");
        return;
      }

      setPlaybackNotice("这条音频流没播起来，我会换一首。");
      onError();
    }
  }, [onError, onPlay]);

  useEffect(() => {
    setPlaybackNotice("");
    setNeedsManualPlay(false);
    void attemptPlay();
  }, [attemptPlay, track]);

  if (!track) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-400/20 bg-black/30 p-4 text-sm text-emerald-700">
        $ player --empty<br />
        还没有播放歌曲。说一句你的状态，我直接给你放一首。
      </div>
    );
  }

  const handleTogglePlay = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      void attemptPlay();
    } else {
      audioRef.current.pause();
    }
  };

  return (
    <section className="rounded-xl border border-emerald-400/20 bg-black/35 p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900 to-sky-950">
          {track.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-emerald-50">
            {track.title}
          </div>
          <div className="truncate text-xs text-emerald-500">
            {track.artist || "Unknown Artist"}
          </div>
          <span className="mt-2 inline-flex rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
            {track.source}
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleTogglePlay}
          className="flex-1 rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-300"
        >
          {needsManualPlay || status === "paused" ? "播放这首" : "暂停"}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-white/15"
        >
          换一首
        </button>
      </div>

      {playbackNotice ? (
        <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          {playbackNotice}
        </p>
      ) : null}

      <audio
        ref={audioRef}
        src={track.audioUrl}
        controls
        autoPlay
        preload="auto"
        className="mt-4 w-full"
        onCanPlay={() => void attemptPlay()}
        onPlay={onPlay}
        onPause={onPause}
        onError={() => {
          setPlaybackNotice("这条音频流没播起来，我会换一首。");
          onError();
        }}
      />
    </section>
  );
}
