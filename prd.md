# 终端式桌面情绪音乐 Agent 第一版 MVP PRD

## 0. 文档信息

* 产品暂定名：MoodPlayer Agent / 耳朵日记 Agent
* 版本：MVP v0.1
* 产品形态：Electron 桌面端终端式小窗口应用
* 核心目标：用户用一句话描述当下状态，Agent 自动选择一首可播放音乐并立即播放，同时在播放过程中解释为什么选择这首歌。
* 第一版关键词：Electron、终端式窗口、对话流、语音输入、情绪理解、自动播放、边播边解释、可换歌、可暂停。

---

## 1. 产品定位

### 1.1 一句话定位

一个“像 Claude Code 终端窗口一样，可以通过对话理解情绪并直接播放一首歌”的桌面 Music Agent。

### 1.2 不是普通推荐系统

本产品第一版不做“推荐 10 首歌让用户选”，而是做“Agent 替用户做选择并直接播放”。

用户已经很累时，不希望继续筛选歌曲，也不希望打开浏览器网页。产品应该像一个可点击的终端式音乐陪伴者：用户像和 ChatGPT 一样来回对话，Agent 听完描述后直接播放一首最合适的歌，并在播放过程中说明选择理由。

### 1.3 核心体验

用户说：

> 我今天有点累，有点失落，但不想听太丧的，想慢慢缓一下。

系统行为：

1. 自动识别语音并转文字。
2. Agent 解析用户情绪和音乐需求。
3. Agent 从可播放音乐源中选择一首歌。
4. 系统自动开始播放。
5. 播放过程中，Agent 以流式文本解释为什么选这首。
6. 用户可以暂停、换一首、反馈“不对味”。

---

## 2. 背景与问题

### 2.1 用户痛点

用户在疲惫、emo、写代码、通勤、深夜、焦虑等状态下，经常没有精力打开音乐 App 搜索、筛选、试听、切歌。

传统音乐产品的问题：

* 要用户主动搜索。
* 推荐太多，选择成本高。
* 歌单是静态的，不理解当下情绪。
* 推荐理由缺失，用户不知道为什么这首歌适合自己。
* AI 歌单生成通常只返回列表，不直接播放。

### 2.2 MVP 要解决的问题

第一版只解决一个核心问题：

> 用户表达当下情绪后，系统能否快速、稳定地自动播放一首还算贴合情绪的音乐？

---

## 3. MVP 目标

### 3.1 产品目标

* 用户可以通过语音或文字描述当下状态。
* Agent 可以理解用户情绪、场景、音乐偏好约束。
* Agent 只选择一首歌并自动播放。
* 播放时 Agent 同步给出选择理由。
* 用户可以暂停、换一首、反馈是否对味。
* 系统记录用户反馈，用于后续优化。

### 3.2 技术目标

* 使用 Electron 承载桌面窗口，渲染层继续使用 Next.js / React。
* 使用 Chromium Web Speech API 作为第一版 STT。
* 使用 DeepSeek API 做 LLM 推理和 Agent 决策，API Key 只通过 `.env.local` 的 `DEEPSEEK_API_KEY` 配置，不写入仓库。
* 使用 Jamendo / Audius 等可直接通过音频流播放的音乐源作为主音乐源。
* 第一版移除 B 站 iframe / BVID 白名单链路，只保留真实音频播放链路。
* 使用 localstorage 存储用户反馈和音乐记忆，类似于gpt的json记忆，先做第一层。

### 3.3 第一版不追求

* 不做完整音乐播放器。
* 不做 QQ 音乐、网易云、Apple Music 的完整曲库播放。
* 不做登录体系的复杂权限管理。
* 不做多人共享歌单。
* 不做歌词同步。
* 不做 B 站 iframe、BVID 白名单或 B 站音频爬取。
* 不做复杂推荐系统。
* 不做移动端 App。

---

## 4. 目标用户

### 4.1 核心用户画像

#### 用户 A：疲惫的开发者

* 经常写代码、学习、熬夜。
* 想要音乐陪伴，但不想花时间找歌。
* 需要低干扰、情绪稳定、适合专注的音乐。

典型输入：

> 我现在在写代码，有点累，但不想听太吵的。

#### 用户 B：深夜情绪型用户

