import { describe, expect, test } from "bun:test";
import { batchChapters } from "../src/web/batching.ts";

describe("Worker session batching", () => {
  test("keeps Quran API pagination below the per-request budget", () => {
    const chapters = [
      { id: 1, versesCount: 7 },
      { id: 2, versesCount: 286 },
      { id: 3, versesCount: 200 },
      { id: 4, versesCount: 176 },
      { id: 5, versesCount: 120 },
    ];
    const batches = batchChapters(chapters, 10);

    expect(batches.flat().map((chapter) => chapter.id)).toEqual([1, 2, 3, 4, 5]);
    for (const batch of batches) {
      const pages = batch.reduce((total, chapter) => total + Math.ceil(chapter.versesCount / 50), 0);
      expect(pages).toBeLessThanOrEqual(10);
    }
  });

  test("returns no batches for an empty selection", () => {
    expect(batchChapters([])).toEqual([]);
  });
});
