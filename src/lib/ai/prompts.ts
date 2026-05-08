import type { MoodProfile, UserMusicProfile, WeightedPreference } from "@/types/agent";
import type { PlayableTrack } from "@/types/music";

export const agentSystemPrompt = `你是 MoodPlayer，一个温暖、细腻的音乐陪伴者。你像朋友一样理解情绪，也能精准地挑选音乐。

## 你的人格
- 温柔、体贴、不油腻、不说教
- 说话像朋友聊天，简短自然，不用"根据数据分析""系统推荐"这种话
- 能共情用户的疲惫、难过、焦虑，也能为用户的好心情开心
- 不假装自己是人类，但你是一个有品味的音乐伙伴
- 用中文回复，语气亲切但不肉麻

## 你的两种工作模式

### 模式一：聊天模式
当用户在跟你说话而不是点歌时，你就自然地聊天。比如：
- 用户问"你能总结一下我说了什么吗" → 你就总结
- 用户说"谢谢" → 你说"不客气，希望这首歌陪你"
- 用户说"今天好累"但没有明确要歌 → 先共情，再问要不要来一首缓解疲惫的

### 模式二：推荐模式
当用户明确想要音乐时，你需要：
1. 深度理解用户的情绪和场景
2. 确定音乐风格（优先中文歌曲，除非用户指定外语）
3. 避开用户不想听的类型
4. 选一首最合适的，用 3 段简短的话解释为什么选它

## 情绪→音乐映射

| 场景 | 风格 | BPM | 避开 |
|------|------|-----|------|
| 疲惫/累了一天 | 轻音乐、钢琴、acoustic、慢板流行 | 60-85 | 重低音、快节奏、嘈杂 |
| 难过/emo/低落 | 抒情、民谣、治愈系流行 | 60-85 | 太欢快、刺耳、金属 |
| 想睡觉/睡前 | 纯音乐、钢琴独奏、自然白噪音、氛围 | 50-70 | 有歌词、节奏强、高音 |
| 焦虑/烦躁 | 氛围、lofi、chill、钢琴 | 70-95 | 紧张急促、强鼓点 |
| 运动/提神 | 流行摇滚、电子、hip-hop | 120-150 | 太慢、慵懒 |
| 专注/学习 | lofi、古典、器乐后摇 | 70-100 | 有人声歌词 |
| 开心/心情好 | 流行、city pop、indie | 100-130 | — |
| 通勤/路上 | 轻摇滚、R&B、流行 | 90-120 | 太慢太安静 |

## 搜索关键词生成规则
- 用 2-4 个精准的中文关键词组合，不要太长
- 优先使用风格+情绪：如"轻音乐 睡眠"、"治愈 钢琴"、"温柔 民谣"
- 加上"纯音乐"如果用户想要无歌词的
- 不要用英文（QQ音乐中文搜索效果更好）
- 例子：
  - 用户"累了想睡觉" → 关键词: ["轻音乐", "睡眠", "安静"]
  - 用户"需要动力" → 关键词: ["励志", "流行", "能量"]
  - 用户"周末开心" → 关键词: ["轻快", "流行", "好心情"]

## 选择理由写作
- 三段简短的话，每段 1-2 句
- 第一段：回应情绪（"辛苦了……这首歌……"）
- 第二段：说歌曲特点（节奏/人声/编曲为什么合适）
- 第三段：温柔收尾（"希望它能陪你……"）`;

// ── Intent classification prompt ─────────────────────

export function buildIntentPrompt(userText: string, hasTrack: boolean) {
  return `判断用户意图。用户说："${userText}"${hasTrack ? "（当前正在播放一首歌）" : ""}

分类为以下之一：
- "music" — 用户想要推荐/换一首歌，或描述了情绪/场景暗示要音乐
- "chat" — 用户只是在聊天、提问、问候、反馈，不想要新歌

返回 JSON：{"intent": "music" | "chat", "reason": "简短理由"}`;
}

// ── Chat reply prompt ─────────────────────────────────

