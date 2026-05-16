import { fallbackParseMood } from "@/lib/ai/fallbackMood";
import { callDeepSeekJson, callDeepSeekWithTools } from "@/lib/ai/deepseek";
import { agentSystemPrompt } from "@/lib/ai/promptTemplates";
import {
  buildChatPrompt,
  buildFallbackExplanation,
  buildMoodPrompt,
  buildSelectionPrompt,
} from "@/lib/ai/buildPrompts";
import { musicAgentTools } from "@/lib/ai/tools";
import { moodProfileSchema, selectedTracksSchema } from "@/lib/ai/schemas";
import { rankTracks } from "@/lib/music/normalize";
import { searchQQMusicTracks } from "@/lib/music/qqmusic";
import type {
  AgentResolveRequest,
  AgentResolveResponse,
  AgentToolTrace,
  MoodProfile,
  TrackRecommendation,
} from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

type TraceEmitter = (trace: AgentToolTrace) => void;
type SearchLanguage = NonNullable<MoodProfile["searchLanguage"]>;
const SEARCH_LANGUAGES: readonly SearchLanguage[] = ["zh-CN", "en", "ja", "ko", "yue", "any"];

function createTraceRecorder(emitTrace?: TraceEmitter) {
  const toolTrace: AgentToolTrace[] = [];

  const addTrace = (trace: AgentToolTrace) => {
    toolTrace.push(trace);
    emitTrace?.(trace);
  };

  return { toolTrace, addTrace };
}

async function chatReply(
  userText: string,
  recentConversation: Array<{ role: "user" | "agent"; content: string }>,
  apiKey?: string,
) {
  try {
    const result = await callDeepSeekJson<{ reply: string }>([
      { role: "system", content: agentSystemPrompt },
      {
        role: "user",
        content: buildChatPrompt(userText, recentConversation),
      },
    ], apiKey);
    return result.reply;
  } catch {
    return "我在听。告诉我你现在的感受，或者想听什么样的歌？";
  }
}

async function analyzeWithTools(
  text: string,
  diagnostics: string[],
  addTrace: TraceEmitter,
  apiKey?: string,
) {
  addTrace({ step: "情绪分析", status: "running", detail: "正在理解你的情绪和音乐需求…" });
  const result = await callDeepSeekWithTools({
    messages: [
      { role: "system", content: agentSystemPrompt },
      {
        role: "user",
        content: `用户说："${text}"。如果用户想要音乐，请调用 analyze_and_search 工具。`,
      },
    ],
    tools: musicAgentTools,
    toolChoice: "auto",
    apiKey,
  });

  const toolCall = result.toolCalls.find((tc) => tc.name === "analyze_and_search");
  if (!toolCall) {
    addTrace({ step: "情绪分析", status: "failed", detail: "模型判断这不是一次点歌请求。" });
    return null;
  }

  addTrace({ step: "情绪分析", status: "success", detail: "已生成搜索策略。" });

  const args = toolCall.arguments as {
    moodAnalysis: Record<string, unknown>;
    searchStrategy: Record<string, unknown>;
    userSummary: string;
  };

  const searchLanguage = String(args.searchStrategy.language || "zh-CN");
  const moodProfile: MoodProfile = {
    scene: String(args.moodAnalysis.scene || "daily"),
    mood: Array.isArray(args.moodAnalysis.mood)
      ? args.moodAnalysis.mood.map(String)
      : ["neutral"],
    energy: (["low", "medium", "high"].includes(String(args.moodAnalysis.energy))
      ? String(args.moodAnalysis.energy)
      : "medium") as MoodProfile["energy"],
    valence: (["sad", "warm", "neutral", "happy"].includes(String(args.moodAnalysis.valence))
      ? String(args.moodAnalysis.valence)
      : "warm") as MoodProfile["valence"],
    avoid: Array.isArray(args.moodAnalysis.avoid)
      ? args.moodAnalysis.avoid.map(String)
      : [],
    keywords: Array.isArray(args.searchStrategy.keywords)
      ? args.searchStrategy.keywords.map(String)
      : [],
    searchGenre: String(args.searchStrategy.genre || ""),
    searchQuery: String(args.searchStrategy.query || args.searchStrategy.searchQuery || ""),
    searchLanguage: SEARCH_LANGUAGES.includes(searchLanguage as SearchLanguage)
      ? searchLanguage as SearchLanguage
      : "any",
    bpmHint: args.searchStrategy.bpmHint ? String(args.searchStrategy.bpmHint) : undefined,
    summary: String(args.userSummary || ""),
  };

  const parsed = moodProfileSchema.safeParse(moodProfile);
  if (!parsed.success) {
    diagnostics.push(`Tool call validation: ${parsed.error.message}`);
    addTrace({ step: "情绪分析", status: "failed", detail: "工具返回结构校验失败。" });
    return null;
  }

  return parsed.data;
}

