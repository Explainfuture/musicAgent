"use client";

import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
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
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

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
        setPlaybackNotice("点击播放按钮即可出声");
        return;
      }
      setPlaybackNotice("音频播放失败，让我换一首。");
      onError();
    }
  }, [onError, onPlay]);

  useEffect(() => {
    setPlaybackNotice("");
    setNeedsManualPlay(false);
    setCurrentTime(0);
    setDuration(0);
    void attemptPlay();
  }, [attemptPlay, track]);

  if (!track) return null;

  const isPlaying = status === "playing";
  const isBuffering = status === "thinking" || status === "searching";

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      void attemptPlay();
    } else {
      audioRef.current.pause();
      onPause();
    }
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const handleRangeChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleSeek(Number(event.target.value));
  };

  const stopSeekPointer = (event: PointerEvent<HTMLInputElement>) => {
    event.stopPropagation();
    setIsSeeking(event.type === "pointerdown");
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const restSeconds = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${restSeconds}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col items-center">
      {/* Cover art — the hero */}
      <div className="relative w-full max-w-[195px] overflow-hidden rounded-[22px] bg-gradient-to-br from-rose-pink/15 via-peach/12 to-lavender-pink/12 shadow-[0_10px_32px_rgba(190,120,140,0.16)] aspect-square">
        {track.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-12 w-12 text-rose-pink/25"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}

        {/* Playing overlay glow */}
        {isPlaying && (
          <div className="absolute inset-0 bg-gradient-to-t from-rose-pink/10 to-transparent" />
        )}
      </div>

      {/* Track info */}
      <div className="mt-3 w-full text-center">
        <p className="truncate px-2 text-[14px] font-semibold leading-tight text-plum">
          {track.title}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="truncate text-[12px] text-muted-plum">
            {track.artist || "Unknown Artist"}
          </p>
          <span className="shrink-0 rounded-full bg-rose-pink/8 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-pink/65">
            {track.source}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-full max-w-[220px]">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || currentTime)}
          onChange={handleRangeChange}
          onPointerDown={stopSeekPointer}
          onPointerUp={stopSeekPointer}
          onClick={(event) => event.stopPropagation()}
          className="progress-slider h-1 w-full cursor-pointer appearance-none rounded-full"
          aria-label="播放进度"
          style={{
            background: `linear-gradient(to right, #d48197 ${progress}%, rgba(232,160,180,0.12) ${progress}%)`,
          }}
        />
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-plum/55">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-3">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isBuffering}
          className="grid h-[42px] w-[42px] place-items-center rounded-full bg-gradient-to-br from-rose-pink to-dusty-rose text-white shadow-[0_5px_20px_rgba(200,130,150,0.28)] transition-all hover:shadow-[0_7px_24px_rgba(200,130,150,0.38)] hover:brightness-105 active:scale-95 disabled:opacity-50"
        >
          {isBuffering ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : isPlaying ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          type="button"
          onClick={onNext}
          className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/60 text-rose-pink/50 transition-all hover:bg-rose-pink/8 hover:text-rose-pink/70 active:scale-95"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>

      {playbackNotice && (
        <div className="mt-3 w-full rounded-xl bg-amber-50/60 px-3 py-2 text-center text-[11px] text-amber-800/70">
          {playbackNotice}
        </div>
      )}

      <audio
        ref={audioRef}
        src={track.audioUrl}
        autoPlay
        preload="auto"
        className="hidden"
        onCanPlay={() => void attemptPlay()}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => {
          if (!isSeeking) {
            setCurrentTime(event.currentTarget.currentTime || 0);
          }
        }}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onNext}
        onError={() => {
          setPlaybackNotice("音频播放失败，让我换一首。");
          onError();
        }}
      />
    </div>
  );
}
