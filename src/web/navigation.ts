export const MAIN_TABS = [
  "practice",
  "reading",
  "downloads",
  "settings",
] as const;

export type MainTab = (typeof MAIN_TABS)[number];

export function mainTabFromUrl(url: URL): MainTab {
  const view = url.searchParams.get("view");
  return view === "reading" || view === "downloads" || view === "settings"
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
  if (tab === "practice") url.searchParams.delete("view");
  else url.searchParams.set("view", tab);
  return url;
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
