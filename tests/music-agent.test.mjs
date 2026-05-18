import { access, readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

import { rankTracks } from "../src/lib/music/normalize.ts";
import { buildAgentMemoryContext, TARGET_MEMORY_CONTEXT_BYTES } from "../src/lib/storage/agentMemoryContext.ts";

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

test("agent memory context trims local memory into a compact request payload", () => {
  const makeTrack = (index) => ({
    id: `song_${index}`,
    source: "qqmusic",
    title: `A very long remembered song title ${index}`.repeat(3),
    artist: `artist_${index}`,
    audioUrl: "https://example.test/audio.mp3",
    coverUrl: "https://example.test/cover.jpg",
    lyrics: "long lyric should never be sent",
    timedLyrics: [{ time: 1, text: "timed lyric should never be sent" }],
    tags: Array.from({ length: 12 }, (_, tagIndex) => `tag_${index}_${tagIndex}`),
  });
  const makeSignal = (index) => ({
    value: `signal_${index}`,
    weight: 20 - index / 10,
    count: 20 - index,
    updatedAt: "2026-05-18T00:00:00.000Z",
  });
  const playbackLibrary = {
    version: 1,
    played: Array.from({ length: 30 }, (_, index) => ({
      track: makeTrack(index),
      playedAt: `2026-05-18T00:00:${String(index).padStart(2, "0")}.000Z`,
      playCount: index + 1,
    })),
    liked: Array.from({ length: 20 }, (_, index) => ({
      track: makeTrack(index + 100),
      likedAt: `2026-05-17T00:00:${String(index).padStart(2, "0")}.000Z`,
    })),
  };
  const feedbackMemory = Array.from({ length: 20 }, (_, index) => ({
    trackId: `song_${index}`,
    source: "qqmusic",
    feedback: index % 2 === 0 ? "too_loud" : "good_fit",
    originalText: "this original feedback text is intentionally long ".repeat(20),
    createdAt: `2026-05-16T00:00:${String(index).padStart(2, "0")}.000Z`,
  }));
  const userMusicProfile = {
    version: 1,
    preferredGenres: Array.from({ length: 12 }, (_, index) => makeSignal(index)),
    preferredScenes: Array.from({ length: 12 }, (_, index) => makeSignal(index)),
    preferredMoods: Array.from({ length: 12 }, (_, index) => makeSignal(index)),
    likedArtists: Array.from({ length: 12 }, (_, index) => makeSignal(index)),
    avoidedArtists: Array.from({ length: 12 }, (_, index) => makeSignal(index)),
    likedTags: Array.from({ length: 12 }, (_, index) => makeSignal(index)),
    avoidedTags: Array.from({ length: 12 }, (_, index) => makeSignal(index)),
    languagePreference: "zh-CN",
    energyPreference: { low: 2, medium: 4, high: 1 },
    bpmHints: Array.from({ length: 12 }, (_, index) => `${60 + index}-${80 + index}`),
    recentEvents: [],
    updatedAt: "2026-05-18T00:00:00.000Z",
  };

  const context = buildAgentMemoryContext({
    playbackLibrary,
    feedbackMemory,
    userMusicProfile,
    recentConversation: Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "agent",
      content: "conversation content ".repeat(40),
    })),
    now: new Date(2026, 4, 18, 23, 30, 0),
  });
  const serialized = JSON.stringify(context);

  assert.ok(new TextEncoder().encode(serialized).length <= TARGET_MEMORY_CONTEXT_BYTES);
  assert.equal(context.history.recentPlayed.length, 8);
  assert.equal(context.history.likedTracks.length, 8);
  assert.equal(context.history.negativeFeedback.length, 8);
  assert.equal(context.recentConversation.length, 6);
  assert.equal(context.profile.preferredGenres.length, 6);
  assert.equal(context.profile.bpmHints.length, 5);
  assert.equal(context.localTime.hour, 23);
  assert.equal(context.localTime.dayPeriod, "late_night");
  assert.equal(context.localTime.weekday, 1);
  assert.equal(context.localTime.isWeekend, false);
  assert.equal(context.stats.trimmed, true);
  assert.equal(serialized.includes("audioUrl"), false);
  assert.equal(serialized.includes("coverUrl"), false);
  assert.equal(serialized.includes("lyrics"), false);
  assert.equal(serialized.includes("timedLyrics"), false);
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