* 夜晚容易情绪波动。
* 不想被太燃或太丧的音乐刺激。
* 需要一首能接住情绪的歌。

典型输入：

> 我今天有点失落，但不想越听越难过。

#### 用户 C：只想被安排的人

* 不想选歌。
* 不想看长歌单。
* 只希望系统直接播放。

典型输入：

> 别让我选了，直接给我放一首适合现在的。

---

## 5. 核心使用场景

### 场景 1：语音描述情绪并自动播放

1. 用户打开 Electron 桌面终端窗口。
2. 点击麦克风按钮。
3. 用户说出状态。
4. 系统转文字。
5. Agent 思考并搜索音乐。
6. 自动播放一首歌。
7. Agent 边播边解释。

### 场景 2：用户觉得不对味，换一首

1. 当前歌曲播放中。
2. 用户点击“换一首”。
3. Agent 读取上一首的失败原因。
4. 重新选择另一首。
5. 自动播放下一首。
6. 系统记录上一首为负反馈。

### 场景 3：用户暂停播放

1. 当前歌曲播放中。
2. 用户点击暂停。
3. 音乐停止。
4. Agent Orb 状态切换为 idle。
5. 可继续播放或重新输入情绪。

### 场景 4：用户使用文字输入

1. 用户不想说话。
2. 直接在输入框输入情绪。
3. 后续流程与语音输入一致。

---

## 6. 功能范围

## 6.1 P0 必做功能

### F1. 终端式桌面窗口 UI

#### 描述

应用以一个固定大小的 Electron 桌面窗口出现，整体体验类似 Claude Code / 终端窗口，而不是浏览器网页。

#### UI 元素

* Agent 动态小图标 Orb。
* 终端式状态行。
* 对话消息流。
* 麦克风按钮。
* 终端 prompt 风格文字输入框。
* 当前播放卡片。
* 播放 / 暂停按钮。
* 换一首按钮。
* Agent 解释区域。

#### 状态

* idle：等待用户输入。
* listening：正在听用户说话。
* transcribing：语音转文字中。
* thinking：Agent 理解情绪中。
* searching：搜索音乐中。
* playing：正在播放。
* paused：已暂停。
* error：出现错误。

---

### F2. 语音输入 STT

#### 描述

用户点击麦克风后，可以直接说话，系统将语音转成文字。

#### MVP 实现

使用浏览器 Web Speech API。

#### 交互要求

* 点击麦克风后 Orb 进入 listening 状态。
* 识别过程中显示实时文字草稿。
* 识别完成后自动填入输入框。
* 用户可以手动编辑识别结果。
* 用户点击“开始播放”后提交给 Agent。

#### 异常处理

* 浏览器不支持语音识别：提示用户改用文字输入。
* 用户拒绝麦克风权限：提示需要授权或改用文字输入。
* 识别失败：保留文字输入方案。

---

### F3. 文字输入

#### 描述

用户可以直接输入情绪、场景、音乐需求。

#### 示例

* 我现在写代码，有点累，但不想太吵。
* 今天很烦，想听点能让我慢慢冷静下来的。
* 我刚跑完步，想听一首舒服一点的。
* 深夜了，想听一首温柔但不太丧的。

---

### F4. Agent 情绪解析

#### 描述

Agent 需要将用户输入解析成结构化音乐需求。

#### 输出结构

```json
{
  "scene": "coding",
  "mood": ["tired", "slightly_down"],
  "energy": "low_to_medium",
  "valence": "warm_not_sad",
  "vocalPreference": "soft_or_low_interference",
  "languagePreference": "any",
  "avoid": ["too_loud", "too_sad", "heavy_beat"],
  "searchKeywords": ["mellow", "warm", "soft", "lofi", "healing"],
  "reasoningSummary": "用户疲惫且轻微低落，需要温和、节奏稳定、不压迫的音乐。"
}
```

#### 要求

* 不把用户情绪简单粗暴映射为单一标签。
* 必须识别“不想太丧”“不想太吵”“想缓一下”这类约束。
* 第一版不需要复杂心理分析。
* 输出必须可被音乐搜索工具使用。

---

### F5. 音乐搜索与选择

#### 描述