async function parseMoodFallback(
  text: string,
  body: AgentResolveRequest,
  diagnostics: string[],
  addTrace: TraceEmitter,
) {
  addTrace({ step: "情绪分析", status: "running", detail: "正在使用 JSON 解析兜底方案…" });
  try {
    const result = await callDeepSeekJson<unknown>([
      { role: "system", content: agentSystemPrompt },
      { role: "user", content: buildMoodPrompt(text, body.userMusicProfile) },
    ], body.deepseekApiKey);
    const moodProfile = moodProfileSchema.parse(result);
    addTrace({ step: "情绪分析", status: "success", detail: "已完成情绪解析。" });
    return moodProfile;
  } catch (fallbackError) {
    diagnostics.push(`JSON fallback: ${(fallbackError as Error).message}`);
    addTrace({ step: "情绪分析", status: "failed", detail: "JSON 解析失败，使用本地规则兜底。" });
    return fallbackParseMood(text);
  }
}

async function searchCandidates(
  moodProfile: MoodProfile,
  body: AgentResolveRequest,
  diagnostics: string[],
  addTrace: TraceEmitter,
) {
  const genre = moodProfile.searchGenre || "";
  const cleanKeywords = moodProfile.keywords.slice(0, 3);
  const searchProfile = {
    ...moodProfile,
    keywords: [...cleanKeywords, genre].filter(Boolean).slice(0, 4),
  };
  const searches: Array<{
    label: string;
    run: () => Promise<PlayableTrack[]>;
  }> = [
    { label: "QQ 音乐", run: () => searchQQMusicTracks(searchProfile, 15) },
  ];
  const candidates: PlayableTrack[] = [];

  for (const source of searches) {
    addTrace({ step: "曲库检索", status: "running", detail: `正在从 ${source.label} 检索候选歌曲…` });
    try {
      const sourceCandidates = await source.run();
      candidates.push(...sourceCandidates);
      addTrace({
        step: "曲库检索",
        status: sourceCandidates.length ? "success" : "failed",
        detail: `${source.label} 候选数量：${sourceCandidates.length}`,
      });
    } catch (err) {
      diagnostics.push(`${source.label}: ${err instanceof Error ? err.message : String(err)}`);
      addTrace({ step: "曲库检索", status: "failed", detail: `${source.label} 暂时没有返回可用候选。` });
    }
  }
  return candidates;
}

