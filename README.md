# MusicAgent

一个基于 **Next.js + Electron** 的情绪音乐 Agent：你用一句话描述当下状态（支持语音/文字），Agent 会理解情绪后**直接选一首歌并播放**，并在界面里给出推荐理由与工具链路。

## Description

MusicAgent 是一个“少选择、快播放”的桌面音乐陪伴工具，不走传统“给你十首自己挑”的路线，而是围绕“我现在就想被安排一首歌”来设计。

当前版本核心能力：

- 终端风格对话窗口 + Agent Orb 状态反馈（idle / thinking / searching / playing）。
- 情绪解析 + 选歌决策（DeepSeek）。
- 曲库检索与候选重排（当前优先使用 QQ 音乐）。
- 自动播放、暂停/继续、换一首。
- QQ 音乐歌词拉取与时间轴歌词滚动。
- 反馈记忆与最近播放历史（本地存储）。
- Electron QQ 登录流程（扫码登录 + 播放 URL 获取）。

## 技术栈

- Next.js 16（App Router）
- React 19 + TypeScript
- Electron 42
- Tailwind CSS 4
- DeepSeek API（LLM 推理）
- Web Speech API（浏览器语音识别，另有腾讯云 ASR API 路由可选）

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 配置环境变量

在项目根目录创建 `.env.local`：

```bash
# 必填：LLM
DEEPSEEK_API_KEY=your_deepseek_api_key
# 可选，默认 deepseek-chat
DEEPSEEK_MODEL=deepseek-chat

# 可选：Jamendo 搜索（如果你要启用/测试 Jamendo）
JAMENDO_CLIENT_ID=your_jamendo_client_id

# 可选：腾讯云语音转写（/api/speech/transcribe）
TENCENTCLOUD_SECRET_ID=your_secret_id
TENCENTCLOUD_SECRET_KEY=your_secret_key
TENCENTCLOUD_REGION=ap-guangzhou
TENCENT_ASR_ENGINE=16k_zh

# 可选：QQ Music Cookie（也可在 Electron 内扫码登录）
QQMUSIC_COOKIE=your_cookie
```

> 说明：如果不配置 `DEEPSEEK_API_KEY`，Agent 解析与选歌会失败。

### 3) 启动开发模式（Web）

```bash
npm run dev
```

打开 `http://localhost:3000`。

### 4) 启动桌面模式（Electron + Next）

```bash
npm run electron
```

该命令会并行启动 Next.js，并在服务就绪后拉起 Electron 桌面窗口。

## 使用说明

### 基础使用流程

1. 打开应用后，在输入框输入你的状态（例如：`今天有点累，别太吵`）。
2. 点击发送，Agent 会经历：理解情绪 → 曲库检索 → 选择歌曲。
3. 进入播放后可：
   - 播放/暂停
   - 换一首
   - 查看推荐理由与工具链路
4. 如果是 QQ 曲目，可加载歌词并跟随播放进度高亮。

### QQ 音乐登录（桌面端）

- 在 Electron 界面点击 **登录 QQ 音乐**。
- 扫码完成后会保存登录态（cookie），后续可直接用于播放地址获取。
- 若提示登录失效，可点击退出后重新登录。

### 语音输入

- 客户端使用浏览器语音识别能力（Web Speech API）。
- 若当前环境不支持或权限被拒绝，可直接使用文字输入。

## 可用脚本

```bash
npm run dev          # Next.js 开发
npm run electron     # Electron + Next 联调
npm run build        # 构建
npm run start        # 生产启动
npm run lint         # TypeScript 无输出检查
npm run typecheck    # Next typegen + TS 检查
```

## 项目结构（核心）

```txt
electron/                         # Electron 主进程与预加载
src/app/api/agent/resolve         # Agent 解析与选歌入口
src/components/music-agent/       # 主界面与播放器组件
src/lib/agent/resolveMusic.ts     # 情绪解析 + 检索 + 选歌编排
src/lib/music/qqmusic.ts          # QQ 音乐搜索/歌词能力
src/lib/ai/deepseek.ts            # DeepSeek API 调用
src/lib/storage/                  # 本地反馈与用户画像存储
```

## 注意事项

- QQ 音乐播放链路主要面向 Electron 桌面端；纯 Web 环境会受限。
- 语音识别能力依赖浏览器与系统权限。
- 本项目当前偏向中文语境与中文音乐搜索体验。