Agent 根据结构化需求搜索可播放音乐，并只选择一首最合适的。

#### 音乐源优先级

1. Jamendo：主源，适合直接音频播放。
2. Audius：主源，适合直接流式播放。
3. 如果主源不可用，提示用户当前音乐源不可用并支持重试；第一版不再接 B 站 iframe 兜底。

#### 选择逻辑

每次候选歌曲计算一个 matchScore：

```txt
matchScore = 情绪匹配分 + 场景匹配分 + 约束匹配分 + 可播放稳定性分 - 失败历史惩罚
```

#### 第一版简化实现

不用训练推荐模型，只用规则 + LLM 重排：

1. 根据情绪生成搜索关键词。
2. 分别请求 Jamendo / Audius。
3. 得到 5-10 个候选。
4. 让 LLM 根据用户输入和候选元数据选择 1 首。
5. 返回播放信息和推荐理由。

---

### F6. 自动播放

#### 描述

Agent 选择歌曲后，然后用声音陈述选择的理由，随着理由陈述，系统应自动开始播放。

#### 播放方式

##### Jamendo / Audius

使用 HTMLAudioElement：

```tsx
<audio src={track.audioUrl} autoPlay controls />
```

可监听：

* play
* pause
* ended
* error
* timeupdate

---

### F7. 边播放边解释

#### 描述

歌曲开始播放后，Agent 不应一次性输出大段解释，而应像陪伴者一样逐步说明。

#### 解释内容

* 为什么这首歌适合当前情绪。
* 它的节奏、能量、人声、氛围为什么合适。
* 它会如何帮助用户从当前状态过渡。

#### 示例

> 我选这首不是为了把你一下子拉起来，而是让你的状态先稳下来。它的节奏比较慢，但不是完全低沉，人声也不会很压迫，适合你现在这种有点累、但不想继续沉下去的状态。

#### 交互方式

就像是对话流一样，一左一右。

---

### F8. 暂停 / 继续 / 换一首

#### 暂停

用户点击暂停后：

* 音频暂停。
* Orb 动画停止跳动。
* 状态切换为 paused。

#### 继续

用户点击继续后：

* 音频继续播放。
* Orb 恢复 playing 状态。

#### 换一首

用户点击换一首后：

* 当前歌曲停止。
* 记录当前歌曲为 skipped。
* Agent 重新选择一首。
* 新歌曲自动播放。

---

### F9. 反馈记录

#### 描述

用户可以对当前播放结果进行轻量反馈。

#### MVP 反馈按钮

* 对味
* 不对味
* 太吵
* 太丧
* 太平
* 换一首

#### 存储目的

第一版不需要复杂个性化推荐，但需要为后续音乐记忆打基础。

---

## 6.2 P1 可选功能

* TTS：Agent 用语音说推荐理由。
* 音乐人格记忆。
* 常用场景快捷按钮：写代码、深夜、通勤、运动、放空。
* 增加更多可直接音频播放的合法音乐源。
* 收藏当前歌曲。
* 历史播放记录。

---

## 7. 非功能需求

### 7.1 响应速度

* STT 完成后 2 秒内进入 Agent 思考状态。
* Agent 请求完成后 5 秒内开始播放。
* 音乐源失败时 3 秒内自动 fallback 到下一个源。

### 7.2 稳定性

* 任一音乐源失败时不能导致整个应用崩溃。
* 播放失败时自动换源或提示用户。
* LLM 返回格式错误时需要做 JSON 修复或兜底。

### 7.3 体验要求

* 用户输入后不要返回一堆选项。
* 默认只播放一首。
* 用户不需要理解音乐源细节。
* 错误提示必须简短，不打断体验。

### 7.4 合规要求

* 不抓取受保护平台的音频直链。
* 音乐源只使用允许第三方播放的真实音频流或官方开放播放接口。
* 不提供下载功能。

---

## 8. 信息架构与窗口结构

### 8.1 Electron 窗口

MVP 只有一个 Electron 桌面窗口，渲染入口仍由 Next.js 页面承载：

```txt
/app/page.tsx
```

### 8.2 终端窗口结构