test("Electron QQ Music login window is not closed by page load failures", async () => {
  const loginProcess = await readFile("electron/qqmusicLogin.cjs", "utf8");

  assert.match(loginProcess, /did-fail-load/);
  assert.match(loginProcess, /loadURL\(QQ_MUSIC_URL, \{ userAgent: DESKTOP_USER_AGENT \}\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(loginProcess, /loadURL\(QQ_MUSIC_URL[\s\S]*catch\(\(\) => finish\(null\)\)/);
});

test("Packaged QQ Music cookie is saved under Electron userData", async () => {
  const mainProcess = await readFile("electron/main.cjs", "utf8");

  assert.match(mainProcess, /app\.getPath\("userData"\)/);
  assert.match(mainProcess, /qqmusic-cookie\.json/);
  assert.match(mainProcess, /QQMUSIC_COOKIE_FILE: getCookieFile\(\)/);
  assert.doesNotMatch(mainProcess, /const COOKIE_FILE = path\.join\(__dirname, "\.\.", "\.qqmusic-cookie"\)/);
});

test("QQ Music server APIs can read the Electron cookie file path", async () => {
  const auth = await readFile("src/lib/music/qqmusicAuth.ts", "utf8");

  assert.match(auth, /process\.env\.QQMUSIC_COOKIE_FILE/);
  assert.match(auth, /dirname\(filePath\)/);
});

test("Packaged Electron app starts a local Next renderer instead of the remote site", async () => {
  const mainProcess = await readFile("electron/main.cjs", "utf8");

  assert.match(mainProcess, /startPackagedRendererServer/);
  assert.match(mainProcess, /ELECTRON_RUN_AS_NODE/);
  assert.match(mainProcess, /127\.0\.0\.1/);
  assert.doesNotMatch(mainProcess, /music\.explainsf\.com/);
});

test("Electron windows use the packaged application icon", async () => {
  const mainProcess = await readFile("electron/main.cjs", "utf8");
  const loginProcess = await readFile("electron/qqmusicLogin.cjs", "utf8");

  assert.match(mainProcess, /icon: getWindowIcon\(\)/);
  assert.match(loginProcess, /icon: getWindowIcon\(\)/);
});

test("Windows packaging patches the executable icon without winCodeSign extraction", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const afterPack = await readFile("scripts/after-pack.cjs", "utf8");

  assert.match(pkg.scripts["dist:win"], /npm run build/);
  assert.match(pkg.scripts["dist:win"], /prepare-standalone/);
  assert.equal(pkg.build.afterPack, "scripts/after-pack.cjs");
  assert.equal(pkg.build.win.icon, "build/icon.ico");
  assert.equal(pkg.build.win.signAndEditExecutable, false);
  assert.ok(pkg.build.files.includes(".next/standalone/**/*"));
  assert.ok(pkg.build.asarUnpack.includes(".next/standalone/**/*"));
  assert.match(afterPack, /rcedit\.exe/);
  assert.match(afterPack, /--set-icon/);
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

test("agent prompts include compact memory context and time-aware rules", async () => {
  const templates = await readFile("src/lib/ai/promptTemplates.ts", "utf8");
  const promptBuilders = await readFile("src/lib/ai/buildPrompts.ts", "utf8");
  const resolver = await readFile("src/lib/agent/resolveMusic.ts", "utf8");

  assert.match(templates, /当前用户明确需求永远优先于本地时间和长期记忆/);
  assert.match(templates, /最多自然提到 1 首历史歌/);
  assert.match(promptBuilders, /用户记忆上下文 JSON/);
  assert.match(promptBuilders, /本地时间 JSON/);
  assert.match(promptBuilders, /buildToolAnalysisPrompt/);
  assert.match(resolver, /buildToolAnalysisPrompt\(text, memoryContext\)/);
  assert.match(resolver, /body\.memoryContext/);
});

test("agent requests use compact memory context and export includes the compact snapshot", async () => {
  const windowComponent = await readFile("src/components/music-agent/MusicAgentWindow.tsx", "utf8");
  const requestBodies = [...windowComponent.matchAll(/body: JSON\.stringify\(\{([\s\S]*?)\}\),/g)]
    .map((match) => match[1])
    .filter((body) => body.includes("previousTrackIds"));

  assert.match(windowComponent, /buildAgentMemoryContext/);
  assert.match(windowComponent, /memoryContext,/);
  assert.match(windowComponent, /compactMemoryContext/);
  assert.equal(requestBodies.length >= 2, true);
  for (const body of requestBodies) {
    assert.match(body, /memoryContext/);
    assert.doesNotMatch(body, /feedbackMemory/);
    assert.doesNotMatch(body, /userMusicProfile/);
    assert.doesNotMatch(body, /recentConversation/);
  }
});

test("clear memory keeps liked tracks while clearing recommendation memory", async () => {
  const windowComponent = await readFile("src/components/music-agent/MusicAgentWindow.tsx", "utf8");
  const feedbackMemory = await readFile("src/lib/storage/feedbackMemory.ts", "utf8");
  const userMusicProfile = await readFile("src/lib/storage/userMusicProfile.ts", "utf8");

  assert.match(windowComponent, /handleClearMemory/);
  assert.match(windowComponent, /clearFeedbackMemory\(\)/);
  assert.match(windowComponent, /clearUserMusicProfile\(\)/);
  assert.match(windowComponent, /clearPlayedHistory\(\)/);
  assert.match(windowComponent, /setLikedTracks\(library\.liked\)/);
  assert.match(windowComponent, /清空记忆/);
  assert.match(feedbackMemory, /export function clearFeedbackMemory/);
  assert.match(userMusicProfile, /export function clearUserMusicProfile/);
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
