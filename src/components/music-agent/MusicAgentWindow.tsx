"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentOrb } from "./AgentOrb";
import { ExplanationStream } from "./ExplanationStream";
import { FeedbackBar } from "./FeedbackBar";
import { MicButton } from "./MicButton";
import { PlayerCard } from "./PlayerCard";
import { readFeedbackMemory, saveFeedbackRecord } from "@/lib/storage/feedbackMemory";
import { useSpeechRecognition } from "@/lib/speech/useSpeechRecognition";
import type {
  AgentResolveResponse,
  AgentStatus,
  FeedbackType,
} from "@/types/agent";

const statusConfig: Record<
  AgentStatus,
  { label: string; description: string }
> = {
  idle: { label: "等待中", description: "告诉我你此刻的感受" },
  listening: { label: "正在聆听", description: "我在用心听你说" },
  transcribing: { label: "整理语音", description: "正在理解你的话语" },
  thinking: { label: "感受情绪", description: "在体会你的心情" },
  searching: { label: "寻找音乐", description: "为你挑选最合适的一首" },
  playing: { label: "正在播放", description: "希望这首歌能陪伴你" },
  paused: { label: "已暂停", description: "随时可以继续" },
  error: { label: "出了点问题", description: "让我重新为你找一首" },
};

type ChatMessage = {
  role: "user" | "agent" | "system";
  content: string;
};

