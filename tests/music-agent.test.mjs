import { readFile } from "node:fs/promises";
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
    { id: "track_rejected", source: "direct", title: "calm rejected", audioUrl: "https://example.com/a.mp3" },
    { id: "track_liked", source: "direct", title: "plain liked", audioUrl: "https://example.com/b.mp3" },
    { id: "track_neutral", source: "direct", title: "calm neutral", audioUrl: "https://example.com/c.mp3" },
  ];
  const feedbackMemory = [
    {
      trackId: "track_rejected",
      source: "direct",
      feedback: "not_fit",
      originalText: "calm",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      trackId: "track_liked",
      source: "direct",
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
