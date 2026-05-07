"use client";

import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipForward, Music } from "lucide-react";
import type { AgentStatus } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

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
  const [notice, setNotice] = useState("");
  const [needsManual, setNeedsManual] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);

  const attemptPlay = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.muted = false;
      a.volume = 1;
      await a.play();
      setNeedsManual(false);
      setNotice("");
      onPlay();
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setNeedsManual(true);
        setNotice("点击播放按钮即可出声");
      } else {
        setNotice("播放失败，让我换一首");
        onError();
      }
    }
  }, [onError, onPlay]);

  useEffect(() => {
    setNotice("");
    setNeedsManual(false);
    setCurrentTime(0);
    setDuration(0);
    void attemptPlay();
  }, [attemptPlay, track]);

  if (!track) return null;

  const isPlaying = status === "playing";
  const buffering = status === "thinking" || status === "searching";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const toggle = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) void attemptPlay();
    else { audioRef.current.pause(); onPause(); }
  };

  const seek = (v: number) => {
    if (!audioRef.current || !Number.isFinite(v)) return;
    audioRef.current.currentTime = v;
    setCurrentTime(v);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center"
    >
      {/* Cover art */}
      <div className="relative w-full max-w-[220px] overflow-hidden rounded-2xl shadow-lg aspect-square">
        {track.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-light/30 via-rose-surface to-surface-muted">
            <Music size={40} className="text-rose/30" strokeWidth={1} />
          </div>
        )}
        {isPlaying && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/[0.04] to-transparent" />
        )}
      </div>

      {/* Track info */}
      <div className="mt-4 w-full text-center">
        <p className="truncate px-2 text-base font-semibold text-foreground leading-snug">
          {track.title}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="truncate text-sm text-muted">{track.artist || "Unknown"}</p>
          <span className="shrink-0 rounded-full bg-rose-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose/70">
            {track.source}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4 w-full max-w-[240px]">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => seek(Number(e.target.value))}
          onPointerDown={(e: PointerEvent<HTMLInputElement>) => { e.stopPropagation(); setSeeking(true); }}
          onPointerUp={(e: PointerEvent<HTMLInputElement>) => { e.stopPropagation(); setSeeking(false); }}
          onClick={(e) => e.stopPropagation()}
          className="w-full"
          style={{
            background: `linear-gradient(to right, var(--color-rose) ${progress}%, var(--color-rose-light) ${progress}%)`,
          }}
          aria-label="播放进度"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted/50">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={buffering}
          className="grid h-11 w-11 place-items-center rounded-full bg-foreground text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
        >
          {buffering ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          ) : isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="grid h-9 w-9 place-items-center rounded-full text-muted/50 transition-colors hover:bg-rose-surface/50 hover:text-rose/60"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {notice && (
        <p className="mt-3 rounded-xl bg-amber-50/60 px-3 py-2 text-center text-xs text-amber-800/60">
          {notice}
        </p>
      )}

      <audio
        ref={audioRef}
        src={track.audioUrl}
        autoPlay
        preload="auto"
        className="hidden"
        onCanPlay={() => void attemptPlay()}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => { if (!seeking) setCurrentTime(e.currentTarget.currentTime || 0); }}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onNext}
        onError={() => { setNotice("播放失败，让我换一首"); onError(); }}
      />
    </motion.div>
  );
}
