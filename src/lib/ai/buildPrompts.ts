import type { AgentMemoryContext, MoodProfile, UserMusicProfile, WeightedPreference } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

// ── Intent classification prompt ─────────────────────

export function buildIntentPrompt(userText: string, hasTrack: boolean) {
  return `判断用户意图。用户说："${userText}"${hasTrack ? "（当前正在播放一首歌）" : ""}

分类为以下之一：
- "music" — 用户明确或隐含想听音乐、推荐、播放、换歌，或对当前歌曲提出调整反馈
- "chat" — 用户只是在聊天、提问、问候、感谢、总结，或表达情绪但没有明显要歌

如果需求非常模糊，例如"随便""来点歌"，但仍明显是在要音乐，也归为 "music"。
如果只是"今天好累"这类情绪表达，没有说想听歌，归为 "chat"，让聊天回复轻轻询问是否需要音乐陪伴。

返回 JSON：{"intent": "music" | "chat", "reason": "简短理由"}`;
}

// ── Chat reply prompt ─────────────────────────────────

export function buildChatPrompt(
  userText: string,
  recentConversation: Array<{ role: "user" | "agent"; content: string }>,
  memoryContext?: AgentMemoryContext,
) {
  const history = recentConversation
    .slice(-6)
    .map((m) => `${m.role === "user" ? "用户" : "你"}: ${m.content}`)
    .join("\n");

  return `用户在跟你聊天（不是要点歌）。请自然、温柔地回复。
${buildLocalTimeContext(memoryContext)}
${history ? `\n最近的对话:\n${history}\n` : ""}
用户说: "${userText}"

规则：
- 回复要简短自然（1-4句话），像朋友聊天。
- 不要强行推荐音乐。
- 如果用户表达了疲惫、焦虑、难过等情绪，但没有点歌意图，可以轻轻问一句要不要一首歌陪伴。
- 如果用户问你能做什么，就介绍你是 cc，可以理解情绪并帮他找适合此刻的歌。
- 不要说"正在播放"，除非系统已经确认播放成功。

返回 JSON：{"reply": "你的回复"}`;
}

// ── Mood parsing prompt ────────────────────────────────

function topProfileValues(values: WeightedPreference[] | undefined) {
  if (!values) return [];
  return values
    .slice(0, 6)
    .map((item) => ({ value: item.value, weight: item.weight }));
}

function buildLocalTimeContext(memoryContext?: AgentMemoryContext) {
  if (!memoryContext) return "";
  return `本地时间 JSON：
${JSON.stringify(memoryContext.localTime)}

时间使用规则：
- 当前用户明确需求永远优先，时间只作为轻量上下文。
- late_night/睡前倾向低刺激、少鼓点；morning 可以更清醒；evening 可以更放松；通勤或工作日只作为辅助判断。`;
}

export function buildUserProfileContext(
  memoryContext?: AgentMemoryContext,
  userMusicProfile?: UserMusicProfile,
) {
  if (memoryContext) {
    return `用户记忆上下文 JSON：
${JSON.stringify({
  localTime: memoryContext.localTime,
  profile: memoryContext.profile,
  history: memoryContext.history,
  stats: memoryContext.stats,
})}

记忆使用规则：
- 当前这句话的明确需求优先于时间和长期画像。
- 只能引用 memoryContext.history 中真实出现的历史歌曲，不能编造用户听过或喜欢过的歌。
- 推荐理由里最多自然提到 1 首历史歌；只有相关时才提，不要每次硬列清单。
- 最近负反馈和跳过优先用于避开重复、太吵、太丧、太平或不对味的方向。`;
  }

  if (!userMusicProfile || userMusicProfile.recentEvents.length === 0) {
    return "用户长期音乐画像：暂无稳定记录。";
  }

  return `用户长期音乐画像 JSON：
${JSON.stringify({
  preferredGenres: topProfileValues(userMusicProfile.preferredGenres),
  preferredScenes: topProfileValues(userMusicProfile.preferredScenes),
  preferredMoods: topProfileValues(userMusicProfile.preferredMoods),
  likedArtists: topProfileValues(userMusicProfile.likedArtists),
  avoidedArtists: topProfileValues(userMusicProfile.avoidedArtists),
  likedTags: topProfileValues(userMusicProfile.likedTags),
  avoidedTags: topProfileValues(userMusicProfile.avoidedTags),
  languagePreference: userMusicProfile.languagePreference,
  energyPreference: userMusicProfile.energyPreference,
  bpmHints: userMusicProfile.bpmHints.slice(0, 5),
  recentEvents: userMusicProfile.recentEvents.slice(0, 8),
})}`;
}

