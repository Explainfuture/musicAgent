import { access, readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

import { rankTracks } from "../src/lib/music/normalize.ts";

const moodProfile = {
  scene: "daily",
  mood: ["calm"],
  energy: "medium",
  valence: "warm",
  avoid: [],
  keywords: ["calm"],
  summary: "calm music",
};

test("feedback memory blocks rejected tracks and promotes liked tracks", () => {
  const tracks = [
    { id: "track_rejected", source: "qqmusic", title: "calm rejected" },
    { id: "track_liked", source: "qqmusic", title: "plain liked" },
    { id: "track_neutral", source: "qqmusic", title: "calm neutral" },
  ];
  const feedbackMemory = [
    {
      trackId: "track_rejected",
      source: "qqmusic",
      feedback: "not_fit",
      originalText: "calm",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      trackId: "track_liked",
      source: "qqmusic",
      feedback: "good_fit",
      originalText: "calm",
      createdAt: "2026-01-01T00:00:01.000Z",
    },
  ];

  const ranked = rankTracks(tracks, moodProfile, [], undefined, feedbackMemory);

  assert.equal(ranked[0].id, "track_liked");
  assert.equal(ranked.some((track) => track.id === "track_rejected"), false);
});

test("gitignore does not contain NUL bytes", async () => {
  const gitignore = await readFile(".gitignore");
  assert.equal(gitignore.includes(0), false);
});

test("Electron QQ Music IPC does not return raw cookies to the renderer", async () => {
  const mainProcess = await readFile("electron/main.cjs", "utf8");

  assert.equal(mainProcess.includes("return { success: true, cookie }"), false);
  assert.equal(mainProcess.includes("cookie: cookie ||"), false);
});

test("QQ lyrics route forwards the saved login cookie", async () => {
  const lyricsRoute = await readFile("src/app/api/music/lyrics/route.ts", "utf8");

  assert.match(lyricsRoute, /getQQMusicCookie/);
  assert.match(lyricsRoute, /fetchQQMusicLyricData\(songmid, getQQMusicCookie\(\)\)/);
});

test("collapsed tool trace summary includes the active tool step", async () => {
  const windowComponent = await readFile("src/components/music-agent/MusicAgentWindow.tsx", "utf8");

  assert.match(windowComponent, /const activeToolTrace = useMemo/);
  assert.match(windowComponent, /activeToolTrace\.step/);
  assert.match(windowComponent, /activeToolTrace\.detail/);
});

test("agent selects up to five candidates for the playback queue", async () => {
  const schemas = await readFile("src/lib/ai/schemas.ts", "utf8");
  const promptBuilders = await readFile("src/lib/ai/buildPrompts.ts", "utf8");
  const resolver = await readFile("src/lib/agent/resolveMusic.ts", "utf8");

  assert.match(schemas, /selectedTracksSchema[\s\S]*max\(5\)/);
  assert.match(promptBuilders, /最多五首/);
  assert.match(resolver, /slice\(0, 5\)/);
});

test("AI prompt code is split into templates, builders, and tools", async () => {
  await access("src/lib/ai/promptTemplates.ts");
  await access("src/lib/ai/buildPrompts.ts");
  await access("src/lib/ai/tools.ts");
  await assert.rejects(() => access("src/lib/ai/prompts.ts"));
});

test("agent prompt includes safety boundaries and candidate-only selection", async () => {
  const templates = await readFile("src/lib/ai/promptTemplates.ts", "utf8");
  const promptBuilders = await readFile("src/lib/ai/buildPrompts.ts", "utf8");
  const tools = await readFile("src/lib/ai/tools.ts", "utf8");
  const schemas = await readFile("src/lib/ai/schemas.ts", "utf8");

  assert.match(templates, /不自称心理医生/);
  assert.match(templates, /自伤/);
  assert.match(templates, /不要编造不存在的歌曲/);
  assert.match(promptBuilders, /只能从上面的候选列表中选择/);
  assert.match(promptBuilders, /searchLanguage": "zh-CN \| en \| ja \| ko \| yue \| any"/);
  assert.match(tools, /"ko"/);
  assert.match(schemas, /"yue"/);
});

test("playback queue prefetches when two or fewer candidates remain", async () => {
  const windowComponent = await readFile("src/components/music-agent/MusicAgentWindow.tsx", "utf8");

  assert.match(windowComponent, /const PREFETCH_QUEUE_THRESHOLD = 2/);
  assert.match(windowComponent, /const \[prefetchedResponse, setPrefetchedResponse\]/);
  assert.match(windowComponent, /requestGenerationRef/);
  assert.match(windowComponent, /recommendationQueue\.length > PREFETCH_QUEUE_THRESHOLD/);
  assert.match(windowComponent, /playPrefetchedResponse/);
});

test("prefetch excludes active queue, prefetched results, and playback history", async () => {
  const windowComponent = await readFile("src/components/music-agent/MusicAgentWindow.tsx", "utf8");

  assert.match(windowComponent, /getPlayedTrackIds\(playHistory\)/);
  assert.match(windowComponent, /getRecommendationIds\(recommendationQueue\)/);
  assert.match(windowComponent, /getRecommendationIds\(getRecommendations\(prefetchedResponse\)\)/);
  assert.match(windowComponent, /\.\.\.historyIds/);
});

test("foreground search can be aborted from the composer", async () => {
  const windowComponent = await readFile("src/components/music-agent/MusicAgentWindow.tsx", "utf8");

  assert.match(windowComponent, /resolveAbortControllerRef/);
  assert.match(windowComponent, /new AbortController\(\)/);
  assert.match(windowComponent, /signal: abortController\.signal/);
  assert.match(windowComponent, /handleAbortResolve/);
  assert.match(windowComponent, />\s*终止\s*</);
});

test("resolver does not clear previousTrackIds when all candidates are filtered", async () => {
  const resolver = await readFile("src/lib/agent/resolveMusic.ts", "utf8");

  assert.equal(/rankTracks\([^)]*,\s*\[\]/s.test(resolver), false);
  assert.match(resolver, /没有返回新的可播放候选/);
});

test("prefetched candidate list is rendered in tool status", async () => {
  const windowComponent = await readFile("src/components/music-agent/MusicAgentWindow.tsx", "utf8");

  assert.match(windowComponent, /prefetchedCandidates/);
  assert.match(windowComponent, /PREFETCH_PREVIEW_LIMIT/);
  assert.match(windowComponent, /prefetchedCandidates\.map/);
  assert.match(windowComponent, /下一首会从这些候选里继续/);
});

test("explicit Korean requests are preserved in the natural QQ search query", async () => {
  const qqMusic = await readFile("src/lib/music/qqmusic.ts", "utf8");
  const resolver = await readFile("src/lib/agent/resolveMusic.ts", "utf8");
  const promptBuilders = await readFile("src/lib/ai/buildPrompts.ts", "utf8");
  const tools = await readFile("src/lib/ai/tools.ts", "utf8");

  assert.match(qqMusic, /moodProfile\.searchQuery/);
  assert.match(qqMusic, /if \(directQuery\) return directQuery/);
  assert.match(resolver, /searchQuery: String\(args\.searchStrategy\.query/);
  assert.match(promptBuilders, /searchQuery 应该直接包含"韩语"或"韩文"/);
  assert.match(tools, /直接给 QQ 音乐搜索框使用的短搜索词/);
  assert.doesNotMatch(resolver, /applyExplicitLanguageConstraints/);
});