```txt
MusicAgentWindow
├── AgentOrb
├── TerminalStatusLine
├── ChatTranscript
├── MicButton
├── PromptInput
├── PlayerCard
│   ├── Cover
│   ├── Title
│   ├── Artist
│   ├── SourceBadge
│   ├── PlayPauseButton
│   └── NextButton
├── ExplanationStream
└── FeedbackBar
```

### 8.3 视觉风格

* 窗口尺寸：约 460px × 720px。
* 圆角：16px。
* 背景：深色终端风格。
* 消息流：类似 ChatGPT 的 you / agent / system 来回对话。
* Orb：居中偏上，呼吸动画。
* 播放状态：Orb 随节奏轻微跳动。
* 思考状态：Orb 缓慢旋转或发光。

---

## 9. Agent 状态机

```txt
idle
  ↓ 用户输入
listening / typing
  ↓ 提交
transcribing
  ↓ 得到文字
thinking
  ↓ 情绪解析完成
searching
  ↓ 找到歌曲
playing
  ↓ 用户暂停
paused
  ↓ 用户继续
playing
  ↓ 用户换歌
searching
  ↓ 播放失败
error / searching fallback
```

### 状态说明

#### idle

等待用户输入。

#### listening

正在听用户语音。

#### transcribing

正在把语音转成文字。

#### thinking

Agent 正在理解用户状态。

#### searching

Agent 正在寻找可播放音乐。

#### playing

音乐正在播放，解释文本开始流式出现。

#### paused

用户主动暂停。

#### error

语音识别、LLM、音乐源或播放发生错误。

---

## 10. Agent 能力设计

### 10.1 Agent 角色定义

Agent 是一个“低打扰、会理解情绪的音乐陪伴者”。

它的行为准则：

* 不说教。
* 不过度心理分析。
* 不让用户继续做选择。
* 默认替用户决定一首。
* 推荐理由要具体，不要空泛。
* 用户不喜欢时快速换一首，不争辩。

### 10.2 Agent 系统 Prompt 草案

```txt
你是一个终端式桌面 Music Agent。你的任务不是生成歌单，而是根据用户当下的情绪、场景和限制，在对话流中选择一首最适合立刻播放的音乐。

你必须遵守：
1. 默认只选择一首歌。
2. 不要把选择权还给用户，除非没有可播放资源。
3. 先理解用户的情绪状态、能量水平、场景和排除项。
4. 选择音乐时优先考虑“此刻适不适合”，而不是歌曲是否热门。
5. 推荐理由要具体说明节奏、能量、人声、氛围和用户状态之间的关系。
6. 不要使用夸张心理诊断，不要说你能治疗用户。
7. 如果用户说“不对味”，立刻换方向选择下一首。
```

---

## 11. Tool Calling 设计

### 11.1 parseUserMood

#### 输入

```json
{
  "userText": "我今天有点累，有点失落，但不想听太丧的，想慢慢缓一下。"
}
```

#### 输出

```json
{
  "scene": "resting",
  "mood": ["tired", "slightly_down"],
  "energy": "low",
  "valence": "warm",
  "avoid": ["too_sad", "too_loud"],
  "keywords": ["warm", "soft", "mellow", "healing", "gentle"],
  "summary": "用户疲惫且轻微低落，需要温柔但不继续下沉的音乐。"
}
```

---

### 11.2 searchPlayableTracks

#### 输入

```json
{
  "keywords": ["warm", "soft", "mellow"],
  "energy": "low",
  "avoid": ["too_sad", "too_loud"],
  "sources": ["jamendo", "audius"]
}
```

#### 输出

```json
{
  "candidates": [
    {
      "id": "jamendo_123",
      "source": "jamendo",
      "title": "Soft Evening",
      "artist": "Unknown Artist",
      "audioUrl": "https://...",
      "coverUrl": "https://...",
      "duration": 210,
      "tags": ["mellow", "acoustic", "soft"]
    }
  ]
}
```

---

### 11.3 selectBestTrack

#### 输入

```json
{
  "userText": "我今天有点累，有点失落，但不想听太丧的，想慢慢缓一下。",
  "moodProfile": {},
  "candidates": []
}
```

#### 输出

