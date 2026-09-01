import { expect, test } from "bun:test";
import {
  activeWordPosition,
  DEFAULT_HIGHLIGHT_DELAY_MS,
  wordPlaybackSegment,
  wordStartSeconds,
} from "../src/web/timing.ts";

const timings = [
  { position: 1, startMs: 300, endMs: 900 },
  { position: 2, startMs: 910, endMs: 1_500 },
];

test("word highlighting is delayed so it does not anticipate the reciter", () => {
  expect(DEFAULT_HIGHLIGHT_DELAY_MS).toBe(250);
  expect(activeWordPosition(timings, 300)).toBeNull();
  expect(activeWordPosition(timings, 550)).toBe(1);
  expect(activeWordPosition(timings, 1_160)).toBe(2);
  expect(activeWordPosition(timings, 2_000)).toBeNull();
});

test("word playback seeks to the exact API timestamp", () => {
  expect(wordStartSeconds(timings, 1)).toBe(0.3);
  expect(wordStartSeconds(timings, 2)).toBe(0.91);
  expect(wordStartSeconds(timings, 3)).toBeNull();
  expect(wordPlaybackSegment(timings, 2)).toEqual({
    startSeconds: 0.91,
    endSeconds: 1.5,
  });
  expect(wordPlaybackSegment(timings, 3)).toBeNull();
});
