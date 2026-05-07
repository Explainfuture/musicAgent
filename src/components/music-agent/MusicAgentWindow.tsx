"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentOrb } from "./AgentOrb";
import { ExplanationStream } from "./ExplanationStream";
import { MicButton } from "./MicButton";
import { PlayerCard } from "./PlayerCard";
import { StatusIndicator } from "./StatusIndicator";
import { Button } from "@/components/ui/button";
import { readFeedbackMemory, saveFeedbackRecord } from "@/lib/storage/feedbackMemory";
import { useSpeechRecognition } from "@/lib/speech/useSpeechRecognition";
import { cn } from "@/lib/utils";
import type { AgentResolveResponse, AgentStatus, AgentToolTrace } from "@/types/agent";
import { Music, LogIn, CheckCircle2, LogOut, AudioLines } from "lucide-react";

// ── Types ──────────────────────────────────────────────

type ChatMessage = { role: "user" | "agent" | "system"; content: string };

// ── Component ───────────────────────────────────────────

export function MusicAgentWindow() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [inputText, setInputText] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState("");
  const [response, setResponse] = useState<AgentResolveResponse | null>(null);
  const [explanationSegments, setExplanationSegments] = useState<string[]>([]);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const track = response?.track ?? null;

  const lyricLines = useMemo(
    () => (track?.lyrics ? track.lyrics.split("\n").map((line) => line.trim()).filter(Boolean) : []),
    [track?.lyrics],
  );
  const activeLyricIndex = useMemo(() => {
    if (lyricLines.length === 0) return -1;
    const ratio = playbackDuration > 0 ? Math.min(playbackTime / playbackDuration, 0.999) : 0;
    return Math.floor(ratio * lyricLines.length);
  }, [lyricLines.length, playbackDuration, playbackTime]);


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
  }, [messages, explanationSegments]);

  // Recent conversation context
  const recentConv = useMemo(
    () => messages.slice(-8).map((m) => ({ role: m.role === "user" ? "user" : "agent" as const, content: m.content })),
    [messages],
  );

  // ── Core: resolve track ──────────────────────────────

  const resolveTrack = useCallback(
    async (text: string, extraPrevIds: string[] = []) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setNotice("");
      setStatus("thinking");
      setToolTrace([{ step: "思考", status: "running", detail: "正在理解你的输入并规划处理步骤..." }]);
      setExplanationSegments([]);
      setLastSubmitted(trimmed);

      const allPrevIds = Array.from(new Set([...prevIds, ...extraPrevIds]));

      try {
        setStatus("searching");
        const res = await fetch("/api/agent/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            previousTrackIds: allPrevIds,
            feedbackMemory: readFeedbackMemory(),
            recentConversation: recentConv,
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error || "暂时没有找到合适的歌。");
        }

        const data = (await res.json()) as AgentResolveResponse;
        if (data.toolTrace?.length) setToolTrace(data.toolTrace);

        // Chat mode
        if (data.intent === "chat" && data.chatReply) {
          setMessages((p) => [...p, { role: "agent", content: data.chatReply! }]);
          setStatus("idle");
          setToolTrace([]);
          setExplanationSegments([]);
          return;
        }

        // Music mode
        if (data.track) {
          setResponse(data);
          setExplanationSegments(data.explanationSegments ?? []);
          setPrevIds((ids) => Array.from(new Set([...ids, data.track!.id])));
          setMessages((p) => [
            ...p,
            { role: "agent", content: `我为你选了《${data.track!.title}》${data.track!.artist ? ` — ${data.track!.artist}` : ""}，听听看。` },
          ]);
          setStatus("playing");
        }
      } catch (err) {
        setStatus("error");
        setToolTrace((p) => [...p, { step: "错误", status: "failed", detail: (err as Error).message }]);
        const msg = (err as Error).message;
        setNotice(msg);
        setMessages((p) => [...p, { role: "system", content: msg }]);
      }
    },
    [prevIds, recentConv],
  );

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
    setMessages((p) => [...p, { role: "user", content: t }]);
    setInputText("");
    void resolveTrack(t);
  };

  const handleNext = useCallback(() => {
    if (!track || !lastSubmitted) return;
    saveFeedbackRecord({ track, feedback: "skipped", originalText: lastSubmitted });
    setMessages((p) => [
      ...p,
      { role: "user", content: "这首不太对，换一首吧。" },
      { role: "agent", content: "好的，我换个方向为你找。" },
    ]);
    void resolveTrack(lastSubmitted, [track.id]);
  }, [lastSubmitted, resolveTrack, track]);

  const handlePlay = useCallback(() => setStatus("playing"), []);
  const handlePause = useCallback(() => setStatus("paused"), []);
  const handlePlayerError = useCallback(() => {
    setStatus("error"); setNotice("播放出错了。");
    if (track && lastSubmitted) setTimeout(handleNext, 500);
  }, [handleNext, lastSubmitted, track]);

  const canSubmit = useMemo(
    () => inputText.trim().length > 0 && !["thinking", "searching"].includes(status),
    [inputText, status],
  );

  // ── Render ────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen overflow-hidden rounded-none border border-border/40 bg-surface/45 shadow-lg backdrop-blur-xl">
      {/* ===== LEFT: Agent Identity + Input ===== */}
      <div className="flex w-[24%] min-w-[260px] shrink-0 flex-col border-r border-border/40 bg-surface-muted/40">
        {/* Top: Orb + Branding + QQ Login */}
        <div className="shrink-0 space-y-3 px-4 pt-5 pb-3">
          <div className="flex flex-col items-center gap-3">
            <AgentOrb status={status} />
            <div className="text-center">
              <h1 className="text-sm font-semibold tracking-tight text-foreground">
                MoodPlayer
              </h1>
              <p className="text-[10px] text-muted/60">用音乐理解每一种情绪</p>
            </div>
          </div>

          {/* QQ Login */}
          <button
            type="button"
            onClick={handleQQLogin}
            disabled={qqLoggingIn}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[10px] font-medium transition-colors",
              qqLoggedIn
                ? "bg-success/10 text-success"
                : qqLoggingIn
                  ? "bg-rose-surface/50 text-rose/50"
                  : "bg-surface/60 text-muted/50 hover:text-rose/60 hover:bg-rose-surface/40",
            )}
          >
            {qqLoggingIn ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose/20 border-t-rose" />
            ) : qqLoggedIn ? (
              <CheckCircle2 size={12} />
            ) : (
              <LogIn size={12} />
            )}
            {qqLoggingIn ? "登录中" : qqLoggedIn ? "QQ 已登录" : "登录 QQ 音乐"}
          </button>

          {qqLoggedIn && (
            <button
              type="button"
              onClick={handleQQLogout}
              className="flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[10px] font-medium bg-surface/60 text-muted/55 transition-colors hover:bg-rose-surface/35 hover:text-rose/70"
            >
              <LogOut size={12} />
              退出 QQ 登录
            </button>
          )}

          <StatusIndicator status={status} />
        </div>

      </div>

      {/* ===== CENTER: Player (hero) ===== */}
      <div className="flex w-[38%] min-w-[340px] shrink-0 flex-col items-center justify-start border-r border-border/40 px-6 pt-10">
        <AnimatePresence mode="wait">
          {track ? (
            <motion.div
              key="player"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full"
            >
              <PlayerCard
                track={track}
                status={status}
                onPlay={handlePlay}
                onPause={handlePause}
                onError={handlePlayerError}
                onNext={handleNext}
                onProgress={(current, duration) => {
                  setPlaybackTime(current);
                  setPlaybackDuration(duration);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-light/20 via-rose-surface to-surface shadow-inner">
                <Music size={36} className="text-rose/20" strokeWidth={1} />
              </div>
              <p className="mt-4 text-sm text-muted/50">
                告诉我你的感受
                <br />
                音乐将在这里播放
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 w-full max-w-[360px] rounded-3xl border border-white/60 bg-white/55 p-4 shadow-md backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground/70">
            <AudioLines size={14} className="text-rose/70" /> 当前歌词
          </div>
          <div className="max-h-[240px] overflow-y-auto pr-1 text-sm leading-7">
            {lyricLines.length > 0 ? (
              <div className="space-y-1">
                {lyricLines.map((line, idx) => (
                  <motion.p
                    key={`${line}-${idx}`}
                    initial={{ opacity: 0.4, y: 3 }}
                    animate={{ opacity: idx === activeLyricIndex ? 1 : 0.45, y: idx === activeLyricIndex ? 0 : 1, scale: idx === activeLyricIndex ? 1.02 : 1 }}
                    transition={{ duration: 0.35 }}
                    className={cn("rounded-lg px-2 py-0.5", idx === activeLyricIndex ? "bg-rose-surface text-foreground" : "text-muted/75")}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>

            ) : (
              <p className="text-muted/60">这首歌暂时没有可用歌词，先让旋律陪你一会儿。</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== RIGHT: Chat Flow ===== */}
      <div className="flex w-[42%] shrink-0 flex-col bg-surface/30">
        {/* Chat header */}
        <div className="shrink-0 flex items-center gap-2 border-b border-border/30 px-5 py-2.5">
          <span className="text-xs font-medium text-foreground/60">对话</span>
          {qqLoggedIn && (
            <span className="rounded-full bg-success/8 px-2 py-0.5 text-[10px] text-success/70">QQ 曲库</span>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <motion.div
                key={`${msg.role}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "rounded-br-md border border-rose/20 bg-gradient-to-br from-rose to-rose-dark text-white"
                      : msg.role === "system"
                        ? "bg-amber-50/80 text-amber-800/80 text-xs"
                        : "rounded-bl-md border border-white/60 bg-white/70 text-foreground/80 backdrop-blur-sm",
                  )}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            <ExplanationStream
              segments={explanationSegments}
              active={status === "playing" || status === "paused"}
            />

            {process.env.NODE_ENV === "development" && toolTrace.length > 0 && (
              <div className="space-y-1">
                {toolTrace.map((t, idx) => (
                  <div key={`${t.step}-${idx}`} className="rounded-xl bg-surface/60 px-3 py-2 text-xs text-foreground/70">
                    <span className="mr-1">{t.status === "running" ? "⏳" : t.status === "success" ? "✅" : "⚠️"}</span>
                    <span className="font-medium">{t.step}:</span> {t.detail}
                  </div>
                ))}
              </div>
            )}

            {notice && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl bg-surface/60 px-4 py-2 text-center text-xs text-muted/70"
              >
                {notice}
              </motion.div>
            )}

            {/* Typing indicator */}
            {(status === "thinking" || status === "searching") && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-surface/70 px-4 py-3 shadow-xs">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose/40 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose/40 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose/40 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat input at bottom */}
        <div className="shrink-0 border-t border-border/30 px-4 py-3">
          <form
            onSubmit={(e) => { e.preventDefault(); if (canSubmit) handleSubmit(); }}
            className="relative"
          >
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="说说你现在的感受，或者跟我聊聊天..."
              rows={2}
              className="w-full resize-none rounded-2xl border border-border/50 bg-surface/70 px-4 py-2.5 pr-20 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted/35 transition-colors focus:border-rose/20 focus:bg-surface"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSubmit) handleSubmit();
                }
              }}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
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
              >
                {status === "thinking" || status === "searching" ? "..." : "发送"}
              </Button>
            </div>
          </form>

          {speech.interimText && speech.isListening && (
            <div className="mt-2 rounded-xl bg-rose-surface/30 px-3 py-1 text-xs italic text-muted/60">
              {speech.interimText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