```json
{
  "selectedTrackId": "jamendo_123",
  "reason": "这首歌节奏比较慢，但不是完全低沉，适合用户从疲惫中慢慢缓回来。",
  "explanationSegments": [
    "我选这首不是为了把你一下子拉起来，而是先让你的状态稳下来。",
    "它的节奏比较慢，人声也不压迫，适合你现在这种有点累的状态。",
    "它不会太丧，整体氛围更像是陪你缓一缓。"
  ]
}
```

---

### 11.4 saveFeedback

#### 输入

```json
{
  "trackId": "jamendo_123",
  "feedback": "too_sad",
  "userText": "我今天有点累，有点失落，但不想听太丧的。"
}
```

#### 输出

```json
{
  "success": true
}
```

---

## 12. 技术架构

### 12.1 总体架构

```txt
Electron Desktop App
│
├── Main Process
│   ├── BrowserWindow
│   └── autoplay-policy
│
├── Renderer UI (Next.js / React)
│   ├── SpeechRecognition
│   ├── Chat Transcript
│   ├── Terminal Status
│   ├── Audio Player
│   └── Feedback UI
│
├── API Routes
│   ├── /api/agent/resolve
│   ├── /api/music/search
│   ├── /api/music/stream/audius/[id]
│   └── /api/feedback
│
├── LLM Provider
│   └── DeepSeek API
│
├── Music Sources
│   ├── Jamendo API
│   └── Audius API
│
└── Database
    └── Supabase / PostgreSQL
```

### 12.2 推荐技术栈

```txt
Next.js App Router
Electron
TypeScript
Tailwind CSS
shadcn/ui
Framer Motion
Vercel AI SDK
DeepSeek API
Zod
React Hook Form，可选
```

## 13. API 路由设计

### 13.1 POST /api/agent/resolve

#### 作用

接收用户文本，返回可播放歌曲和解释内容。

#### Request

```json
{
  "userId": "anonymous_or_user_id",
  "text": "我今天有点累，有点失落，但不想听太丧的。",
  "previousTrackIds": []
}
```

#### Response

```json
{
  "moodProfile": {
    "scene": "resting",
    "mood": ["tired", "slightly_down"],
    "energy": "low",
    "avoid": ["too_sad", "too_loud"]
  },
  "track": {
    "id": "jamendo_123",
    "source": "jamendo",
    "title": "Soft Evening",
    "artist": "Unknown Artist",
    "audioUrl": "https://...",
    "embedUrl": null,
    "coverUrl": "https://...",
    "duration": 210
  },
  "explanationSegments": [
    "我选这首不是为了把你一下子拉起来，而是先让你的状态稳下来。",
    "它的节奏比较慢，人声也不压迫，适合你现在这种有点累的状态。",
    "它不会太丧，整体氛围更像是陪你缓一缓。"
  ]
}
```

---

### 13.2 POST /api/music/search

#### 作用

根据结构化 moodProfile 搜索候选音乐。

#### Request

```json
{
  "keywords": ["warm", "soft", "mellow"],
  "sources": ["jamendo", "audius"],
  "limit": 10
}
```

#### Response

```json
{
  "candidates": []
}
```

---

### 13.3 POST /api/feedback

#### 作用

记录用户对当前歌曲的反馈。

#### Request

```json
{
  "userId": "anonymous_or_user_id",
  "trackId": "jamendo_123",
  "source": "jamendo",
  "feedback": "good_fit",
  "originalText": "我今天有点累，有点失落。"
}
```

#### Response

```json
{
  "success": true
}
```

---

## 14. 数据库设计（我觉得这里用indexDB就可以，不需要太多别的，这里你只需要参考即可）

---

## 16. 播放器设计

### 16.1 Audio 播放器

用于 Jamendo / Audius。

#### 事件监听

```ts
onPlay
onPause
onEnded
onError
onTimeUpdate
```

#### 行为

* 播放开始：状态 playing。
* 暂停：状态 paused。
* 播放结束：状态 ended，可提示“要不要再来一首”。
* 播放失败：自动 fallback 到下一首。

---

### 16.2 Electron 播放策略

用于解决桌面端异步选歌后的自动播放问题。

#### 行为

* Electron 主进程设置 `autoplay-policy=no-user-gesture-required`。
* Audius 音频通过同源代理 `/api/music/stream/audius/[id]` 播放，避免外部重定向或媒体 CORS 导致无声。
* 如果自动播放仍被系统拦截，播放器显示“播放这首”按钮，不直接判定为音乐源失败。

