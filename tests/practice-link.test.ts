import { describe, expect, test } from "bun:test";
import { decodePracticeLink, encodePracticeLink } from "../src/web/practice-link.ts";

describe("shareable practice links", () => {
  test("round trips all practice settings", () => {
    const config = {
      surahIds: [112, 108, 112], reciterId: 6, ayahRepeats: 3, surahRepeats: 2,
      cycles: "forever" as const, ayahDelay: 2, surahDelay: 5,
      memorization: "initials" as const, language: "ar" as const,
    };
    expect(decodePracticeLink(encodePracticeLink(config))).toEqual({ ...config, surahIds: [108, 112] });
  });

  test("ignores unsafe and unknown values", () => {
    const decoded = decodePracticeLink(new URLSearchParams("surahs=0,1,115&ayahRepeats=-2&memorization=nope"));
    expect(decoded).toEqual({ surahIds: [1], ayahRepeats: 1 });
  });
});
