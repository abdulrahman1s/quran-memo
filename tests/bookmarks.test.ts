import { describe, expect, test } from "bun:test";
import {
  parseBookmarks,
  parseReadingProgress,
  toggleBookmark,
  type Bookmark,
} from "../src/web/bookmarks.ts";

const surah: Bookmark = {
  id: "surah:2",
  type: "surah",
  chapterId: 2,
  chapterNameSimple: "Al-Baqarah",
  chapterNameArabic: "البقرة",
  createdAt: 10,
};
const ayah: Bookmark = {
  id: "ayah:2:255",
  type: "ayah",
  chapterId: 2,
  chapterNameSimple: "Al-Baqarah",
  chapterNameArabic: "البقرة",
  verseKey: "2:255",
  pageNumber: 42,
  arabic: "الله لا إله إلا هو",
  createdAt: 20,
};

describe("local bookmarks", () => {
  test("validates, deduplicates, and orders stored bookmarks", () => {
    expect(
      parseBookmarks(
        JSON.stringify([
          surah,
          ayah,
          { ...surah },
          { ...ayah, id: "ayah:wrong" },
          { type: "page", pageNumber: 900 },
        ]),
      ),
    ).toEqual([ayah, surah]);
    expect(parseBookmarks("not-json")).toEqual([]);
    expect(parseBookmarks(JSON.stringify({}))).toEqual([]);
  });

  test("toggles a stable bookmark without duplicates", () => {
    const added = toggleBookmark([], surah);
    expect(added.saved).toBe(true);
    expect(added.bookmarks).toEqual([surah]);
    const removed = toggleBookmark(added.bookmarks, {
      ...surah,
      createdAt: 99,
    });
    expect(removed.saved).toBe(false);
    expect(removed.bookmarks).toEqual([]);
  });

  test("restores exact reading progress and migrates legacy chapters", () => {
    expect(
      parseReadingProgress(JSON.stringify({ chapterId: 36, pageNumber: 444 })),
    ).toEqual({ chapterId: 36, pageNumber: 444 });
    expect(
      parseReadingProgress(JSON.stringify({ chapterId: 36, pageNumber: 900 })),
    ).toEqual({ chapterId: 36, pageNumber: undefined });
    expect(parseReadingProgress("broken", 55)).toEqual({ chapterId: 55 });
    expect(parseReadingProgress("broken", 0)).toBeUndefined();
  });
});
