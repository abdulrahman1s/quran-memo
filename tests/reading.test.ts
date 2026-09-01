import { describe, expect, test } from "bun:test";
import {
  autoScrollPixelsPerSecond,
  DEFAULT_AUTO_SCROLL_LEVEL,
  groupReadingPages,
  MOBILE_AUTO_SCROLL_MULTIPLIER,
  normalizedAutoScrollLevel,
  quranNumber,
  readingPageIndexForVerse,
  reachedScrollEnd,
} from "../src/web/reading.ts";

describe("reading auto-scroll", () => {
  test("normalizes the persisted speed and maps it to pixels per second", () => {
    expect(DEFAULT_AUTO_SCROLL_LEVEL).toBe(8);
    expect(normalizedAutoScrollLevel(undefined)).toBe(
      DEFAULT_AUTO_SCROLL_LEVEL,
    );
    expect(normalizedAutoScrollLevel(0)).toBe(1);
    expect(normalizedAutoScrollLevel(11)).toBe(10);
    expect(normalizedAutoScrollLevel(4.6)).toBe(5);
    expect(autoScrollPixelsPerSecond(1)).toBe(12);
    expect(autoScrollPixelsPerSecond(10)).toBe(120);
    expect(MOBILE_AUTO_SCROLL_MULTIPLIER).toBe(3.5);
    expect(autoScrollPixelsPerSecond(8, true)).toBe(336);
  });

  test("detects when the bottom of the reading document reaches the viewport", () => {
    expect(reachedScrollEnd(500, 700, 1_201)).toBe(true);
    expect(reachedScrollEnd(499, 700, 1_201)).toBe(false);
  });

  test("groups verses by their Mushaf page boundaries", () => {
    const verses = [
      { verseKey: "2:1", pageNumber: 2 },
      { verseKey: "2:2", pageNumber: 2 },
      { verseKey: "2:3", pageNumber: 3 },
    ];
    expect(groupReadingPages(verses)).toEqual([
      { pageNumber: 2, verses: verses.slice(0, 2) },
      { pageNumber: 3, verses: verses.slice(2) },
    ]);
    expect(readingPageIndexForVerse(groupReadingPages(verses), "2:3")).toBe(
      1,
    );
    expect(
      readingPageIndexForVerse(groupReadingPages(verses), "2:99"),
    ).toBe(-1);
  });

  test("uses Arabic-Indic numerals inside the Mushaf", () => {
    expect(quranNumber(1)).toBe("١");
    expect(quranNumber(286)).toBe("٢٨٦");
  });
});
