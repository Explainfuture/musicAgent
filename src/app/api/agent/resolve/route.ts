import { NextResponse } from "next/server";
import { fallbackParseMood } from "@/lib/ai/fallbackMood";
import { callDeepSeekJson, callDeepSeekWithTools } from "@/lib/ai/deepseek";
import {
  agentSystemPrompt,
  buildChatPrompt,
  buildFallbackExplanation,
  buildIntentPrompt,
  buildMoodPrompt,
  buildSelectionPrompt,
  musicAgentTools,
} from "@/lib/ai/prompts";
import { moodProfileSchema, selectedTrackSchema } from "@/lib/ai/schemas";
import { rankTracks } from "@/lib/music/normalize";
import { searchQQMusicTracks } from "@/lib/music/qqmusic";
import { fallbackTracks } from "@/lib/music/fallbackTracks";
import type {
  AgentResolveRequest,
  AgentResolveResponse,
  AgentToolTrace,
  MoodProfile,
} from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

// ── Intent classification ─────────────────────────────

async function classifyIntent(
  text: string,
  hasTrack: boolean,
): Promise<"music" | "chat"> {
  try {
    const result = await callDeepSeekJson<{ intent: "music" | "chat" }>([
      { role: "system", content: agentSystemPrompt },
      { role: "user", content: buildIntentPrompt(text, hasTrack) },
    ]);
    return result.intent === "chat" ? "chat" : "music";
  } catch {
    // Default to music if classification fails
    const chatPatterns = /^(谢谢|你好|嗨|哈喽|hello|hi|你是谁|你能|你会|可以|总结|介绍|帮我看|什么是)/i;
    return chatPatterns.test(text.trim()) ? "chat" : "music";
  }
}

// ── Chat response ─────────────────────────────────────

async function chatReply(
  userText: string,
  recentConversation: Array<{ role: "user" | "agent"; content: string }>,
): Promise<string> {
  try {
    const result = await callDeepSeekJson<{ reply: string }>([
      { role: "system", content: agentSystemPrompt },
      {
        role: "user",
        content: buildChatPrompt(userText, recentConversation),
      },
    ]);
    return result.reply;
  } catch {
    return "我在听。告诉我你现在的感受，或者想听什么样的歌？";
  }
}

// ── Search candidates ─────────────────────────────────