export function MusicAgentWindow() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [inputText, setInputText] = useState("");
  const [lastSubmittedText, setLastSubmittedText] = useState("");
  const [response, setResponse] = useState<AgentResolveResponse | null>(null);
  const [previousTrackIds, setPreviousTrackIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      content: "嗨，我是你的音乐伙伴。告诉我你现在的感受，我会为你挑一首最适合此刻的歌。",
    },
  ]);

  // QQ Music auth
  const [qqLoggedIn, setQqLoggedIn] = useState(false);
  const [qqLoggingIn, setQqLoggingIn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const track = response?.track ?? null;
  const explanationSegments = response?.explanationSegments ?? [];

  useEffect(() => {
    if (window.musicAgentShell?.isElectron) {
      window.musicAgentShell.getQQMusicCookieStatus().then((s) => setQqLoggedIn(s.loggedIn));
    }
  }, []);

  const handleQQMusicLogin = async () => {
    if (!window.musicAgentShell?.isElectron) {
      setNotice("QQ 音乐登录需要在 Electron 客户端中进行。");
      return;
    }
    setQqLoggingIn(true);
    try {
      const result = await window.musicAgentShell.loginQQMusic();
      if (result.success) {
        setQqLoggedIn(true);
        setNotice("QQ 音乐登录成功！");
      } else {
        setNotice("登录已取消或超时。");
      }
    } catch {
      setNotice("登录失败，请重试。");
    } finally {
      setQqLoggingIn(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, explanationSegments]);

  // Build recent conversation for context
  const recentConversation = useMemo(
    () =>
      messages.slice(-8).map((m) => ({
        role: m.role === "user" ? "user" : "agent",
        content: m.content,
      })),
    [messages],
  );

  const resolveTrack = useCallback(
    async (text: string, extraPreviousTrackIds: string[] = []) => {
      const trimmedText = text.trim();
      if (!trimmedText) return;

      setNotice("");
      setStatus("thinking");
      setLastSubmittedText(trimmedText);

      const allPreviousTrackIds = Array.from(
        new Set([...previousTrackIds, ...extraPreviousTrackIds]),
      );

      try {
        setStatus("searching");
        const apiResponse = await fetch("/api/agent/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmedText,
            previousTrackIds: allPreviousTrackIds,
            feedbackMemory: readFeedbackMemory(),
            recentConversation: recentConversation as Array<{
              role: "user" | "agent";
              content: string;
            }>,
          }),
        });

        if (!apiResponse.ok) {
          const err = (await apiResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error || "暂时没有找到合适的歌，再试一次吧。");
        }

        const res = (await apiResponse.json()) as AgentResolveResponse;

        // Chat mode — LLM responded conversationally
        if (res.intent === "chat" && res.chatReply) {
          setMessages((prev) => [...prev, { role: "agent", content: res.chatReply! }]);
          setStatus("idle");
          return;
        }

        // Music mode
        if (res.track) {
          setResponse(res);
          setPreviousTrackIds((ids) => Array.from(new Set([...ids, res.track!.id])));
          setMessages((prev) => [
            ...prev,
            {
              role: "agent",
              content: `我为你选了《${res.track!.title}》${
                res.track!.artist ? ` — ${res.track!.artist}` : ""
              }，听听看。`,
            },
          ]);
          setStatus("playing");
        } else {
          throw new Error("Agent 没有返回歌曲。");
        }
      } catch (error) {
        setStatus("error");
        const message = (error as Error).message || "播放出错了，让我换一首。";
        setNotice(message);
        setMessages((prev) => [...prev, { role: "system", content: message }]);
      }
    },
    [previousTrackIds, recentConversation],
  );

  const speech = useSpeechRecognition({
    onFinalText: (text) => {
      setInputText(text);
      setStatus("transcribing");
      setTimeout(() => setStatus("idle"), 1500);
    },
    onUnsupported: () => setNotice("当前环境不支持语音识别，可以直接打字。"),
    onError: (message) => {
      setStatus("error");
      setNotice(message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedText = inputText.trim();
    if (!submittedText) return;

    setMessages((prev) => [...prev, { role: "user", content: submittedText }]);
    setInputText("");
    void resolveTrack(submittedText);
  };

  const handleNext = useCallback(() => {
    if (!track || !lastSubmittedText) return;
    saveFeedbackRecord({ track, feedback: "skipped", originalText: lastSubmittedText });
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "这首不太对，换一首吧。" },
      { role: "agent", content: "好的，我换个方向为你找。" },
    ]);
    void resolveTrack(lastSubmittedText, [track.id]);
  }, [lastSubmittedText, resolveTrack, track]);

  const handleFeedback = (feedback: FeedbackType) => {
    if (!track || !lastSubmittedText) return;
    saveFeedbackRecord({ track, feedback, originalText: lastSubmittedText });
    const msg =
      feedback === "good_fit" ? "收到，我会记住这个方向。" : "记住了，下次我会调整。";
    setNotice(msg);
    setMessages((prev) => [...prev, { role: "system", content: msg }]);
  };

  const handlePlay = useCallback(() => setStatus("playing"), []);
  const handlePause = useCallback(() => setStatus("paused"), []);

  const handlePlayerError = useCallback(() => {
    setStatus("error");
    setNotice("播放出错了，让我换一首。");
    if (track && lastSubmittedText) {
      window.setTimeout(handleNext, 500);
    }
  }, [handleNext, lastSubmittedText, track]);

  const canSubmit = useMemo(
    () => inputText.trim().length > 0 && !["thinking", "searching"].includes(status),
    [inputText, status],
  );

  const currentStatus = statusConfig[status];

  return (
    <section
      className="
        relative flex h-screen w-full max-w-[920px] overflow-y-auto
        rounded-[28px] border border-white/60
        bg-white/40 shadow-[0_24px_80px_rgba(180,110,130,0.18),0_0_0_1px_rgba(255,255,255,0.4)_inset]
        backdrop-blur-2xl
      "
    >
      {/* ===== Left: Music Player ===== */}
      <div className="flex w-[44%] shrink-0 flex-col overflow-y-auto border-r border-rose-pink/10 bg-white/25">
        {/* Header */}
        <header className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <AgentOrb status={status} />
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-plum">MoodPlayer Agent</h1>
              <p className="text-[10px] text-muted-plum/70">用音乐理解你的每一种情绪</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleQQMusicLogin}
            disabled={qqLoggingIn}
            className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
              qqLoggedIn
                ? "bg-green-100/60 text-green-700"
                : qqLoggingIn
                  ? "bg-rose-pink/10 text-rose-pink/50"
                  : "bg-white/60 text-muted-plum/60 hover:bg-rose-pink/8 hover:text-rose-pink/70"
            }`}
          >
            {qqLoggingIn ? "登录中..." : qqLoggedIn ? "QQ 已登录" : "登录 QQ 音乐"}
          </button>
        </header>

        {/* Status */}
        <div className="shrink-0 px-4 pb-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/50 px-3 py-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
                status === "playing" ? "bg-coral animate-status-pulse"
                  : status === "error" ? "bg-dusty-rose"
                  : status === "idle" || status === "paused" ? "bg-rose-pink/40"
                  : "bg-rose-pink animate-status-pulse"
              }`}
            />
            <span className="text-[11px] font-medium text-plum/80">{currentStatus.label}</span>
            <span className="text-[10px] text-muted-plum/60">· {currentStatus.description}</span>
          </div>
        </div>

        {/* Player */}
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          {track ? (
            <div className="w-full animate-fade-in-up">
              <PlayerCard
                track={track}
                status={status}
                onPlay={handlePlay}
                onPause={handlePause}
                onError={handlePlayerError}
                onNext={handleNext}
              />
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-3 h-20 w-20 rounded-[24px] bg-gradient-to-br from-rose-pink/12 via-peach/10 to-lavender-pink/10 shadow-inner" />
              <p className="text-[12px] leading-relaxed text-muted-plum/50">
                告诉我你的感受
                <br />
                我会把音乐放在这里
              </p>
            </div>
          )}
        </div>

        {/* Feedback */}
        <div className="shrink-0 px-4 pb-4 pt-1">
          <FeedbackBar disabled={!track} onFeedback={handleFeedback} />
        </div>
      </div>

      {/* ===== Right: Conversation ===== */}
      <aside className="flex w-[56%] shrink-0 flex-col bg-white/20">
        <div className="shrink-0 flex items-center gap-2 border-b border-rose-pink/8 px-4 py-2.5">
          <span className="text-[12px] font-medium text-plum/70">对话</span>
          <span className="text-[10px] text-muted-plum/45">— 你的音乐伙伴</span>
          {qqLoggedIn && (
            <span className="ml-auto rounded-full bg-green-100/50 px-2 py-0.5 text-[9px] text-green-600/70">
              QQ 曲库
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-2.5">
          <div className="space-y-2.5">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex animate-fade-in-up ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
                style={{ animationDelay: "0ms" }}
              >
                {message.role === "user" ? (
                  <div className="max-w-[78%] rounded-[16px] rounded-br-md bg-gradient-to-br from-rose-pink to-dusty-rose px-3 py-2 text-[12px] leading-relaxed text-white shadow-[0_3px_12px_rgba(200,120,145,0.18)]">
                    {message.content}
                  </div>
                ) : message.role === "system" ? (
                  <div className="max-w-[85%] rounded-[16px] bg-amber-50/60 px-3 py-2 text-center text-[11px] leading-relaxed text-amber-700/70">
                    {message.content}
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-[16px] rounded-bl-md bg-white/70 px-3 py-2 text-[12px] leading-relaxed text-plum shadow-[0_1px_8px_rgba(180,120,140,0.05)]">
                    {message.content}
                  </div>
                )}
              </div>
            ))}

            <ExplanationStream
              segments={explanationSegments}
              active={status === "playing" || status === "paused"}
            />

            {notice && (
              <div className="animate-fade-in-up rounded-xl bg-white/50 px-3 py-2 text-center text-[11px] text-muted-plum">
                {notice}
              </div>
            )}

            {/* Typing indicator */}
            {(status === "thinking" || status === "searching") && (
              <div className="flex justify-start">
                <div className="rounded-[16px] rounded-bl-md bg-white/70 px-4 py-2.5 shadow-[0_1px_8px_rgba(180,120,140,0.05)]">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-pink/50 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-pink/50 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-pink/50 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-rose-pink/8 px-4 py-2.5">
          <form onSubmit={handleSubmit} className="space-y-1.5">
            <div className="relative rounded-[16px] border border-rose-pink/12 bg-white/65 px-3 py-2 shadow-[0_2px_10px_rgba(200,140,160,0.03)] transition-all focus-within:border-rose-pink/25 focus-within:shadow-[0_2px_14px_rgba(200,140,160,0.06)]">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="说说你现在的感受..."
                rows={2}
                className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-plum outline-none placeholder:text-muted-plum/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSubmit) handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <MicButton
                  isListening={speech.isListening}
                  isSupported={speech.isSupported}
                  onStart={() => { setStatus("listening"); speech.start(); }}
                  onStop={speech.stop}
                />
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-full bg-gradient-to-r from-rose-pink to-dusty-rose px-4 py-1.5 text-[12px] font-semibold text-white shadow-[0_3px_12px_rgba(200,130,150,0.22)] transition-all hover:shadow-[0_5px_16px_rgba(200,130,150,0.32)] hover:brightness-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {status === "thinking" || status === "searching" ? "寻找中..." : "为我播放"}
                </button>
              </div>
            </div>

            {speech.interimText && speech.isListening && (
              <div className="rounded-xl bg-rose-pink/5 px-3 py-1 text-[11px] italic text-muted-plum animate-status-pulse">
                {speech.interimText}
              </div>
            )}

            {!track && (
              <div className="flex flex-wrap gap-1">
                {["有点累了", "需要治愈", "给我动力", "心情低落", "想要安静"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInputText(s)}
                    className="rounded-full border border-rose-pink/10 bg-white/45 px-2.5 py-1 text-[10px] text-muted-plum/80 transition-all hover:bg-rose-pink/8 hover:border-rose-pink/18"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </aside>

      <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-rose-pink/4 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-44 w-44 rounded-full bg-lavender-pink/8 blur-3xl" />
    </section>
  );
}
