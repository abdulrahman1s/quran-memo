export const MAIN_TABS = [
  "practice",
  "reading",
  "bookmarks",
  "downloads",
  "settings",
] as const;

export type MainTab = (typeof MAIN_TABS)[number];

export function mainTabFromUrl(url: URL): MainTab {
  const view = url.searchParams.get("view");
  return view === "reading" ||
    view === "bookmarks" ||
    view === "downloads" ||
    view === "settings"
    ? view
    : "practice";
}

export function shouldRenderPlayer(
  tab: MainTab,
  sessionCount: number,
): boolean {
  return tab === "practice" && sessionCount > 0;
}

export function urlForMainTab(currentUrl: string | URL, tab: MainTab): URL {
  const url = new URL(currentUrl.toString());
  url.searchParams.delete("chapter");
  url.searchParams.delete("page");
  url.searchParams.delete("ayah");
  if (tab === "practice") url.searchParams.delete("view");
  else url.searchParams.set("view", tab);
  return url;
}

export interface ReadingTarget {
  chapterId: number;
  pageNumber?: number;
  verseKey?: string;
}

export function readingTargetFromUrl(url: URL): ReadingTarget | undefined {
  const chapterId = Number(url.searchParams.get("chapter"));
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) return;
  const page = Number(url.searchParams.get("page"));
  const verseKey = url.searchParams.get("ayah") ?? undefined;
  return {
    chapterId,
    pageNumber:
      Number.isInteger(page) && page >= 1 && page <= 604 ? page : undefined,
    verseKey:
      verseKey && new RegExp(`^${chapterId}:[1-9]\\d*$`).test(verseKey)
        ? verseKey
        : undefined,
  };
}

export function readingChapterFromUrl(url: URL, fallback = 1): number {
  const chapter = Number(url.searchParams.get("chapter"));
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 114
    ? chapter
    : fallback;
}

export function urlForReadingChapter(
  currentUrl: string | URL,
  chapterId: number,
): URL {
  const url = urlForMainTab(currentUrl, "reading");
  url.searchParams.set(
    "chapter",
    String(Math.min(114, Math.max(1, Math.trunc(chapterId)))),
  );
  return url;
}

export function urlForReadingTarget(
  currentUrl: string | URL,
  target: ReadingTarget,
): URL {
  const url = urlForReadingChapter(currentUrl, target.chapterId);
  if (target.pageNumber)
    url.searchParams.set("page", String(target.pageNumber));
  if (target.verseKey) url.searchParams.set("ayah", target.verseKey);
  return url;
}
