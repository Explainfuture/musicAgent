import type { MoodProfile } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

export const agentSystemPrompt = `你是一个小窗式 Music Agent。你的任务不是生成歌单，而是根据用户当下的情绪、场景和限制，选择一首最适合立刻播放的音乐。

你必须遵守：
1. 默认只选择一首歌。
2. 不要把选择权还给用户，除非没有可播放资源。
3. 先理解用户的情绪状态、能量水平、场景和排除项。
4. 选择音乐时优先考虑“此刻适不适合”，而不是歌曲是否热门。
5. 推荐理由要具体说明节奏、能量、人声、氛围和用户状态之间的关系。
6. 不要使用夸张心理诊断，不要说你能治疗用户。
7. 如果用户说“不对味”，立刻换方向选择下一首。
8. 只返回严格 JSON，不要 Markdown，不要解释 JSON 以外的内容。`;

export function buildMoodPrompt(userText: string) {
  return `请把用户输入解析成结构化音乐需求。

用户输入：
${userText}

返回 JSON 结构：
{
  "scene": "coding | resting | night | commute | exercise | daily",
  "mood": ["tired", "slightly_down"],
  "energy": "low | medium | high",
  "valence": "sad | warm | neutral | happy",
  "avoid": ["too_loud", "too_sad"],
  "keywords": ["warm", "soft", "mellow"],
  "summary": "一句中文总结"
}`;
}

export function buildSelectionPrompt(input: {
  userText: string;
  moodProfile: MoodProfile;
  candidates: PlayableTrack[];
}) {
  return `请根据用户输入、结构化情绪和候选歌曲，只选择一首最适合现在播放的歌。

用户输入：
${input.userText}

情绪需求：
${JSON.stringify(input.moodProfile, null, 2)}

候选歌曲：
${JSON.stringify(input.candidates, null, 2)}

返回 JSON 结构：
{
  "selectedTrackId": "候选歌曲中的 id",
  "reason": "一句选择理由",
  "explanationSegments": [
    "第一段解释，像陪伴者一样自然",
    "第二段解释，说明节奏/能量/人声/氛围为什么贴合",
    "第三段解释，说明它如何帮用户从当前状态过渡"
  ]
}`;
}

export function buildFallbackExplanation(input: {
  userText: string;
  moodProfile: MoodProfile;
  track: PlayableTrack;
}) {
  const tags = input.track.tags?.slice(0, 3).join("、") || "温和、低打扰";

  return [
    `我先给你放这首，不让你再花力气挑。它的整体方向偏${tags}，更适合现在先稳住状态。`,
    `你刚才说的是“${input.userText}”，所以我避开了太吵或太压迫的声音，优先选一首能陪你缓一下的。`,
    `${input.track.title} 不一定是最热门的，但它现在更重要的是低干扰、能接住情绪。`,
  ];
}
