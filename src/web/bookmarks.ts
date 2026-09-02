export const BOOKMARKS_KEY = "quran-memo-bookmarks-v1";
export const READING_PROGRESS_KEY = "quran-memo-reading-progress-v1";

interface BookmarkBase {
  id: string;
  chapterId: number;
  chapterNameSimple: string;
  chapterNameArabic: string;
  createdAt: number;
}

export interface SurahBookmark extends BookmarkBase {
  type: "surah";
}

export interface PageBookmark extends BookmarkBase {
  type: "page";
  pageNumber: number;
}

export interface AyahBookmark extends BookmarkBase {
  type: "ayah";
  verseKey: string;
  pageNumber: number;
  arabic: string;
}

export type Bookmark = SurahBookmark | PageBookmark | AyahBookmark;

export interface ReadingProgress {
  chapterId: number;
  pageNumber?: number;
}

const validChapter = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 114;
const validPage = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 604;

export function bookmarkId(
  bookmark: Pick<Bookmark, "type" | "chapterId"> &
    Partial<Pick<PageBookmark, "pageNumber">> &
    Partial<Pick<AyahBookmark, "verseKey">>,
): string {
  if (bookmark.type === "surah") return `surah:${bookmark.chapterId}`;
  if (bookmark.type === "page") return `page:${bookmark.pageNumber}`;
  return `ayah:${bookmark.verseKey}`;
}

function validBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (
    !validChapter(item.chapterId) ||
    typeof item.chapterNameSimple !== "string" ||
    typeof item.chapterNameArabic !== "string" ||
    typeof item.createdAt !== "number" ||
    !Number.isFinite(item.createdAt) ||
    (item.type !== "surah" && item.type !== "page" && item.type !== "ayah")
  )
    return false;
  if (item.type === "page" && !validPage(item.pageNumber)) return false;
  if (
    item.type === "ayah" &&
    (!validPage(item.pageNumber) ||
      typeof item.verseKey !== "string" ||
      !new RegExp(`^${item.chapterId}:[1-9]\\d*$`).test(item.verseKey) ||
      typeof item.arabic !== "string")
  )
    return false;
  return item.id === bookmarkId(item as unknown as Bookmark);
}

export function parseBookmarks(raw: string | null): Bookmark[] {
  try {
    const value = JSON.parse(raw ?? "");
    if (!Array.isArray(value)) return [];
    const unique = new Map<string, Bookmark>();
    for (const item of value) {
      if (!validBookmark(item) || unique.has(item.id)) continue;
      unique.set(item.id, item);
    }
    return [...unique.values()].sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function toggleBookmark(
  bookmarks: Bookmark[],
  bookmark: Bookmark,
): { bookmarks: Bookmark[]; saved: boolean } {
  const exists = bookmarks.some((item) => item.id === bookmark.id);
  return {
    saved: !exists,
    bookmarks: exists
      ? bookmarks.filter((item) => item.id !== bookmark.id)
      : [bookmark, ...bookmarks],
  };
}

export function parseReadingProgress(
  raw: string | null,
  legacyChapter?: number,
): ReadingProgress | undefined {
  try {
    const value = JSON.parse(raw ?? "") as Record<string, unknown>;
    if (validChapter(value.chapterId))
      return {
        chapterId: value.chapterId,
        pageNumber: validPage(value.pageNumber) ? value.pageNumber : undefined,
      };
  } catch {
    /* Fall through to the legacy chapter-only value. */
  }
  return validChapter(legacyChapter) ? { chapterId: legacyChapter } : undefined;
}
