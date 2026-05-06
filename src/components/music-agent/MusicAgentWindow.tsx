"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
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

const statusText: Record<AgentStatus, string> = {
  idle: "idle · 输入你的状态，我会直接放一首",
  listening: "listening · 我在听",
  transcribing: "transcribing · 正在整理语音",
  thinking: "thinking · 理解情绪和约束",
  searching: "searching · 搜索可播放音频源",
  playing: "playing · 已开始播放",
  paused: "paused · 已暂停",
  error: "error · 播放链路需要重试",
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
      content:
        "我是 MoodPlayer Terminal。像和 ChatGPT 聊天一样告诉我你现在的状态，我只选一首并直接播放。",
    },
  ]);

  const track = response?.track ?? null;
  const explanationSegments = response?.explanationSegments ?? [];

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
          }),
        });

        if (!apiResponse.ok) {
          const errorBody = (await apiResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(errorBody?.error || "Agent 暂时没有找到合适的歌。");
        }

        const nextResponse = (await apiResponse.json()) as AgentResolveResponse;
        setResponse(nextResponse);
        setPreviousTrackIds((ids) =>
          Array.from(new Set([...ids, nextResponse.track.id])),
        );
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            role: "agent",
            content: `我选了 ${nextResponse.track.title}${
              nextResponse.track.artist ? ` - ${nextResponse.track.artist}` : ""
            }。不用再挑，先听这一首。`,
          },
        ]);
        setStatus("playing");
      } catch (error) {
        setStatus("error");
        const message = (error as Error).message || "这首没播起来，我换一首。";
        setNotice(message);
        setMessages((currentMessages) => [
          ...currentMessages,
          { role: "system", content: message },
        ]);
      }
    },
    [previousTrackIds],
  );

  const speech = useSpeechRecognition({
    onFinalText: (text) => {
      setInputText(text);
      setStatus("transcribing");
    },
    onUnsupported: () => setNotice("这个浏览器不支持语音识别，可以用文字输入。"),
    onError: (message) => {
      setStatus("error");
      setNotice(message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedText = inputText.trim();
    if (!submittedText) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", content: submittedText },
    ]);
    void resolveTrack(submittedText);
  };

  const handleNext = useCallback(() => {
    if (!track || !lastSubmittedText) return;

    saveFeedbackRecord({
      track,
      feedback: "skipped",
      originalText: lastSubmittedText,
    });
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", content: "这首不对味，换一首。" },
      { role: "agent", content: "收到，我换一个方向，不再让你选。" },
    ]);
    void resolveTrack(lastSubmittedText, [track.id]);
  }, [lastSubmittedText, resolveTrack, track]);

  const handleFeedback = (feedback: FeedbackType) => {
    if (!track || !lastSubmittedText) return;

    saveFeedbackRecord({
      track,
      feedback,
      originalText: lastSubmittedText,
    });
    const feedbackMessage =
      feedback === "good_fit"
        ? "记住了，这个方向是对味的。"
        : "记住了，下次我会避开这个方向。";
    setNotice(feedbackMessage);
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "system", content: feedbackMessage },
    ]);
  };

  const handlePlay = useCallback(() => setStatus("playing"), []);
  const handlePause = useCallback(() => setStatus("paused"), []);

  const handlePlayerError = useCallback(() => {
    setStatus("error");
    setNotice("这首没播起来，我换一首。");
    if (track && lastSubmittedText) {
      window.setTimeout(handleNext, 500);
    }
  }, [handleNext, lastSubmittedText, track]);

  const canSubmit = useMemo(
    () => inputText.trim().length > 0 && !["thinking", "searching"].includes(status),
    [inputText, status],
  );

  return (
    <section className="w-full max-w-[440px] rounded-2xl border border-emerald-400/20 bg-[#0d1117]/95 p-4 font-mono text-emerald-50 shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
      <AgentOrb status={status} />

      <div className="mt-2 rounded-xl border border-emerald-400/20 bg-black/30 px-3 py-2">
        <p className="text-xs text-emerald-300">$ music-agent status --live</p>
        <p className="mt-1 text-sm text-emerald-50">{statusText[status]}</p>
        {notice ? <p className="mt-1 text-xs text-amber-300">{notice}</p> : null}
      </div>

      <div className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "text-right text-sky-200"
                : message.role === "system"
                  ? "text-amber-300"
                  : "text-emerald-200"
            }
          >
            <span className="text-[11px] opacity-60">
              {message.role === "user" ? "you" : message.role}
            </span>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
              {message.content}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <textarea
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="> 我现在写代码有点累，但不想听太吵的。"
          className="min-h-20 w-full resize-none rounded-xl border border-emerald-400/20 bg-black/50 px-3 py-3 text-sm leading-6 text-emerald-50 outline-none transition placeholder:text-emerald-700 focus:border-emerald-300"
        />
        {speech.interimText && speech.isListening ? (
          <div className="rounded-xl bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
            {speech.interimText}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <MicButton
            isListening={speech.isListening}
            isSupported={speech.isSupported}
            onStart={() => {
              setStatus("listening");
              speech.start();
            }}
            onStop={speech.stop}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-emerald-700"
          >
            {status === "thinking" || status === "searching" ? "正在找歌" : "开始播放"}
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-3">
        <PlayerCard
          track={track}
          status={status}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handlePlayerError}
          onNext={handleNext}
        />

        <ExplanationStream
          segments={explanationSegments}
          active={status === "playing" || status === "paused"}
        />

        <FeedbackBar disabled={!track} onFeedback={handleFeedback} />
      </div>
    </section>
  );
}
