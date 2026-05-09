"use client";

import { createRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentOrb } from "./AgentOrb";
import { MicButton } from "./MicButton";
import { PlayerCard } from "./PlayerCard";
import { StatusIndicator } from "./StatusIndicator";
import { Button } from "@/components/ui/button";
import { readFeedbackMemory, saveFeedbackRecord } from "@/lib/storage/feedbackMemory";
import { readUserMusicProfile, updateUserMusicProfile } from "@/lib/storage/userMusicProfile";
import { useSpeechRecognition } from "@/lib/speech/useSpeechRecognition";
import { cn } from "@/lib/utils";
import type {
  AgentResolveResponse,
  AgentResolveStreamEvent,
  AgentStatus,
  AgentToolTrace,
  TrackRecommendation,
} from "@/types/agent";
import type { PlayableTrack, TimedLyricLine } from "@/types/music";
import {
  AudioLines,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ListMusic,
  LogIn,
  LogOut,
  MessageCircle,
  Music,
  SendHorizontal,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

type ChatMessage =
  | { role: "user" | "agent" | "system"; content: string }
  | {
      role: "explanation";
      id: string;
      trackTitle: string;
      artist?: string;
      segments: string[];
    };

type LyricDisplayLine = {
  text: string;
  time?: number;
};

function getRecommendations(data: AgentResolveResponse): TrackRecommendation[] {
  if (data.recommendations?.length) return data.recommendations;
  if (!data.track) return [];
  return [{
    track: data.track,
    explanationSegments: data.explanationSegments ?? [],
  }];
}

function getCurrentRecommendation(data: AgentResolveResponse | null): TrackRecommendation | null {
  if (!data?.track) return null;
  return data.recommendations?.find((item) => item.track.id === data.track?.id) ?? {
    track: data.track,
    explanationSegments: data.explanationSegments ?? [],
  };
}

// ── Component ───────────────────────────────────────────

export function MusicAgentWindow() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [inputText, setInputText] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState("");
  const [response, setResponse] = useState<AgentResolveResponse | null>(null);
  const [prevIds, setPrevIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [toolTrace, setToolTrace] = useState<AgentToolTrace[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", content: "嗨，我是你的音乐伙伴。告诉我你现在的感受，我会为你挑一首最适合此刻的歌。" },
  ]);
  const [qqLoggedIn, setQqLoggedIn] = useState(false);
  const [qqLoggingIn, setQqLoggingIn] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playHistory, setPlayHistory] = useState<PlayableTrack[]>([]);
  const [previousRecommendations, setPreviousRecommendations] = useState<TrackRecommendation[]>([]);
  const [recommendationQueue, setRecommendationQueue] = useState<TrackRecommendation[]>([]);
  const [toolTraceExpanded, setToolTraceExpanded] = useState(false);
  const [lyricsLoadingTrackId, setLyricsLoadingTrackId] = useState<string | null>(null);
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
  const autoRetryCountRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lyricLineRefs = useRef<Array<RefObject<HTMLParagraphElement | null>>>([]);
  const track = response?.track ?? null;
  const moodProfile = response?.moodProfile;

  const lyricLines = useMemo<LyricDisplayLine[]>(() => {
    if (track?.timedLyrics?.length) {
      return track.timedLyrics.map((line) => ({ text: line.text, time: line.time }));
    }

    return track?.lyrics
      ? track.lyrics.split("\n").map((line) => line.trim()).filter(Boolean).map((text) => ({ text }))
      : [];
  }, [track?.lyrics, track?.timedLyrics]);
  const lyricDuration = useMemo(() => {
    if (playbackDuration > 0) return playbackDuration;
    if (track?.duration && track.duration > 0) return track.duration;
    if (lyricLines.length > 0) return Math.max(lyricLines.length * 4, 90);
    return 0;
  }, [lyricLines.length, playbackDuration, track?.duration]);
  const activeLyricIndex = useMemo(() => {
    if (lyricLines.length === 0) return -1;
    if (track?.timedLyrics?.length) {
      let activeIndex = 0;
      for (let index = 0; index < track.timedLyrics.length; index += 1) {
        if (track.timedLyrics[index].time <= playbackTime + 0.15) activeIndex = index;
        else break;
      }
      return activeIndex;
    }
    const ratio = lyricDuration > 0 ? Math.min(playbackTime / lyricDuration, 0.999) : 0;
    return Math.floor(ratio * lyricLines.length);
  }, [lyricDuration, lyricLines.length, playbackTime, track?.timedLyrics]);
  lyricLineRefs.current = lyricLines.map((_, index) => lyricLineRefs.current[index] ?? createRef<HTMLParagraphElement>());
  const displayedToolTrace = useMemo(() => {
    if (status === "thinking" || status === "searching") return toolTrace;
    return toolTrace.map((item) =>
      item.status === "running" ? { ...item, status: "success" as const } : item,
    );
  }, [status, toolTrace]);
  const activeToolDetail = useMemo(() => {
    if (status === "thinking" || status === "searching") {
      return displayedToolTrace.find((item) => item.status === "running")?.detail;
    }
    return displayedToolTrace.at(-1)?.detail;
  }, [displayedToolTrace, status]);


  // QQ Music auth check
  useEffect(() => {
    if (window.musicAgentShell?.isElectron) {
      window.musicAgentShell.getQQMusicCookieStatus().then((s) => setQqLoggedIn(s.loggedIn));
    }
  }, []);
  const handleQQLogin = async () => {
    if (!window.musicAgentShell?.isElectron) return;
    setQqLoggingIn(true);
    const r = await window.musicAgentShell.loginQQMusic();
    if (r.success) { setQqLoggedIn(true); setNotice("QQ 音乐登录成功！"); }
    else setNotice("登录已取消。");
    setQqLoggingIn(false);
  };

  const handleQQLogout = async () => {
    if (!window.musicAgentShell?.isElectron) return;
    const r = await window.musicAgentShell.logoutQQMusic();
    if (r.success) {
      setQqLoggedIn(false);
      setNotice("QQ 音乐已退出登录。");
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeLyricIndex < 0) return;
    lyricLineRefs.current[activeLyricIndex]?.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeLyricIndex, track?.id]);

  // Recent conversation context
  const recentConv = useMemo(
    () => messages
      .filter((message): message is Extract<ChatMessage, { role: "user" | "agent" | "system" }> => message.role !== "explanation")
      .slice(-8)
      .map((m) => ({ role: m.role === "user" ? "user" : "agent" as const, content: m.content })),
    [messages],
  );

  // ── Core: resolve track ──────────────────────────────

  const loadLyrics = useCallback(async (targetTrack: PlayableTrack) => {
    if (targetTrack.source !== "qqmusic") return;

    setLyricsLoadingTrackId(targetTrack.id);
    setToolTrace((prev) => [
      ...prev,
      { step: "歌词加载", status: "running", detail: "正在加载 QQ 音乐时间轴歌词…" },
    ]);

    try {
      const params = new URLSearchParams({ source: targetTrack.source, id: targetTrack.id });
      const res = await fetch(`/api/music/lyrics?${params}`);
      const lyricData = (await res.json()) as { lyrics?: string; timedLyrics?: TimedLyricLine[]; error?: string };

      if (!res.ok) throw new Error(lyricData.error || "歌词加载失败。");

      setResponse((current) => {
        if (current?.track?.id !== targetTrack.id) return current;
        return {
          ...current,
          track: {
            ...current.track,
            lyrics: lyricData.lyrics || "",
            timedLyrics: lyricData.timedLyrics || [],
          },
        };
      });
      setToolTrace((prev) => [
        ...prev,
        {
          step: "歌词加载",
          status: lyricData.timedLyrics?.length ? "success" : "failed",
          detail: lyricData.timedLyrics?.length
            ? `已加载 ${lyricData.timedLyrics.length} 行时间轴歌词。`
            : "没有拿到时间轴歌词，使用普通歌词显示。",
        },
      ]);
    } catch (error) {
      setToolTrace((prev) => [
        ...prev,
        {
          step: "歌词加载",
          status: "failed",
          detail: error instanceof Error ? error.message : "歌词加载失败。",
        },
      ]);
    } finally {
      setLyricsLoadingTrackId((id) => (id === targetTrack.id ? null : id));
    }
  }, []);

  const applyTrackRecommendation = useCallback((
    data: AgentResolveResponse,
    recommendation: TrackRecommendation,
    intro?: string,
  ) => {
    const nextResponse: AgentResolveResponse = {
      ...data,
      track: recommendation.track,
      explanationSegments: recommendation.explanationSegments,
    };
    const explanationId = `${recommendation.track.id}-${Date.now()}`;

    setResponse(nextResponse);
    setPlaybackTime(0);
    setPlaybackDuration(recommendation.track.duration ?? 0);
    setPlayHistory((prev) => {
      const next = [recommendation.track, ...prev.filter((item) => item.id !== recommendation.track.id)];
      return next.slice(0, 40);
    });
    setPrevIds((ids) => Array.from(new Set([...ids, recommendation.track.id])));
    setExpandedExplanations((prev) => ({ ...prev, [explanationId]: true }));
    setMessages((p) => [
      ...p,
      {
        role: "agent",
        content: intro ?? `我为你选了《${recommendation.track.title}》${recommendation.track.artist ? ` — ${recommendation.track.artist}` : ""}，听听看。`,
      },
      {
        role: "explanation",
        id: explanationId,
        trackTitle: recommendation.track.title,
        artist: recommendation.track.artist,
        segments: recommendation.explanationSegments,
      },
    ]);
    void loadLyrics(recommendation.track);
  }, [loadLyrics]);

  const applyResolveResponse = useCallback((data: AgentResolveResponse) => {
    if (data.intent === "chat" && data.chatReply) {
      setMessages((p) => [...p, { role: "agent", content: data.chatReply! }]);
      setStatus("idle");
      return;
    }

    const recommendations = getRecommendations(data);
    const [firstRecommendation, ...queuedRecommendations] = recommendations;
    if (firstRecommendation) {
      setRecommendationQueue(queuedRecommendations);
      applyTrackRecommendation(data, firstRecommendation);
    }
  }, [applyTrackRecommendation]);

  const resolveTrack = useCallback(
    async (text: string, extraPrevIds: string[] = []) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setNotice("");
      setStatus("thinking");
      setToolTrace([{ step: "用户画像", status: "running", detail: "正在搜寻用户历史记录和画像 JSON…" }]);
      setLastSubmitted(trimmed);

      const allPrevIds = Array.from(new Set([...prevIds, ...extraPrevIds]));
      const feedbackMemory = readFeedbackMemory();
      const userMusicProfile = readUserMusicProfile();
      setToolTrace((prev) => [
        ...prev,
        {
          step: "用户画像",
          status: "success",
          detail: userMusicProfile.recentEvents.length
            ? "已读取用户画像 JSON 和反馈流水。"
            : "用户画像暂无稳定记录。",
        },
      ]);

      try {
        setStatus("searching");
        const res = await fetch("/api/agent/resolve/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            previousTrackIds: allPrevIds,
            feedbackMemory,
            userMusicProfile,
            recentConversation: recentConv,
          }),
        });

        if (!res.ok || !res.body) {
          setToolTrace((prev) => [
            ...prev,
            { step: "连接", status: "running", detail: "流式接口不可用，正在切换普通接口。" },
          ]);
          const fallbackRes = await fetch("/api/agent/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: trimmed,
              previousTrackIds: allPrevIds,
              feedbackMemory,
              userMusicProfile,
              recentConversation: recentConv,
            }),
          });

          if (!fallbackRes.ok) {
            const err = (await fallbackRes.json().catch(() => null)) as { error?: string } | null;
            throw new Error(err?.error || "暂时没有找到合适的歌。");
          }

          const data = (await fallbackRes.json()) as AgentResolveResponse;
          if (data.toolTrace?.length) setToolTrace(data.toolTrace);
          applyResolveResponse(data);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AgentResolveStreamEvent;

            if (event.type === "trace") {
              setToolTrace((prev) => [...prev, event.trace]);
            } else if (event.type === "result") {
              applyResolveResponse(event.data);
            } else {
              throw new Error(event.error);
            }
          }
        }
      } catch (err) {
        setStatus("error");
        setToolTrace((p) => [...p, { step: "错误", status: "failed", detail: (err as Error).message }]);
        const msg = (err as Error).message;
        setNotice(msg);
        setMessages((p) => [...p, { role: "system", content: msg }]);
      }
    },
    [applyResolveResponse, prevIds, recentConv],
  );

  const playQueuedRecommendation = useCallback((
    intro?: (recommendation: TrackRecommendation) => string,
    options: { pushCurrentToPrevious?: boolean } = {},
  ) => {
    if (!response || recommendationQueue.length === 0) return false;

    const currentRecommendation = getCurrentRecommendation(response);
    const nextRecommendation = recommendationQueue[0];
    if (options.pushCurrentToPrevious !== false && currentRecommendation) {
      setPreviousRecommendations((stack) => [...stack, currentRecommendation].slice(-20));
    }
    setRecommendationQueue((queue) => queue.slice(1));
    setStatus("playing");
    applyTrackRecommendation(response, nextRecommendation, intro?.(nextRecommendation));
    return true;
  }, [applyTrackRecommendation, recommendationQueue, response]);

  const handlePrevious = useCallback(() => {
    if (!response || previousRecommendations.length === 0) return;

    const previousRecommendation = previousRecommendations[previousRecommendations.length - 1];
    const currentRecommendation = getCurrentRecommendation(response);
    setPreviousRecommendations((stack) => stack.slice(0, -1));
    if (currentRecommendation) {
      setRecommendationQueue((queue) => [currentRecommendation, ...queue]);
    }
    setStatus("playing");
    applyTrackRecommendation(
      response,
      previousRecommendation,
      `回到上一首《${previousRecommendation.track.title}》${previousRecommendation.track.artist ? ` — ${previousRecommendation.track.artist}` : ""}。`,
    );
  }, [applyTrackRecommendation, previousRecommendations, response]);

  // ── Speech ────────────────────────────────────────────

  const speech = useSpeechRecognition({
    onFinalText: (t) => { setInputText(t); setStatus("transcribing"); setTimeout(() => setStatus("idle"), 1500); },
    onUnsupported: () => setNotice("当前环境不支持语音识别。"),
    onError: (m) => { setStatus("error"); setNotice(m); },
  });

  // ── Handlers ──────────────────────────────────────────

  const handleSubmit = () => {
    const t = inputText.trim();
    if (!t) return;
    autoRetryCountRef.current = 0;
    setPreviousRecommendations([]);
    setRecommendationQueue([]);
    setMessages((p) => [...p, { role: "user", content: t }]);
    setInputText("");
    void resolveTrack(t);
  };

  const handleNext = useCallback(() => {
    if (!track || !lastSubmitted) return;
    autoRetryCountRef.current = 0;
    saveFeedbackRecord({ track, feedback: "skipped", originalText: lastSubmitted });
    updateUserMusicProfile({
      type: "skipped",
      track,
      moodProfile,
      originalText: lastSubmitted,
      listenedSeconds: playbackTime,
      durationSeconds: playbackDuration,
    });
    setMessages((p) => [
      ...p,
      { role: "user", content: "这首不太对，换一首吧。" },
    ]);
    if (playQueuedRecommendation()) return;
    const currentRecommendation = getCurrentRecommendation(response);
    if (currentRecommendation) {
      setPreviousRecommendations((stack) => [...stack, currentRecommendation].slice(-20));
    }
    setMessages((p) => [...p, { role: "agent", content: "好的，我换个方向为你找。" }]);
    void resolveTrack(lastSubmitted, [track.id]);
  }, [lastSubmitted, moodProfile, playQueuedRecommendation, playbackDuration, playbackTime, resolveTrack, response, track]);

  const handleEnded = useCallback(() => {
    if (!track || !lastSubmitted) return;
    updateUserMusicProfile({
      type: "completed",
      track,
      moodProfile,
      originalText: lastSubmitted,
      listenedSeconds: playbackDuration || playbackTime,
      durationSeconds: playbackDuration,
    });
    if (playQueuedRecommendation((recommendation) => (
      `这首听完了，接着放《${recommendation.track.title}》${recommendation.track.artist ? ` — ${recommendation.track.artist}` : ""}。`
    ))) return;
    const currentRecommendation = getCurrentRecommendation(response);
    if (currentRecommendation) {
      setPreviousRecommendations((stack) => [...stack, currentRecommendation].slice(-20));
    }
    setStatus("ended");
    setMessages((p) => [
      ...p,
      { role: "agent", content: "这三首听完了，我再重新找一组。" },
    ]);
    void resolveTrack(lastSubmitted, [track.id]);
  }, [lastSubmitted, moodProfile, playQueuedRecommendation, playbackDuration, playbackTime, resolveTrack, response, track]);

  const handlePlay = useCallback(() => {
    autoRetryCountRef.current = 0;
    setStatus("playing");
  }, []);
  const handlePause = useCallback(() => setStatus("paused"), []);
  const handlePlayerProgress = useCallback((current: number, duration: number) => {
    setPlaybackTime(current);
    if (duration > 0) setPlaybackDuration(duration);
  }, []);
  const handlePlayerError = useCallback((reason?: string) => {
    if (track) {
      updateUserMusicProfile({
        type: "play_error",
        track,
        moodProfile,
        originalText: lastSubmitted,
        listenedSeconds: playbackTime,
        durationSeconds: playbackDuration,
      });
    }
    if (track && lastSubmitted && recommendationQueue.length > 0) {
      autoRetryCountRef.current += 1;
      setMessages((p) => [
        ...p,
        { role: "agent", content: "这首歌没有拿到可播放链接，我先切到备用候选。" },
      ]);
      if (playQueuedRecommendation(undefined, { pushCurrentToPrevious: false })) return;
    }
    if (track && lastSubmitted && autoRetryCountRef.current < 3) {
      autoRetryCountRef.current += 1;
      setMessages((p) => [
        ...p,
        { role: "agent", content: "这首歌没有拿到可播放链接，我换一首能播的。" },
      ]);
      void resolveTrack(lastSubmitted, [track.id]);
      return;
    }
    setStatus("error");
    setNotice(reason || "播放出错了，请点击下一首或重新描述感受。");
  }, [lastSubmitted, moodProfile, playQueuedRecommendation, playbackDuration, playbackTime, recommendationQueue.length, resolveTrack, track]);

  const canSubmit = useMemo(
    () => inputText.trim().length > 0 && !["thinking", "searching"].includes(status),
    [inputText, status],
  );

  // ── Render ────────────────────────────────────────────

  return (
    <div className="h-screen w-screen overflow-hidden bg-background p-3">
      <main className="grid h-full min-h-0 grid-cols-[250px_minmax(340px,1fr)_minmax(360px,0.95fr)] gap-3">
        <aside className="flex min-h-0 flex-col rounded-[28px] border border-white/70 bg-white/45 shadow-sm backdrop-blur-xl">
          <div className="shrink-0 px-4 pt-5">
            <div className="flex items-center gap-3">
              <AgentOrb status={status} />
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
                  MoodPlayer
                </h1>
                <p className="truncate text-xs text-muted/65">用音乐理解每一种情绪</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={handleQQLogin}
                disabled={qqLoggingIn}
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-2 rounded-2xl text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-rose/30",
                  qqLoggedIn
                    ? "bg-success/10 text-success"
                    : qqLoggingIn
                      ? "bg-rose-surface/70 text-rose/55"
                      : "bg-white/70 text-muted/65 hover:bg-rose-surface hover:text-rose/75",
                )}
              >
                {qqLoggingIn ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose/20 border-t-rose" aria-hidden="true" />
                ) : qqLoggedIn ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <LogIn size={14} aria-hidden="true" />
                )}
                {qqLoggingIn ? "登录中…" : qqLoggedIn ? "QQ 已登录" : "登录 QQ 音乐"}
              </button>

              {qqLoggedIn && (
                <button
                  type="button"
                  onClick={handleQQLogout}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-2xl bg-white/60 text-xs font-medium text-muted/60 transition-colors hover:bg-rose-surface/70 hover:text-rose/75 focus-visible:ring-2 focus-visible:ring-rose/30"
                >
                  <LogOut size={14} aria-hidden="true" />
                  退出 QQ 登录
                </button>
              )}
            </div>

            <div className="mt-4">
              <StatusIndicator status={status} detail={activeToolDetail} />
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 border-t border-border/35 px-3 py-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground/75">
                <ListMusic size={15} className="text-rose/70" aria-hidden="true" />
                历史播放
              </div>
              <span className="text-[11px] tabular-nums text-muted/60">{playHistory.length} 首</span>
            </div>

            {playHistory.length === 0 ? (
              <p className="rounded-2xl border border-white/70 bg-white/55 px-3 py-3 text-xs leading-5 text-muted/65">
                还没有播放记录，先说一句你想听什么。
              </p>
            ) : (
              <div className="no-scrollbar h-full space-y-2 overflow-y-auto pr-1">
                {playHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/70 bg-white/55 px-2.5 py-2"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-rose-surface">
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.coverUrl}
                          alt=""
                          width={44}
                          height={44}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music size={16} className="text-rose/35" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground/85">{item.title}</p>
                      <p className="truncate text-[11px] text-muted/60">{item.artist || "未知歌手"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col rounded-[28px] border border-white/70 bg-white/40 shadow-sm backdrop-blur-xl">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/30 px-5">
            <div className="flex items-center gap-2">
              <Music size={17} className="text-rose/70" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground/80">播放空间</h2>
            </div>
            {track && (
              <div className="flex max-w-[52%] items-center gap-2 rounded-full bg-white/65 px-3 py-1 text-[11px] text-muted/70">
                <Clock3 size={13} className="shrink-0 text-rose/60" aria-hidden="true" />
                <span className="truncate">{track.artist || "未知歌手"}</span>
              </div>
            )}
          </div>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="mx-auto flex w-full max-w-[500px] flex-col gap-4">
              <AnimatePresence mode="wait">
                {track ? (
                  <motion.div
                    key="player"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <PlayerCard
                      track={track}
                      status={status}
                      onPlay={handlePlay}
                      onPause={handlePause}
                      onPrevious={handlePrevious}
                      onError={handlePlayerError}
                      onNext={handleNext}
                      onEnded={handleEnded}
                      onProgress={handlePlayerProgress}
                      hasPrevious={previousRecommendations.length > 0}
                      voiceCaptureActive={speech.isListening || status === "listening" || status === "transcribing"}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid min-h-[420px] place-items-center rounded-[28px] border border-white/60 bg-white/40 px-8 text-center"
                  >
                    <div>
                      <div className="mx-auto grid h-24 w-24 place-items-center rounded-[24px] bg-rose-surface shadow-inner">
                        <Music size={34} className="text-rose/35" strokeWidth={1.4} aria-hidden="true" />
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted/60">
                        告诉我你的感受，音乐会在这里开始。
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="rounded-[24px] border border-white/65 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground/75">
                    <AudioLines size={15} className="text-rose/70" aria-hidden="true" />
                    当前歌词
                  </div>
                  {lyricsLoadingTrackId === track?.id ? (
                    <span className="text-[11px] text-muted/55">加载中…</span>
                  ) : lyricLines.length > 0 && (
                    <span className="text-[11px] tabular-nums text-muted/55">
                      {Math.max(activeLyricIndex + 1, 1)} / {lyricLines.length}
                    </span>
                  )}
                </div>
                <div className="no-scrollbar max-h-[260px] overflow-y-auto pr-1 text-sm leading-7">
                  {lyricLines.length > 0 ? (
                    <div className="space-y-1">
                      {lyricLines.map((line, idx) => (
                        <motion.p
                          key={`${line.time ?? idx}-${line.text}`}
                          ref={lyricLineRefs.current[idx]}
                          initial={{ opacity: 0.45, y: 3 }}
                          animate={{
                            opacity: idx === activeLyricIndex ? 1 : 0.45,
                            y: idx === activeLyricIndex ? 0 : 1,
                            scale: idx === activeLyricIndex ? 1.01 : 1,
                          }}
                          transition={{ duration: 0.35 }}
                          className={cn(
                            "rounded-xl px-3 py-1",
                            idx === activeLyricIndex
                              ? "bg-rose-surface text-foreground shadow-xs"
                              : "text-muted/75",
                          )}
                        >
                          {line.text}
                        </motion.p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted/60">
                      {lyricsLoadingTrackId === track?.id
                        ? "正在加载歌词…"
                        : "这首歌暂时没有可用歌词，先让旋律陪你一会儿。"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col rounded-[28px] border border-white/70 bg-white/45 shadow-sm backdrop-blur-xl">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/30 px-5">
            <div className="flex items-center gap-2">
              <MessageCircle size={17} className="text-rose/70" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground/80">对话</h2>
            </div>
            {qqLoggedIn && (
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success/75">
                QQ 曲库
              </span>
            )}
          </div>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-3">
              {messages.map((msg, i) => {
                if (msg.role === "explanation") {
                  const expanded = expandedExplanations[msg.id] ?? true;

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="w-[82%] rounded-[22px] border border-white/70 bg-white/65 p-3 shadow-xs backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={() => setExpandedExplanations((prev) => ({ ...prev, [msg.id]: !expanded }))}
                          className="flex w-full items-center justify-between gap-3 text-left focus-visible:ring-2 focus-visible:ring-rose/30"
                          aria-expanded={expanded}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground/78">推荐理由</p>
                            <p className="truncate text-[11px] text-muted/65">
                              《{msg.trackTitle}》{msg.artist ? ` - ${msg.artist}` : ""}
                            </p>
                          </div>
                          {expanded ? (
                            <ChevronDown size={15} className="shrink-0 text-muted/70" aria-hidden="true" />
                          ) : (
                            <ChevronRight size={15} className="shrink-0 text-muted/70" aria-hidden="true" />
                          )}
                        </button>

                        <AnimatePresence initial={false}>
                          {expanded && msg.segments.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 space-y-2">
                                {msg.segments.map((segment, segmentIndex) => (
                                  <p
                                    key={`${msg.id}-${segmentIndex}`}
                                    className="rounded-2xl bg-rose-surface/60 px-3 py-2 text-sm leading-relaxed text-foreground/78"
                                  >
                                    {segment}
                                  </p>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={`${msg.role}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={cn(
                        "max-w-[82%] rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-xs",
                        msg.role === "user"
                          ? "rounded-br-md border border-[#ebcbd4] bg-[#f7e8ed] text-[#4a343d] shadow-[0_8px_24px_rgba(184,112,133,0.12)]"
                          : msg.role === "system"
                            ? "bg-amber-50/85 text-xs text-amber-800/80"
                            : "rounded-bl-md border border-white/70 bg-white/75 text-foreground/80 backdrop-blur-sm",
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}

              {displayedToolTrace.length > 0 && (
                <div className="rounded-[20px] border border-border/40 bg-white/45 p-3">
                  <button
                    type="button"
                    onClick={() => setToolTraceExpanded((v) => !v)}
                    className="flex w-full items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-rose/30"
                    aria-expanded={toolTraceExpanded}
                  >
                    <span className="text-xs font-semibold text-foreground/75">工具执行状态</span>
                    {toolTraceExpanded ? (
                      <ChevronDown size={15} className="text-muted/70" aria-hidden="true" />
                    ) : (
                      <ChevronRight size={15} className="text-muted/70" aria-hidden="true" />
                    )}
                  </button>

                  {activeToolDetail && (
                    <div className="mt-2 rounded-2xl bg-white/60 px-3 py-2 text-xs leading-5 text-foreground/70" aria-live="polite">
                      {activeToolDetail}
                    </div>
                  )}

                  {toolTraceExpanded && (
                    <div className="no-scrollbar mt-2 max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
                      {displayedToolTrace.map((t, idx) => (
                        <div key={`${t.step}-${idx}`} className="rounded-2xl bg-surface/70 px-3 py-2 text-xs leading-5 text-foreground/70">
                          <span className="font-medium">{t.step}</span>
                          <span className="mx-1 text-muted/45">/</span>
                          <span className={cn(
                            t.status === "failed" ? "text-amber-700/80" : t.status === "running" ? "text-rose/75" : "text-success/80",
                          )}>
                            {t.status === "running" ? "执行中" : t.status === "success" ? "完成" : "失败"}
                          </span>
                          <span className="ml-1 text-muted/75">{t.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {notice && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-surface/60 px-4 py-2 text-center text-xs text-muted/70"
                  aria-live="polite"
                >
                  {notice}
                </motion.div>
              )}

              {(status === "thinking" || status === "searching") && (
                <div className="flex justify-start">
                  <div className="rounded-[22px] rounded-bl-md bg-white/70 px-4 py-3 shadow-xs" aria-label="正在输入">
                    <span className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose/45 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose/45 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose/45 [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-border/30 px-4 py-4">
            <form
              onSubmit={(e) => { e.preventDefault(); if (canSubmit) handleSubmit(); }}
              className="relative"
            >
              <textarea
                name="mood-message"
                aria-label="输入你的感受或聊天内容"
                autoComplete="off"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="说说你现在的感受，或者跟我聊聊天…"
                rows={2}
                className="no-scrollbar h-[92px] w-full resize-none overflow-y-auto rounded-[24px] border border-border/50 bg-white/70 px-4 py-3 pr-32 text-sm leading-relaxed text-foreground placeholder:text-muted/40 transition-colors focus:border-rose/25 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSubmit) handleSubmit();
                  }
                }}
              />
              <div className="absolute bottom-2.5 right-2.5 flex max-w-[46%] items-center justify-end gap-1">
                <MicButton
                  isListening={speech.isListening}
                  isSupported={speech.isSupported}
                  onStart={() => { setStatus("listening"); speech.start(); }}
                  onStop={speech.stop}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit}
                  aria-label="发送"
                  className="min-w-16 bg-foreground text-white hover:bg-foreground/90"
                >
                  {status === "thinking" || status === "searching" ? (
                    "…"
                  ) : (
                    <>
                      <SendHorizontal size={13} aria-hidden="true" />
                      发送
                    </>
                  )}
                </Button>
              </div>
            </form>

            {speech.interimText && speech.isListening && (
              <div className="mt-2 rounded-2xl bg-rose-surface/45 px-3 py-1.5 text-xs italic text-muted/65" aria-live="polite">
                {speech.interimText}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