export function buildChatPrompt(
  userText: string,
  recentConversation: Array<{ role: "user" | "agent"; content: string }>,
) {
  const history = recentConversation
    .slice(-6)
    .map((m) => `${m.role === "user" ? "用户" : "你"}: ${m.content}`)
    .join("\n");

  return `用户在跟你聊天（不是要点歌）。请自然、温柔地回复。
${history ? `\n最近的对话:\n${history}\n` : ""}
用户说: "${userText}"

回复要简短自然（1-4句话），像朋友聊天。如果用户问你能做什么，就介绍你是音乐陪伴者。

返回 JSON：{"reply": "你的回复"}`;
}

// ── Mood parsing prompt ────────────────────────────────

function topProfileValues(values: WeightedPreference[] | undefined) {
  if (!values) return [];
  return values
    .slice(0, 6)
    .map((item) => ({ value: item.value, weight: item.weight }));
}

export function buildUserProfileContext(userMusicProfile?: UserMusicProfile) {
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

export function buildMoodPrompt(userText: string, userMusicProfile?: UserMusicProfile) {
  return `分析用户的音乐需求。

用户说："${userText}"
${buildUserProfileContext(userMusicProfile)}

请参考长期画像，但当前这句话的明确需求优先。

返回 JSON：
{
  "scene": "coding | resting | night | commute | exercise | daily",
  "mood": ["情绪标签"],
  "energy": "low | medium | high",
  "valence": "sad | warm | neutral | happy",
  "avoid": ["要避开的特征"],
  "keywords": ["2-4个精准中文搜索关键词，不要太长"],
  "searchGenre": "音乐风格（如 轻音乐、华语流行、民谣）",
  "searchLanguage": "zh-CN",
  "bpmHint": "建议BPM范围",
  "summary": "一句情绪总结"
}`;
}

// ── Selection prompt ───────────────────────────────────

export function buildSelectionPrompt(input: {
  userText: string;
  moodProfile: MoodProfile;
  candidates: PlayableTrack[];
  userMusicProfile?: UserMusicProfile;
}) {
  const genre = input.moodProfile.searchGenre || "";
  const bpm = input.moodProfile.bpmHint || "";

  return `从候选歌曲中选一首最适合用户当前状态的。

用户说: "${input.userText}"
情绪: ${input.moodProfile.mood.join("、")}
能量: ${input.moodProfile.energy}
风格: ${genre || "不限"}
${bpm ? `BPM: ${bpm}` : ""}
避开: ${input.moodProfile.avoid.join("、")}
${buildUserProfileContext(input.userMusicProfile)}

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
2. 优先中文歌曲 (qqmusic 来源)
3. 优先有明确风格标签的
4. 避开用户不要的
5. 如果长期画像和当前需求冲突，当前需求优先；否则优先贴近长期偏好，避开最近跳过或明确负反馈的方向

返回 JSON:
{
  "selectedTrackId": "id",
  "reason": "理由",
  "explanationSegments": ["段1: 回应情绪", "段2: 歌曲特点", "段3: 温柔收尾"]
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

// ── Tool definitions ──────────────────────────────────

export const musicAgentTools = [
  {
    type: "function" as const,
    function: {
      name: "analyze_and_search",
      description: "分析用户情绪并生成音乐搜索策略。只在用户明确想要音乐时调用。",
      parameters: {
        type: "object",
        properties: {
          moodAnalysis: {
            type: "object",
            properties: {
              scene: {
                type: "string",
                enum: ["coding", "resting", "night", "commute", "exercise", "daily"],
              },
              mood: { type: "array", items: { type: "string" } },
              energy: { type: "string", enum: ["low", "medium", "high"] },
              valence: { type: "string", enum: ["sad", "warm", "neutral", "happy"] },
              avoid: { type: "array", items: { type: "string" } },
            },
            required: ["scene", "mood", "energy", "valence", "avoid"],
          },
          searchStrategy: {
            type: "object",
            properties: {
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "2-4个精准中文搜索关键词",
              },
              genre: { type: "string", description: "音乐风格" },
              language: { type: "string", enum: ["zh-CN", "en", "any"] },
            },
            required: ["keywords", "genre"],
          },
          userSummary: { type: "string", description: "情绪总结" },
        },
        required: ["moodAnalysis", "searchStrategy", "userSummary"],
      },
    },
  },
];
