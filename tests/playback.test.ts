import { describe, expect, test } from "bun:test";
import { MpvPlayer, playSession, type AudioPlayer, type PlaybackProgress } from "../src/playback.ts";
import type { Verse } from "../src/types.ts";

const verses: Verse[] = [
  { verseKey: "1:1", chapterId: 1, arabic: "a", translation: "A", audioUrl: "https://audio/1" },
  { verseKey: "1:2", chapterId: 1, arabic: "b", translation: "B", audioUrl: "https://audio/2" },
];

const secondSurah: Verse[] = [
  { verseKey: "112:1", chapterId: 112, arabic: "c", translation: "C", audioUrl: "https://audio/3" },
];

class FakePlayer implements AudioPlayer {
  calls: string[] = [];
  async play(url: string): Promise<void> {
    this.calls.push(url);
  }
}

describe("playSession", () => {
  test("repeats each complete surah before advancing and repeats the full selection", async () => {
    const player = new FakePlayer();
    const progress: PlaybackProgress[] = [];
    await playSession(
      [verses, secondSurah],
      { ayahRepeats: 1, surahRepeats: 2, cycles: 2, ayahDelaySeconds: 0, delaySeconds: 0 },
      player,
      (item) => progress.push(item),
      new AbortController().signal,
    );

    expect(player.calls).toEqual([
      "https://audio/1", "https://audio/2", "https://audio/1", "https://audio/2", "https://audio/3", "https://audio/3",
      "https://audio/1", "https://audio/2", "https://audio/1", "https://audio/2", "https://audio/3", "https://audio/3",
    ]);
    expect(progress.at(-1)).toMatchObject({ surahRepeat: 2, cycle: 2, surahIndex: 1, verseIndex: 0 });
  });

  test("delays only between repeats of the same surah", async () => {
    const sleeps: number[] = [];
    await playSession(
      [verses, secondSurah],
      { ayahRepeats: 1, surahRepeats: 3, cycles: 1, ayahDelaySeconds: 0, delaySeconds: 1.25 },
      new FakePlayer(),
      () => {},
      new AbortController().signal,
      async (milliseconds) => { sleeps.push(milliseconds); },
    );
    expect(sleeps).toEqual([1250, 1250, 1250, 1250]);
  });

  test("honors cancellation before starting another repeat", async () => {
    const controller = new AbortController();
    const player: AudioPlayer = {
      async play() { controller.abort(new Error("cancelled")); },
    };
    await expect(playSession(
      [verses],
      { ayahRepeats: 1, surahRepeats: 2, cycles: 1, ayahDelaySeconds: 0, delaySeconds: 0 },
      player,
      () => {},
      controller.signal,
    )).rejects.toThrow("cancelled");
  });
});

test("playSession repeats individual ayahs and pauses between them", async () => {
  const player = new FakePlayer();
  const sleeps: number[] = [];
  await playSession(
    [verses],
    { ayahRepeats: 2, surahRepeats: 1, cycles: 1, ayahDelaySeconds: 0.25, delaySeconds: 0 },
    player,
    () => {},
    new AbortController().signal,
    async (milliseconds) => { sleeps.push(milliseconds); },
  );
  expect(player.calls).toEqual(["https://audio/1", "https://audio/1", "https://audio/2", "https://audio/2"]);
  expect(sleeps).toEqual([250, 250, 250]);
});

test("MpvPlayer reports an audio HTTP failure before spawning playback", async () => {
  const player = new MpvPlayer(async () => new Response("missing", { status: 404 }));
  await expect(player.play("https://audio/missing", new AbortController().signal))
    .rejects.toThrow("HTTP 404");
});
