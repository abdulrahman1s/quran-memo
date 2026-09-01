export const DEFAULT_AUTO_SCROLL_LEVEL = 8;
export const MOBILE_AUTO_SCROLL_MULTIPLIER = 3.5;

const arabicIndicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function quranNumber(value: number): string {
  return String(Math.max(0, Math.trunc(value))).replace(
    /\d/g,
    (digit) => arabicIndicDigits[Number(digit)] ?? digit,
  );
}

export function normalizedAutoScrollLevel(value: unknown): number {
  const level = Number(value);
  return Number.isFinite(level)
    ? Math.min(10, Math.max(1, Math.round(level)))
    : DEFAULT_AUTO_SCROLL_LEVEL;
}

export function autoScrollPixelsPerSecond(
  level: unknown,
  mobile = false,
): number {
  const baseSpeed = normalizedAutoScrollLevel(level) * 12;
  return baseSpeed * (mobile ? MOBILE_AUTO_SCROLL_MULTIPLIER : 1);
}

export function reachedScrollEnd(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
  tolerance = 1,
): boolean {
  return scrollY + viewportHeight >= documentHeight - tolerance;
}

export interface ReadingPage<T> {
  pageNumber: number;
  verses: T[];
}

export function groupReadingPages<T extends { pageNumber: number }>(
  verses: readonly T[],
): ReadingPage<T>[] {
  const pages = new Map<number, T[]>();
  for (const verse of verses) {
    const page = pages.get(verse.pageNumber) ?? [];
    page.push(verse);
    pages.set(verse.pageNumber, page);
  }
  return [...pages].map(([pageNumber, pageVerses]) => ({
    pageNumber,
    verses: pageVerses,
  }));
}

export function readingPageIndexForVerse<
  T extends { verseKey: string; pageNumber: number },
>(pages: readonly ReadingPage<T>[], verseKey: string): number {
  return pages.findIndex((page) =>
    page.verses.some((verse) => verse.verseKey === verseKey),
  );
}
