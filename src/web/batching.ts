interface ChapterSize {
  versesCount: number;
}

export function batchChapters<T extends ChapterSize>(chapters: T[], maximumPages = 35): T[][] {
  if (!Number.isInteger(maximumPages) || maximumPages < 1) {
    throw new Error("Maximum pages must be a positive integer.");
  }

  const batches: T[][] = [];
  let current: T[] = [];
  let currentPages = 0;

  for (const chapter of chapters) {
    const pages = Math.max(1, Math.ceil(chapter.versesCount / 50));
    if (current.length > 0 && currentPages + pages > maximumPages) {
      batches.push(current);
      current = [];
      currentPages = 0;
    }
    current.push(chapter);
    currentPages += pages;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}