---

## 17. UI 交互细节

### 17.1 初始态

文案：

> 跟我说说你现在的状态，我直接给你放一首。

按钮：

* 按住说话 / 点击说话
* 文字输入

### 17.2 Listening 态

文案：

> 我在听。

视觉：

* Orb 跳动。
* 麦克风按钮发光。
* 展示实时识别文字。

### 17.3 Thinking 态

文案：

> 我在理解你现在需要什么样的声音。

视觉：

* Orb 缓慢旋转。
* 不展示复杂 loading。

### 17.4 Searching 态

文案：

> 我在找一首现在能接住你的歌。

### 17.5 Playing 态

展示：

* 歌名。
* 作者。
* 来源。
* 封面。
* 播放控制。
* Agent 解释。

文案示例：

> 先不用选，我给你放这首。

### 17.6 Error 态

错误文案要短：

* 这首没播起来，我换一首。
* 麦克风没拿到权限，可以直接打字。
* 当前运行环境不支持语音识别，可以用文字输入。

---

## 18. 验收标准

### 18.1 核心链路验收

输入：

> 我现在写代码有点累，但不想听太吵的。

系统必须完成：

1. 成功获得文字输入。
2. Agent 解析出 coding / tired / avoid too_loud。
3. 搜索到至少 1 个可播放候选。
4. 自动播放一首歌。
5. 展示至少 2 段推荐理由。
6. 用户可以暂停。
7. 用户可以换一首。
8. 用户反馈被记录。

### 18.2 播放源验收

* Jamendo 歌曲可以通过 audio 标签播放。
* Audius 歌曲如果拿到 stream URL，可以通过 audio 标签播放。
* 任一源失败时不会导致页面崩溃。

### 18.3 Agent 验收

Agent 不允许：

* 返回 10 首歌让用户选择。
* 只说“这首歌很好听”这种空泛理由。
* 忽略用户的排除条件。
* 在用户说“不想太丧”时选择明显悲伤向歌曲。

Agent 必须：

* 只选择一首。
* 解释选择理由。
* 支持换一首。
* 记录反馈。

---

## 19. 失败兜底策略

### 19.1 STT 失败

兜底：让用户文字输入。

### 19.2 LLM 失败

兜底：使用预设 mood 到 keyword 的映射。

示例：

```ts
const fallbackMoodMap = {
  tired: ["soft", "calm", "mellow"],
  coding: ["lofi", "instrumental", "focus"],
  sad_not_too_sad: ["warm", "healing", "gentle"]
};
```

### 19.3 Jamendo 失败

兜底到 Audius。

### 19.4 Audius 失败

兜底到 Jamendo 其他候选；若没有候选，提示用户当前音乐源不可用并支持重试。

### 19.5 自动播放失败

提示：

> 系统拦截了自动播放，点一下“播放这首”就能出声。

---

## 20. 开发任务拆分

### Milestone 1：Electron 终端式 UI

* 搭建 Next.js + Electron 项目。
* 配置 Tailwind / shadcn/ui。
* 实现终端式桌面窗口布局。
* 实现 AgentOrb 动画。
* 实现对话流、输入框和按钮。

### Milestone 2：语音输入

* 接入 Web Speech API。
* 实现麦克风权限处理。
* 实现语音转文字展示。
* 添加不支持当前运行环境的兜底提示。

### Milestone 3：Agent API

* 创建 /api/agent/resolve。
* 接入 DeepSeek API。
* 实现结构化 moodProfile 输出。
* 使用 Zod 校验 LLM 返回结果。

### Milestone 4：音乐源

* 接入 Jamendo tracks API。
* 接入 Audius 搜索和播放接口。
* 实现候选歌曲统一格式。

### Milestone 5：播放

* 实现 HTMLAudioElement 播放。
* 实现 Audius 同源音频代理播放。
* 实现暂停 / 继续 / 换一首。
* 实现播放失败 fallback。

### Milestone 6：边播边解释

* 实现 explanationSegments 分段显示。
* 播放后逐步展示解释。
* 支持关闭解释。

### Milestone 7：反馈与记忆

