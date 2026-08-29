import { describe, expect, test } from "bun:test";
import { memorizationWords } from "../src/web/memorization.ts";

const words = [
  { position: 1, text: "إِنَّا" }, { position: 2, text: "أَعْطَيْنَاكَ" },
  { position: 3, text: "الْكَوْثَرَ" }, { position: 4, text: "فَصَلِّ" },
];

describe("memorization display", () => {
  test("shows only the opening cue", () => expect(memorizationWords(words, "first-words")).toEqual(words.slice(0, 3)));
  test("reduces every word to its first glyph", () => expect(memorizationWords(words, "initials").map((w) => w.text)).toEqual(["إ", "أ", "ا", "ف"]));
  test("can hide the ayah", () => expect(memorizationWords(words, "hidden")).toEqual([]));
});
