import { expect, test } from "bun:test";
import { activeWordPosition, DEFAULT_HIGHLIGHT_DELAY_MS } from "../src/web/timing.ts";

const timings = [
  { position: 1, startMs: 300, endMs: 900 },
  { position: 2, startMs: 910, endMs: 1_500 },
];

test("word highlighting is delayed so it does not anticipate the reciter", () => {
  expect(DEFAULT_HIGHLIGHT_DELAY_MS).toBe(250);
  expect(activeWordPosition(timings, 300)).toBeNull();
  expect(activeWordPosition(timings, 550)).toBe(1);
  expect(activeWordPosition(timings, 1_160)).toBe(2);
});