* 接入 Supabase。
* 创建反馈表。
* 实现反馈按钮。
* 换一首时记录 skipped。

---

## 21. 推荐目录结构

```txt
electron/
├── main.cjs
└── preload.cjs

src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       ├── agent/
│       │   └── resolve/route.ts
│       ├── music/
│       │   ├── search/route.ts
│       │   └── stream/audius/[id]/route.ts
│       └── feedback/route.ts
│
├── components/
│   ├── music-agent/
│   │   ├── MusicAgentWindow.tsx
│   │   ├── AgentOrb.tsx
│   │   ├── MicButton.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── ExplanationStream.tsx
│   │   └── FeedbackBar.tsx
│
├── lib/
│   ├── ai/
│   │   ├── deepseek.ts
│   │   ├── prompts.ts
│   │   └── schemas.ts
│   ├── music/
│   │   ├── jamendo.ts
│   │   ├── audius.ts
│   │   └── normalize.ts
│   ├── db/
│   │   └── supabase.ts
│   └── speech/
│       └── useSpeechRecognition.ts
│
└── types/
    ├── agent.ts
    ├── music.ts
    └── feedback.ts
```

---

## 22. 核心类型定义

```ts
export type MoodProfile = {
  scene: string;
  mood: string[];
  energy: "low" | "medium" | "high";
  valence: "sad" | "warm" | "neutral" | "happy";
  avoid: string[];
  keywords: string[];
  summary: string;
};

export type PlayableTrack = {
  id: string;
  source: "jamendo" | "audius";
  title: string;
  artist?: string;
  audioUrl?: string;
  coverUrl?: string;
  duration?: number;
  tags?: string[];
};

export type AgentResolveResponse = {
  moodProfile: MoodProfile;
  track: PlayableTrack;
  explanationSegments: string[];
};
```

---

## 23. MVP 成功指标

### 23.1 体验指标

* 用户输入一次后，可以在 10 秒内听到音乐。
* 用户不需要从列表里选择歌曲。
* 用户可以在 1 次点击内换歌。
* 用户可以在 1 次点击内暂停。

### 23.2 主观指标

内测用户回答：

* “它确实像是在替我选歌。”
* “我累的时候愿意打开它。”
* “推荐理由让我觉得它不是随机选的。”

### 23.3 技术指标

* Agent resolve 成功率 > 90%。
* 主源播放成功率 > 70%。
* fallback 后最终播放成功率 > 90%。
* 页面无严重崩溃。

---

## 24. 风险与应对

### 风险 1：音乐源不稳定

应对：Jamendo / Audius 多源 fallback；当没有可播放音频候选时给出短提示并支持重试。

### 风险 2：桌面端自动播放或外部音频流不稳定

应对：Electron 主进程放开自动播放策略；Audius 通过同源代理流播放；自动播放被拦截时显示“播放这首”按钮。

### 风险 3：Agent 选歌不准

应对：限制搜索候选，使用规则 + LLM 重排，记录反馈。

### 风险 4：语音识别兼容性不足

应对：文字输入兜底；第二版换成 MediaRecorder + 云端 STT。

### 风险 5：版权合规风险

应对：不抓受保护平台音频直链，不下载，只播放允许第三方播放的真实音频流或官方开放播放接口。

---

## 25. 第二版方向

MVP 验证成功后，可以继续做：

1. 接入真实 STT 服务。
2. 加入 TTS，让 Agent 开口说推荐理由。
3. 加入用户登录和长期音乐记忆。
4. 加入全局快捷键唤起桌面终端窗口。
5. 加入更多合法可直连播放的音乐源。
6. 支持“连续播放模式”。
7. 支持“今天别解释，直接播放”。
8. 支持“更温柔一点 / 更燃一点 / 更孤独一点”的连续调参。

---

## 26. 第一版核心结论

这个 MVP 的本质不是音乐推荐系统，而是：

> 一个基于情绪理解的自动播放 Agent。

第一版最重要的产品原则：

1. 不让用户选。
2. 只播放一首。
3. 边播边解释。
4. 不抓取非法音频资源。
5. 播放失败就自动换源。
6. 用户反馈后快速修正。

只要这条链路跑通，这个产品就已经有明显区别于普通 AI 歌单生成器的体验价值。