async function searchCandidates(moodProfile: MoodProfile, diagnostics: string[]) {
  const genre = moodProfile.searchGenre || "";
  const cleanKeywords = moodProfile.keywords.slice(0, 3);
  const searchProfile = {
    ...moodProfile,
    keywords: [...cleanKeywords, genre].filter(Boolean).slice(0, 4),
  };

  try {
    return await searchQQMusicTracks(searchProfile);
  } catch (err) {
    diagnostics.push(
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

// ── Select final track ────────────────────────────────

async function selectTrack(input: {
  userText: string;
  moodProfile: MoodProfile;
  candidates: PlayableTrack[];
  diagnostics: string[];
}) {
  try {
    const result = await callDeepSeekJson<unknown>([
      { role: "system", content: agentSystemPrompt },
      {
        role: "user",
        content: buildSelectionPrompt({
          userText: input.userText,
          moodProfile: input.moodProfile,
          candidates: input.candidates,
        }),
      },
    ]);
    const selection = selectedTrackSchema.parse(result);
    const selectedTrack =
      input.candidates.find((track) => track.id === selection.selectedTrackId) ||
      input.candidates[0];

    return {
      track: selectedTrack,
      explanationSegments: selection.explanationSegments,
    };
  } catch (error) {
    input.diagnostics.push(
      `DeepSeek selection fallback: ${(error as Error).message}`,
    );
    const track = input.candidates[0];

    return {
      track,
      explanationSegments: buildFallbackExplanation({
        userText: input.userText,
        moodProfile: input.moodProfile,
        track,
      }),
    };
  }
}

// ── Tool calling flow ─────────────────────────────────

async function analyzeWithTools(text: string, diagnostics: string[], toolTrace: AgentToolTrace[]) {
  toolTrace.push({ step: "思考", status: "running", detail: "正在分析情绪并决定要调用的工具..." });
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
  });

  const toolCall = result.toolCalls.find((tc) => tc.name === "analyze_and_search");
  if (toolCall) {
    toolTrace.push({ step: "工具调用", status: "success", detail: `已调用 ${toolCall.name}` });
  }

  if (!toolCall) {
    // LLM chose not to call the tool — this might be a chat
    toolTrace.push({ step: "工具调用", status: "failed", detail: "模型未调用 analyze_and_search，进入后备流程。" });
    return null;
  }

  const args = toolCall.arguments as {
    moodAnalysis: Record<string, unknown>;
    searchStrategy: Record<string, unknown>;
    userSummary: string;
  };

  const moodProfile: MoodProfile = {
    scene: String(args.moodAnalysis.scene || "daily"),
    mood: Array.isArray(args.moodAnalysis.mood)
      ? args.moodAnalysis.mood.map(String)
      : ["neutral"],
    energy: (["low", "medium", "high"].includes(String(args.moodAnalysis.energy))
      ? String(args.moodAnalysis.energy)
      : "medium") as MoodProfile["energy"],
    valence: (["sad", "warm", "neutral", "happy"].includes(
      String(args.moodAnalysis.valence),
    )
      ? String(args.moodAnalysis.valence)
      : "warm") as MoodProfile["valence"],
    avoid: Array.isArray(args.moodAnalysis.avoid)
      ? args.moodAnalysis.avoid.map(String)
      : [],
    keywords: Array.isArray(args.searchStrategy.keywords)
      ? args.searchStrategy.keywords.map(String)
      : [],
    searchGenre: String(args.searchStrategy.genre || ""),
    searchLanguage: "zh-CN",
    summary: String(args.userSummary || ""),
  };

  const parsed = moodProfileSchema.safeParse(moodProfile);
  toolTrace.push({ step: "工具结果", status: parsed.success ? "success" : "failed", detail: parsed.success ? `情绪：${moodProfile.mood.join("/")}，能量：${moodProfile.energy}` : "工具返回结构校验失败" });
  if (!parsed.success) {
    diagnostics.push(`Tool call validation: ${parsed.error.message}`);
    return null;
  }

  return parsed.data;
}

// ── Main API handler ──────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentResolveRequest;
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "请输入当前状态。" }, { status: 400 });
    }

    const hasTrack = Boolean(body.previousTrackIds?.length);
    const diagnostics: string[] = [];
    const toolTrace: AgentToolTrace[] = [];

    // Step 1: Classify intent — chat or music?
    const intent = await classifyIntent(text, hasTrack);
    diagnostics.push(`Intent: ${intent}`);

    // Chat path — respond conversationally, no music search
    if (intent === "chat") {
      const reply = await chatReply(text, body.recentConversation || []);
      return NextResponse.json({
        intent: "chat" as const,
        chatReply: reply,
        sourceDiagnostics: diagnostics,
      toolTrace,
      });
    }

    // Music path — full flow
    // Step 2: Analyze mood with tools
    let moodProfile: MoodProfile;

    try {
      const toolResult = await analyzeWithTools(text, diagnostics, toolTrace);
      if (toolResult) {
        moodProfile = toolResult;
      } else {
        throw new Error("Tool calling returned no result.");
      }
    } catch (error) {
      diagnostics.push(
        `Tool calling failed: ${(error as Error).message}. Falling back.`,
      );
      toolTrace.push({ step: "回退", status: "running", detail: "工具调用失败，切换到 JSON 解析方案。" });
      try {
        const result = await callDeepSeekJson<unknown>([
          { role: "system", content: agentSystemPrompt },
          { role: "user", content: buildMoodPrompt(text) },
        ]);
        moodProfile = moodProfileSchema.parse(result);
        toolTrace.push({ step: "回退结果", status: "success", detail: "JSON 解析成功。" });
      } catch (fallbackError) {
        diagnostics.push(`JSON fallback: ${(fallbackError as Error).message}`);
        moodProfile = fallbackParseMood(text);
        toolTrace.push({ step: "回退结果", status: "failed", detail: "JSON 解析失败，使用规则兜底。" });
      }
    }

    // Step 3: Search QQ Music
    toolTrace.push({ step: "检索", status: "running", detail: "正在请求 QQ 音乐候选歌曲..." });
    const rawCandidates = await searchCandidates(moodProfile, diagnostics);
    toolTrace.push({ step: "检索结果", status: rawCandidates.length > 0 ? "success" : "failed", detail: `候选数量：${rawCandidates.length}` });

    // Step 4: Rank
    let candidates = rankTracks(
      rawCandidates,
      moodProfile,
      body.previousTrackIds,
    ).slice(0, 10);

    if (candidates.length === 0 && body.previousTrackIds?.length) {
      candidates = rankTracks(rawCandidates, moodProfile, []).slice(0, 10);
    }

    // Note: QQ Music tracks don't have audioUrl yet.
    // The Electron renderer fetches play URLs via IPC (Chromium net.fetch),
    // which bypasses QQ Music's API signing requirement.

    if (candidates.length === 0) {

      toolTrace.push({ step: "兜底", status: "running", detail: "QQ 音乐暂无可用结果，切换到内置可播曲库。" });
      candidates = rankTracks(fallbackTracks, moodProfile, body.previousTrackIds).slice(0, 10);
      if (candidates.length === 0) {
        candidates = fallbackTracks.slice(0, 3);
      }
      toolTrace.push({ step: "兜底结果", status: "success", detail: `fallback 候选数量：${candidates.length}` });

    }

    // Step 6: AI selects
    toolTrace.push({ step: "选歌", status: "running", detail: "正在结合语义和候选集挑选最终歌曲..." });
    const selection = await selectTrack({
      userText: text,
      moodProfile,
      candidates,
      diagnostics,
    });

    toolTrace.push({ step: "选歌结果", status: "success", detail: `已选择：${selection.track.title}` });

    return NextResponse.json({
      intent: "music" as const,
      moodProfile,
      track: selection.track,
      explanationSegments: selection.explanationSegments,
      sourceDiagnostics: diagnostics,
      toolTrace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Agent 暂时没接住。" },
      { status: 500 },
    );
  }
}