async function selectTracks(input: {
  userText: string;
  moodProfile: MoodProfile;
  candidates: ReturnType<typeof rankTracks>;
  body: AgentResolveRequest;
  diagnostics: string[];
  addTrace: TraceEmitter;
}) {
  input.addTrace({ step: "选歌", status: "running", detail: "正在结合情绪、候选歌曲和用户画像挑选最终歌曲…" });

  try {
    const result = await callDeepSeekJson<unknown>([
      { role: "system", content: agentSystemPrompt },
      {
        role: "user",
        content: buildSelectionPrompt({
          userText: input.userText,
          moodProfile: input.moodProfile,
          candidates: input.candidates,
          userMusicProfile: input.body.userMusicProfile,
        }),
      },
    ], input.body.deepseekApiKey);

    const selection = selectedTracksSchema.parse(result);
    const tracksById = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
    const usedIds = new Set<string>();
    const recommendations: TrackRecommendation[] = selection.recommendations.flatMap((item) => {
      const track = tracksById.get(item.selectedTrackId);
      if (!track || usedIds.has(track.id)) return [];
      usedIds.add(track.id);
      return [{
        track,
        reason: item.reason,
        explanationSegments: item.explanationSegments,
      }];
    });

    if (recommendations.length === 0) {
      throw new Error("LLM selection did not match any candidate track.");
    }

    input.addTrace({ step: "选歌", status: "success", detail: `已缓存 ${recommendations.length} 首候选：${recommendations[0].track.title}` });

    return recommendations;
  } catch (error) {
    input.diagnostics.push(`LLM selection failed: ${(error as Error).message}`);
    input.addTrace({ step: "选歌", status: "failed", detail: "模型选歌失败，使用 QQ 候选排序前五首。" });

    return input.candidates.slice(0, 5).map((track) => ({
      track,
      explanationSegments: buildFallbackExplanation({
        userText: input.userText,
        moodProfile: input.moodProfile,
        track,
      }),
    }));
  }
}

export async function resolveMusicAgent(
  body: AgentResolveRequest,
  emitTrace?: TraceEmitter,
): Promise<AgentResolveResponse> {
  const text = body.text?.trim();
  if (!text) throw new Error("请输入当前状态。");

  const diagnostics: string[] = [];
  const { toolTrace, addTrace } = createTraceRecorder(emitTrace);

  addTrace({
    step: "用户画像",
    status: "success",
    detail: body.userMusicProfile?.recentEvents.length
      ? "已读取用户画像 JSON 和历史反馈。"
      : "用户画像暂无稳定记录。",
  });

  let moodProfile: MoodProfile | null = null;

  try {
    moodProfile = await analyzeWithTools(text, diagnostics, addTrace, body.deepseekApiKey);
  } catch (error) {
    diagnostics.push(`Tool calling failed: ${(error as Error).message}`);
  }

  if (!moodProfile) {
    const hasExplicitMusicIntent = /歌|音乐|放一首|听|换一首|推荐|播放|曲/i.test(text);
    if (!hasExplicitMusicIntent) {
      addTrace({ step: "聊天回复", status: "running", detail: "正在生成自然回复。" });
      const reply = await chatReply(text, body.recentConversation || [], body.deepseekApiKey);
      addTrace({ step: "聊天回复", status: "success", detail: "已生成回复。" });
      return {
        intent: "chat",
        chatReply: reply,
        sourceDiagnostics: diagnostics,
        toolTrace,
      };
    }

    moodProfile = await parseMoodFallback(text, body, diagnostics, addTrace);
  }

  const rawCandidates = await searchCandidates(moodProfile, body, diagnostics, addTrace);

  addTrace({ step: "排序", status: "running", detail: "正在结合用户画像和最近跳过记录排序候选歌曲。" });
  let candidates = rankTracks(
    rawCandidates,
    moodProfile,
    body.previousTrackIds,
    body.userMusicProfile,
    body.feedbackMemory,
  ).slice(0, 10);

  if (candidates.length === 0) {
    addTrace({ step: "排序", status: "failed", detail: "QQ 曲库暂时没有返回新的可播放候选。" });
    const error = new Error("QQ 曲库暂时没搜到新的合适歌曲，可以换个说法再试。");
    error.name = "NoPlayableTrack";
    throw error;
  }

  addTrace({ step: "排序", status: "success", detail: `已筛出 ${candidates.length} 首候选。` });
  const recommendations = await selectTracks({
    userText: text,
    moodProfile,
    candidates,
    body,
    diagnostics,
    addTrace,
  });
  addTrace({ step: "歌词", status: "running", detail: "歌曲已返回，歌词将异步加载。" });
  const firstRecommendation = recommendations[0];

  return {
    intent: "music",
    moodProfile,
    track: firstRecommendation.track,
    explanationSegments: firstRecommendation.explanationSegments,
    recommendations,
    sourceDiagnostics: diagnostics,
    toolTrace,
  };
}
