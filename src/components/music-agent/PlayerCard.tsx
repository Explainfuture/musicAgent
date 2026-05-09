"use client";

import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Music } from "lucide-react";
import type { AgentStatus } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function describeMediaError(code?: number) {
  if (code === 2) return "网络连接中断";
  if (code === 3) return "音频解码失败";
  if (code === 4) return "音频地址不可用";
  return "媒体加载失败";
}

function getAudioErrorMessage(audio: HTMLAudioElement) {
  return `播放失败：${describeMediaError(audio.error?.code)}`;
}

function getSafeDuration(audio: HTMLAudioElement, fallback = 0) {
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallback;
}

function clampVolume(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function PlayerCard({
  track,
  status,
  onPlay,
  onPause,
  onError,
  onPrevious,
  onNext,
  onEnded,
  onProgress,
  hasPrevious,
  voiceCaptureActive,
}: {
  track: PlayableTrack | null;
  status: AgentStatus;
  onPlay: () => void;
  onPause: () => void;
  onError: (reason?: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onEnded: () => void;
  onProgress?: (current: number, duration: number) => void;
  hasPrevious: boolean;
  voiceCaptureActive: boolean;
}) {
  const getQQMusicFriendlyNotice = useCallback((rawError: string | null | undefined) => {
    if (!rawError) return "获取播放链接失败，请稍后再试。";
    if (rawError.includes("No QQ Music cookie")) {
      return "QQ 音乐登录已失效，请重新点击“登录 QQ 音乐”后再试。";
    }
    if (rawError.includes("vkey code 104009") || rawError.includes("invalidq")) {
      return "QQ 音乐返回签名校验失败，请重新登录 QQ 音乐后重试。";
    }
    if (rawError.includes("vkey code 200001")) {
      return "该歌曲可能需要会员权限，正在尝试换一首。";
    }
    if (rawError.includes("HTTP 403")) {
      return "QQ 音乐请求被拒绝，请稍后重试或重新登录。";
    }
    return `获取播放链接失败: ${rawError}`;
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [notice, setNotice] = useState("");
  const [needsManual, setNeedsManual] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const requestedQQTrackRef = useRef<string | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const suppressPauseRef = useRef(false);
  const voiceWasPlayingRef = useRef(false);
  const restoreVolumeRef = useRef(1);

  const cancelFade = useCallback(() => {
    if (fadeFrameRef.current !== null) {
      window.cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
  }, []);

  const fadeVolume = useCallback((target: number, durationMs: number, onDone?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;

    cancelFade();
    const startVolume = clampVolume(audio.volume);
    const endVolume = clampVolume(target);
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      audio.volume = clampVolume(startVolume + (endVolume - startVolume) * progress);

      if (progress < 1) {
        fadeFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        fadeFrameRef.current = null;
        audio.volume = endVolume;
        onDone?.();
      }
    };

    fadeFrameRef.current = window.requestAnimationFrame(tick);
  }, [cancelFade]);

  // For QQ Music tracks, fetch play URL via Electron IPC
  useEffect(() => {
    if (!track) return;
    if (track.source !== "qqmusic") {
      requestedQQTrackRef.current = null;
      setResolvedUrl(null);
      return;
    }
    if (track.audioUrl) {
      requestedQQTrackRef.current = null;
      setResolvedUrl(null);
      return;
    }
    if (requestedQQTrackRef.current === track.id) return;
    requestedQQTrackRef.current = track.id;

    // Need to fetch vkey via Electron IPC
    if (window.musicAgentShell?.isElectron) {
      setFetchingUrl(true);
      const requestedTrackId = track.id;
      const songmid = track.id.replace("qqmusic_", "");
      window.musicAgentShell.getQQMusicPlayUrl(songmid).then(({ url, error }) => {
        if (requestedQQTrackRef.current !== requestedTrackId) return;
        setFetchingUrl(false);
        if (url) {
          setResolvedUrl(url);
        } else {
          setNotice(getQQMusicFriendlyNotice(error));
          onError(error || "purl empty");
        }
      });
    } else {
      // In browser dev mode, just use the track's audioUrl if available
      setNotice("QQ 音乐播放需要 Electron 客户端。");
    }
  }, [track, onError, getQQMusicFriendlyNotice]);

  const effectiveUrl = resolvedUrl || track?.audioUrl || null;

  const attemptPlay = useCallback(async () => {
    const a = audioRef.current;
    if (!a || !effectiveUrl) return;
    // Update src if it changed
    if (a.src !== effectiveUrl) {
      a.src = effectiveUrl;
      a.load();
    }
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
        onError("audio play failed");
      }
    }
  }, [onError, onPlay, effectiveUrl]);

  useEffect(() => {
    setNotice("");
    setNeedsManual(false);
    setCurrentTime(0);
    setDuration(track?.duration ?? 0);
    onProgress?.(0, track?.duration ?? 0);
  }, [track?.id, track?.duration, onProgress]);

  useEffect(() => {
    if (!fetchingUrl && effectiveUrl && !voiceCaptureActive && status !== "paused") {
      void attemptPlay();
    }
  }, [attemptPlay, effectiveUrl, fetchingUrl, status, voiceCaptureActive]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (voiceCaptureActive) {
      voiceWasPlayingRef.current = !audio.paused && !audio.ended;
      restoreVolumeRef.current = audio.volume > 0 ? clampVolume(audio.volume) : 1;

      if (voiceWasPlayingRef.current) {
        fadeVolume(0, 450, () => {
          suppressPauseRef.current = true;
          audio.pause();
          audio.volume = 0;
        });
      }
      return;
    }

    if (voiceWasPlayingRef.current && effectiveUrl) {
      voiceWasPlayingRef.current = false;
      audio.volume = 0;
      void audio.play().then(() => {
        onPlay();
        fadeVolume(restoreVolumeRef.current || 1, 450);
      }).catch(() => {
        setNotice("语音结束后恢复播放失败，请手动点播放。");
      });
    }
  }, [effectiveUrl, fadeVolume, onPlay, voiceCaptureActive]);

  useEffect(() => cancelFade, [cancelFade]);

  if (!track) return null;

  const isPlaying = status === "playing";
  const buffering = status === "thinking" || status === "searching";
  const displayDuration = duration > 0 ? duration : track.duration ?? 0;
  const progress = displayDuration > 0 ? Math.min((currentTime / displayDuration) * 100, 100) : 0;

  const syncProgress = (audio: HTMLAudioElement) => {
    const nextTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const nextDuration = getSafeDuration(audio, track.duration ?? displayDuration);
    if (!seeking) setCurrentTime(nextTime);
    setDuration(nextDuration);
    onProgress?.(nextTime, nextDuration);
  };

  const toggle = () => {
    if (!effectiveUrl || !audioRef.current) {
      if (isPlaying) onPause();
      else onPlay();
      return;
    }
    if (audioRef.current.paused) void attemptPlay();
    else { audioRef.current.pause(); onPause(); }
  };

  const seek = (v: number) => {
    if (!audioRef.current || !Number.isFinite(v)) return;
    audioRef.current.currentTime = v;
    setCurrentTime(v);
    onProgress?.(v, displayDuration);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel flex w-full flex-col rounded-[28px] border border-white/65 bg-white/60 p-5 shadow-lg backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase text-muted/55" translate="no">
            Now Playing
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{track.title}</p>
        </div>
        <span className="shrink-0 rounded-full border border-rose/10 bg-rose-surface px-2 py-1 text-[10px] font-semibold uppercase text-rose/70" translate="no">
          {track.source}
        </span>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[250px] overflow-hidden rounded-[24px] border border-white/70 bg-surface-muted shadow-md">
        {track.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.coverUrl}
            alt=""
            width={250}
            height={250}
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-light/30 via-rose-surface to-surface-muted">
            <Music size={40} className="text-rose/30" strokeWidth={1} aria-hidden="true" />
          </div>
        )}
        {isPlaying && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/[0.04] to-transparent" />
        )}
      </div>

      <div className="mt-5 w-full text-center">
        <p className="truncate px-2 text-lg font-semibold leading-snug text-foreground text-pretty">
          {track.title}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="max-w-full truncate text-sm text-muted">{track.artist || "Unknown"}</p>
        </div>
      </div>

      <div className="mt-5 w-full">
        <input
          type="range"
          min={0}
          max={displayDuration || Math.max(currentTime, 1)}
          step="0.1"
          value={Math.min(currentTime, displayDuration || currentTime)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => seek(Number(e.target.value))}
          onPointerDown={(e: PointerEvent<HTMLInputElement>) => { e.stopPropagation(); setSeeking(true); }}
          onPointerUp={(e: PointerEvent<HTMLInputElement>) => { e.stopPropagation(); setSeeking(false); }}
          onClick={(e) => e.stopPropagation()}
          className="w-full focus-visible:ring-2 focus-visible:ring-rose/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          style={{
            background: `linear-gradient(to right, var(--color-rose) ${progress}%, var(--color-rose-light) ${progress}%)`,
          }}
          aria-label="播放进度"
        />
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted/55">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(displayDuration)}</span>
        </div>
      </div>

      {fetchingUrl && (
        <p className="mt-3 animate-pulse text-xs text-muted/60" aria-live="polite">
          正在获取播放链接…
        </p>
      )}

      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious || voiceCaptureActive}
          aria-label="上一首"
          className="grid h-11 w-11 place-items-center rounded-full text-muted/55 transition-colors hover:bg-rose-surface/70 hover:text-rose/70 disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-rose/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <SkipBack size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggle}
          disabled={buffering || voiceCaptureActive}
          aria-label={isPlaying ? "暂停" : "播放"}
          className="grid h-14 w-14 place-items-center rounded-full bg-foreground text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-rose/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          {buffering ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          ) : isPlaying ? (
            <Pause size={20} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={20} fill="currentColor" className="ml-0.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="下一首"
          className="grid h-11 w-11 place-items-center rounded-full text-muted/55 transition-colors hover:bg-rose-surface/70 hover:text-rose/70 focus-visible:ring-2 focus-visible:ring-rose/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <SkipForward size={20} aria-hidden="true" />
        </button>
      </div>

      {notice && (
        <p className="mt-3 rounded-xl bg-amber-50/70 px-3 py-2 text-center text-xs text-amber-800/70" aria-live="polite">
          {notice}
        </p>
      )}

      {effectiveUrl && (
        <audio
          ref={audioRef}
          src={effectiveUrl}
          autoPlay
          preload="auto"
          className="hidden"
          onCanPlay={() => void attemptPlay()}
          onLoadedMetadata={(e) => syncProgress(e.currentTarget)}
          onDurationChange={(e) => syncProgress(e.currentTarget)}
          onTimeUpdate={(e) => syncProgress(e.currentTarget)}
          onPlay={onPlay}
          onPause={(e) => {
            if (suppressPauseRef.current) {
              suppressPauseRef.current = false;
              return;
            }
            if (!e.currentTarget.ended && !e.currentTarget.error) onPause();
          }}
          onEnded={onEnded}
          onError={(e) => {
            const message = getAudioErrorMessage(e.currentTarget);
            setNotice(message);
            onError(message);
          }}
        />
      )}
    </motion.div>
  );
}
