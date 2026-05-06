import { NextResponse } from "next/server";
import { fallbackParseMood } from "@/lib/ai/fallbackMood";
import { callDeepSeekJson } from "@/lib/ai/deepseek";
import {
  agentSystemPrompt,
  buildFallbackExplanation,
  buildMoodPrompt,
  buildSelectionPrompt,
} from "@/lib/ai/prompts";
import { moodProfileSchema, selectedTrackSchema } from "@/lib/ai/schemas";
import { searchAudiusTracks } from "@/lib/music/audius";
import { searchJamendoTracks } from "@/lib/music/jamendo";
import { rankTracks } from "@/lib/music/normalize";
import type {
  AgentResolveRequest,
  AgentResolveResponse,
  MoodProfile,
} from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

async function parseMood(text: string, diagnostics: string[]): Promise<MoodProfile> {
  try {
    const result = await callDeepSeekJson<unknown>([
      { role: "system", content: agentSystemPrompt },
      { role: "user", content: buildMoodPrompt(text) },
    ]);

    return moodProfileSchema.parse(result);
  } catch (error) {
    diagnostics.push(`DeepSeek mood fallback: ${(error as Error).message}`);
    return fallbackParseMood(text);
  }
}

async function searchCandidates(moodProfile: MoodProfile, diagnostics: string[]) {
  const groups = await Promise.allSettled([
    searchJamendoTracks(moodProfile),
    searchAudiusTracks(moodProfile),
  ]);

  const candidates: PlayableTrack[] = [];

  for (const group of groups) {
    if (group.status === "fulfilled") {
      candidates.push(...group.value);
    } else {
      diagnostics.push(group.reason instanceof Error ? group.reason.message : String(group.reason));
    }
  }

  return candidates;
}

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
    input.diagnostics.push(`DeepSeek selection fallback: ${(error as Error).message}`);
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentResolveRequest;
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "请输入当前状态。" }, { status: 400 });
    }

    const diagnostics: string[] = [];
    const moodProfile = await parseMood(text, diagnostics);
    const candidates = rankTracks(
      await searchCandidates(moodProfile, diagnostics),
      moodProfile,
      body.previousTrackIds,
    ).slice(0, 10);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "暂时没有找到可播放的音乐。" },
        { status: 503 },
      );
    }

    const selection = await selectTrack({
      userText: text,
      moodProfile,
      candidates,
      diagnostics,
    });

    const response: AgentResolveResponse = {
      moodProfile,
      track: selection.track,
      explanationSegments: selection.explanationSegments,
      sourceDiagnostics: diagnostics,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Agent 暂时没接住，我再试一次。" },
      { status: 500 },
    );
  }
}
