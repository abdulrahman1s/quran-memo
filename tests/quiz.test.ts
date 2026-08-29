import { describe, expect, test } from "bun:test";
import { accuracy, buildQuizChoices, shuffled, type QuizChoice } from "../src/web/quiz.ts";

const pool: QuizChoice[] = [
  { verseKey: "108:1", arabic: "one" },
  { verseKey: "108:2", arabic: "two" },
  { verseKey: "108:3", arabic: "three" },
  { verseKey: "112:1", arabic: "four" },
  { verseKey: "112:2", arabic: "five" },
];

describe("quiz choices", () => {
  test("returns the correct ayah and three unique distractors", () => {
    const choices = buildQuizChoices(pool[1]!, pool, () => 0.4);
    expect(choices).toHaveLength(4);
    expect(new Set(choices.map((choice) => choice.verseKey)).size).toBe(4);
    expect(choices.some((choice) => choice.verseKey === "108:2")).toBe(true);
  });

  test("rejects a pool that cannot make four choices", () => {
    expect(() => buildQuizChoices(pool[0]!, pool.slice(0, 3))).toThrow("four unique ayahs");
  });

  test("supports deterministic shuffling and accuracy", () => {
    expect(shuffled([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
    expect(accuracy(7, 9)).toBe(78);
    expect(accuracy(0, 0)).toBe(100);
  });
});
