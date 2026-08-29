import { describe, expect, test } from "bun:test";
import { quizStepAfterAudio } from "../src/web/session.ts";

describe("quiz playback progression", () => {
  test("asks a question while another ayah remains", () => {
    expect(quizStepAfterAudio(0, 0, 3, 1)).toEqual({
      action: "question",
      surahIndex: 0,
      verseIndex: 0,
    });
  });

  test("moves to the next surah without exceeding its bounds", () => {
    expect(quizStepAfterAudio(0, 2, 3, 2)).toEqual({
      action: "next-surah",
      surahIndex: 1,
      verseIndex: 0,
    });
  });

  test("finishes on the final valid verse instead of advancing past the session", () => {
    expect(quizStepAfterAudio(1, 5, 6, 2)).toEqual({
      action: "finish",
      surahIndex: 1,
      verseIndex: 5,
    });
  });
});