export function buildMoodPrompt(
  userText: string,
  memoryContext?: AgentMemoryContext,
  userMusicProfile?: UserMusicProfile,
) {
  return `分析用户的音乐需求。

用户说："${userText}"
${buildUserProfileContext(memoryContext, userMusicProfile)}

请参考长期画像，但当前这句话的明确需求优先。

关键词生成规则：
- 生成 2-4 个简短关键词，不要生成自然句。
- 另外生成 searchQuery：这是直接交给 QQ 音乐搜索框的短搜索词，尽量像用户会自己输入的搜索词。
- searchQuery 要自然保留用户原话里的明确要求，例如语言、歌手、年代、风格、场景；用户说"韩文歌/韩语歌"时，searchQuery 应该直接包含"韩语"或"韩文"，例如"韩语 下班 轻快 KPOP"。
- 优先级：场景词（睡前、通勤、学习、运动、雨天、深夜） > 情绪词（治愈、放松、emo、开心、释怀、安静） > 风格词（民谣、钢琴、lofi、R&B、流行、city pop） > 限制词（纯音乐、女声、男声、粤语、中文）。
- 中文平台搜索时优先中文关键词。
- 用户明确要求英文、日文、韩文、粤语等语言时，在 searchLanguage 标出来，并把语言词自然写进 searchQuery。
- 用户想要无歌词时，必须加入"纯音乐"。
- 用户想睡觉时，优先加入"睡前""安静""纯音乐"。
- 用户想专注时，优先加入"专注""lofi"或"纯音乐"。
- 把用户明确不想要的内容放进 avoid，例如不要太吵、不要太丧、不要男声、不要某位歌手。

返回 JSON：
{
  "scene": "coding | resting | night | commute | exercise | daily",
  "mood": ["情绪标签"],
  "energy": "low | medium | high",
  "valence": "sad | warm | neutral | happy",
  "avoid": ["要避开的特征"],
  "keywords": ["2-4个精准搜索关键词，不要太长"],
  "searchGenre": "音乐风格（如 轻音乐、韩语流行、华语流行、民谣）",
  "searchQuery": "直接给 QQ 音乐搜索的短搜索词",
  "searchLanguage": "zh-CN | en | ja | ko | yue | any",
  "bpmHint": "建议BPM范围",
  "summary": "一句情绪总结"
}`;
}

export function buildToolAnalysisPrompt(userText: string, memoryContext?: AgentMemoryContext) {
  return `用户说："${userText}"。
${buildUserProfileContext(memoryContext)}

如果用户想要音乐，请调用 analyze_and_search 工具。分析时要结合本地时间、长期偏好、最近喜欢/跳过/负反馈，但当前用户明确需求优先。`;
}

// ── Selection prompt ───────────────────────────────────

export function buildSelectionPrompt(input: {
  userText: string;
  moodProfile: MoodProfile;
  candidates: PlayableTrack[];
  memoryContext?: AgentMemoryContext;
  userMusicProfile?: UserMusicProfile;
}) {
  const genre = input.moodProfile.searchGenre || "";
  const bpm = input.moodProfile.bpmHint || "";

  return `从候选歌曲中选出最多五首最适合用户当前状态的，并按适合程度从高到低排序。

用户说: "${input.userText}"
情绪: ${input.moodProfile.mood.join("、")}
能量: ${input.moodProfile.energy}
风格: ${genre || "不限"}
搜索词: ${input.moodProfile.searchQuery || input.moodProfile.keywords.join(" ")}
语言: ${input.moodProfile.searchLanguage || "any"}
${bpm ? `BPM: ${bpm}` : ""}
避开: ${input.moodProfile.avoid.join("、")}
${buildUserProfileContext(input.memoryContext, input.userMusicProfile)}

候选 (${input.candidates.length} 首):
${JSON.stringify(
  input.candidates.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist || "",
    source: t.source,
    tags: t.tags || [],
  })),
)}

规则:
1. 情绪匹配 > 热度
2. 只能从上面的候选列表中选择，selectedTrackId 必须完全匹配候选 id
3. 不要编造候选列表外的歌曲、歌手或播放状态
4. 优先有明确风格标签、且贴近用户当前限制的歌曲
5. 如果用户要求外语、粤语、纯音乐、男声/女声等，当前明确需求优先于长期画像
6. 如果长期画像和当前需求冲突，当前需求优先；否则优先贴近长期偏好，避开最近跳过或明确负反馈的方向
7. 当用户反馈"太吵""太丧""换一首""不要这个"时，要主动避开上一首的问题和高度相似的方向
8. 每首都要写独立推荐理由，方便用户点下一首时直接展示
9. 可以在推荐理由里自然提到 1 首用户之前听过或喜欢过的歌作为参照，但只能来自用户记忆上下文，且不相关时不要提

返回 JSON:
{
  "recommendations": [
    {
      "selectedTrackId": "id",
      "reason": "一句简短理由",
      "explanationSegments": ["段1: 回应情绪或场景", "段2: 歌曲特点为什么合适", "段3: 温柔收尾"]
    }
  ]
}`;
}

export function buildFallbackExplanation(input: {
  userText: string;
  moodProfile: MoodProfile;
  track: PlayableTrack;
}) {
  const tags = input.track.tags?.slice(0, 3).join("、") || "温和";

  return [
    `辛苦了，先给你放这首。它偏向${tags}，适合现在先放松下来。`,
    `你说"${input.userText.slice(0, 30)}"，所以我避开了太刺激的声音。`,
    `${input.track.title} 不一定是最热门的，但现在的你需要的是合适，不是热闹。`,
  ];
}
