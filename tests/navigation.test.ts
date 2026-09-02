import { describe, expect, test } from "bun:test";
import {
  mainTabFromUrl,
  readingChapterFromUrl,
  readingTargetFromUrl,
  shouldRenderPlayer,
  urlForMainTab,
  urlForReadingChapter,
  urlForReadingTarget,
} from "../src/web/navigation.ts";

describe("main tab navigation", () => {
  test("only keeps the player visible on the Practice tab", () => {
    expect(shouldRenderPlayer("practice", 1)).toBe(true);
    expect(shouldRenderPlayer("practice", 0)).toBe(false);
    expect(shouldRenderPlayer("reading", 1)).toBe(false);
    expect(shouldRenderPlayer("bookmarks", 1)).toBe(false);
    expect(shouldRenderPlayer("downloads", 1)).toBe(false);
    expect(shouldRenderPlayer("settings", 1)).toBe(false);
  });

  test("defaults unknown and absent views to practice", () => {
    expect(mainTabFromUrl(new URL("https://example.com/?surahs=1"))).toBe(
      "practice",
    );
    expect(mainTabFromUrl(new URL("https://example.com/?view=unknown"))).toBe(
      "practice",
    );
  });

  test("restores reading, bookmarks, downloads, and settings views", () => {
    expect(mainTabFromUrl(new URL("https://example.com/?view=reading"))).toBe(
      "reading",
    );
    expect(mainTabFromUrl(new URL("https://example.com/?view=bookmarks"))).toBe(
      "bookmarks",
    );
    expect(mainTabFromUrl(new URL("https://example.com/?view=downloads"))).toBe(
      "downloads",
    );
    expect(mainTabFromUrl(new URL("https://example.com/?view=settings"))).toBe(
      "settings",
    );
  });

  test("changes only the view parameter", () => {
    const downloads = urlForMainTab(
      "https://example.com/?surahs=1%2C2&lang=ar",
      "downloads",
    );
    expect(downloads.searchParams.get("view")).toBe("downloads");
    expect(downloads.searchParams.get("surahs")).toBe("1,2");
    expect(downloads.searchParams.get("lang")).toBe("ar");

    const practice = urlForMainTab(downloads, "practice");
    expect(practice.searchParams.has("view")).toBe(false);
    expect(practice.searchParams.get("surahs")).toBe("1,2");
  });

  test("validates and updates deep-linked reading chapters", () => {
    expect(
      readingChapterFromUrl(
        new URL("https://example.com/?view=reading&chapter=36"),
      ),
    ).toBe(36);
    expect(
      readingChapterFromUrl(new URL("https://example.com/?chapter=0"), 7),
    ).toBe(7);
    expect(
      readingChapterFromUrl(new URL("https://example.com/?chapter=115"), 7),
    ).toBe(7);

    const reading = urlForReadingChapter(
      "https://example.com/?lang=ar&surahs=1%2C2",
      55,
    );
    expect(reading.searchParams.get("view")).toBe("reading");
    expect(reading.searchParams.get("chapter")).toBe("55");
    expect(reading.searchParams.get("lang")).toBe("ar");
    expect(reading.searchParams.get("surahs")).toBe("1,2");

    expect(
      readingTargetFromUrl(
        new URL(
          "https://example.com/?view=reading&chapter=2&page=42&ayah=2:255",
        ),
      ),
    ).toEqual({ chapterId: 2, pageNumber: 42, verseKey: "2:255" });
    expect(
      readingTargetFromUrl(
        new URL(
          "https://example.com/?view=reading&chapter=2&page=900&ayah=3:1",
        ),
      ),
    ).toEqual({ chapterId: 2, pageNumber: undefined, verseKey: undefined });
    expect(
      readingTargetFromUrl(new URL("https://example.com/?view=reading")),
    ).toBeUndefined();

    const target = urlForReadingTarget("https://example.com/?lang=ar", {
      chapterId: 2,
      pageNumber: 42,
      verseKey: "2:255",
    });
    expect(target.searchParams.get("chapter")).toBe("2");
    expect(target.searchParams.get("page")).toBe("42");
    expect(target.searchParams.get("ayah")).toBe("2:255");

    const library = urlForMainTab(target, "reading");
    expect(library.searchParams.get("view")).toBe("reading");
    expect(library.searchParams.has("chapter")).toBe(false);
    expect(library.searchParams.has("page")).toBe(false);
    expect(library.searchParams.has("ayah")).toBe(false);
  });
});
