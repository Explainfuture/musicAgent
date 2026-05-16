// ── Tool definitions ──────────────────────────────────

export const musicAgentTools = [
  {
    type: "function" as const,
    function: {
      name: "analyze_and_search",
      description: "分析用户情绪、场景、偏好限制，并生成音乐搜索策略。只在用户明确或隐含想要音乐时调用。",
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
                description: "2-4个精准搜索关键词。中文平台优先中文；用户明确要英文、日文、韩文等外语时可以用对应语言或中文描述。",
              },
              genre: { type: "string", description: "音乐风格，如轻音乐、民谣、lofi、R&B、city pop、韩语流行、KPOP" },
              query: {
                type: "string",
                description: "直接给 QQ 音乐搜索框使用的短搜索词。自然保留用户原话中的明确要求，例如语言、风格、场景；用户说韩文歌时应包含韩语或韩文。",
              },
              language: {
                type: "string",
                enum: ["zh-CN", "en", "ja", "ko", "yue", "any"],
                description: "用户明确要求的语言；没有明确语言要求时用 any，中文优先时用 zh-CN。",
              },
              bpmHint: {
                type: "string",
                description: "建议 BPM 范围，如 50-70、70-95、120-150。",
              },
            },
            required: ["keywords", "genre", "query"],
          },
          userSummary: { type: "string", description: "情绪总结" },
        },
        required: ["moodAnalysis", "searchStrategy", "userSummary"],
      },
    },
  },
];
