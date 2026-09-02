import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import { render } from "solid-js/web";
import { accuracy, buildQuizChoices, type QuizChoice } from "./quiz.ts";
import { batchChapters } from "./batching.ts";
import { memorizationWords } from "./memorization.ts";
import {
  decodePracticeLink,
  encodePracticeLink,
  type MemorizationLevel,
} from "./practice-link.ts";
import {
  activeWordPosition,
  wordPlaybackSegment,
  wordStartSeconds,
} from "./timing.ts";
import {
  autoScrollPixelsPerSecond,
  DEFAULT_AUTO_SCROLL_LEVEL,
  normalizedAutoScrollLevel,
  reachedScrollEnd,
} from "./reading.ts";
import {
  mainTabFromUrl,
  readingChapterFromUrl,
  readingTargetFromUrl,
  shouldRenderPlayer,
  urlForMainTab,
  urlForReadingTarget,
  type MainTab,
  type ReadingTarget,
} from "./navigation.ts";
import { translate, type Language, type MessageKey } from "./i18n.ts";
import type {
  ArabicWordMeaningPayload,
  CatalogPayload,
  Chapter,
  ReadingPayload,
  Reciter,
  SessionGroup,
  SessionPayload,
  TafsirResource,
  Verse,
} from "./web-types.ts";
import {
  CustomSelect,
  Field as UIField,
  Header,
  Hero as UIHero,
  Icon,
  MobileNavigation,
  PanelHeading as UIPanelHeading,
  RepeatControl,
  Stat as UIStat,
  SurahList as UISurahList,
  styles,
} from "./components/ui.tsx";
import { ReciterPicker } from "./components/reciter-picker.tsx";
import { EmptyState, SkeletonLines } from "./components/feedback.tsx";
import {
  SettingsView,
  type ArabicFont,
  type ReaderPreferences as Preferences,
} from "./features/settings-view.tsx";
import { ReadingView } from "./features/reading-view.tsx";
import { ReadingLibraryView } from "./features/reading-library-view.tsx";
import { BookmarksView } from "./features/bookmarks-view.tsx";
import { PracticeView as PracticeFeatureView } from "./features/practice-view.tsx";
import { prioritizeTajweedRules, tajweedRuleCopy } from "./tajweed.ts";
import { PlayerMasthead } from "./features/player-masthead.tsx";
import { QuizPanel } from "./features/quiz-panel.tsx";
import {
  BOOKMARKS_KEY,
  READING_PROGRESS_KEY,
  parseBookmarks,
  parseReadingProgress,
  toggleBookmark,
  type Bookmark,
} from "./bookmarks.ts";

const LANGUAGE_KEY = "quran-memo-language-override-v1";
const READER_KEY = "quran-memo-reader-preferences-v1";
const READING_KEY = "quran-memo-reading-chapter-v1";
const OFFLINE_CACHE = "quran-memo-offline-audio-v1";
const OFFLINE_MANIFEST_KEY = "quran-memo-offline-downloads-v1";
const OFFLINE_PRESENT_KEY = "quran-memo-offline-cache-present";
const OFFLINE_BYTES_KEY = "quran-memo-offline-cache-bytes";

interface OfflineDownload {
  chapterId: number;
  reciterId: number;
  audioUrls: string[];
  downloadedAt: number;
  bytes?: number;
}
type OfflineManifest = Record<string, OfflineDownload>;

const defaultPreferences: Preferences = {
  uiScale: 100,
  arabicFont: "scheherazade",
  tafsirFont: "noto",
  wordHighlightStyle: "color",
  ayahScale: 100,
  tafsirFontSize: 15,
  playbackSpeed: 100,
  autoScrollLevel: DEFAULT_AUTO_SCROLL_LEVEL,
};
const { field, panel, button, primary, eyebrow } = styles;

function bounded(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(
      data.error || `Request failed with HTTP ${response.status}`,
    );
  return data;
}

export function App() {
  const params = new URLSearchParams(location.search);
  const shared = decodePracticeLink(params);
  const deviceLanguage: Language = (
    navigator.languages[0] ?? navigator.language
  )
    .toLowerCase()
    .startsWith("ar")
    ? "ar"
    : "en";
  const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
  const initialLanguage =
    shared.language ??
    (storedLanguage === "ar" || storedLanguage === "en"
      ? storedLanguage
      : deviceLanguage);
  const [language, setLanguage] = createSignal<Language>(initialLanguage);
  const tr = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(language(), key, values);
  const [tab, setTab] = createSignal<MainTab>(
    mainTabFromUrl(new URL(location.href)),
  );
  const [catalog, setCatalog] = createSignal<CatalogPayload>();
  const [catalogError, setCatalogError] = createSignal(false);
  const [selected, setSelected] = createSignal(new Set(shared.surahIds ?? []));
  const [search, setSearch] = createSignal("");
  const [reciterId, setReciterId] = createSignal(shared.reciterId ?? 6);
  const [ayahRepeats, setAyahRepeats] = createSignal(shared.ayahRepeats ?? 1);
  const [surahRepeats, setSurahRepeats] = createSignal(
    shared.surahRepeats ?? 3,
  );
  const [cycles, setCycles] = createSignal<number | "forever">(
    shared.cycles ?? 1,
  );
  const [ayahDelay, setAyahDelay] = createSignal(shared.ayahDelay ?? 0);
  const [surahDelay, setSurahDelay] = createSignal(shared.surahDelay ?? 0);
  const [memorization, setMemorization] = createSignal<MemorizationLevel>(
    shared.memorization ?? "full",
  );
  const [toast, setToast] = createSignal<{ text: string; error: boolean }>();
  const [toastExiting, setToastExiting] = createSignal(false);
  let toastTimer: number | undefined;
  let toastExitTimer: number | undefined;

  const initialReadingTarget = readingTargetFromUrl(new URL(location.href));
  const storedReading = Number(localStorage.getItem(READING_KEY));
  const [readingProgress, setReadingProgress] = createSignal(
    parseReadingProgress(
      localStorage.getItem(READING_PROGRESS_KEY),
      storedReading,
    ),
  );
  const [readingTarget, setReadingTarget] = createSignal<
    ReadingTarget | undefined
  >(initialReadingTarget);
  const [readingLibrary, setReadingLibrary] = createSignal(
    tab() === "reading" && !initialReadingTarget,
  );
  const [readingChapter, setReadingChapter] = createSignal(
    initialReadingTarget?.chapterId ??
      readingProgress()?.chapterId ??
      readingChapterFromUrl(new URL(location.href), 1),
  );
  const [bookmarks, setBookmarks] = createSignal(
    parseBookmarks(localStorage.getItem(BOOKMARKS_KEY)),
  );
  const [reading, setReading] = createSignal<ReadingPayload>();
  const [readingLoading, setReadingLoading] = createSignal(false);
  const [readingError, setReadingError] = createSignal(false);
  const [readingWord, setReadingWord] = createSignal<string>();
  const [readingInsight, setReadingInsight] = createSignal<{
    word: ReadingPayload["verses"][number]["words"][number];
    verseKey: string;
  }>();
  const [readingInsightScope, setReadingInsightScope] = createSignal<
    "word" | "ayah"
  >("word");
  const [readingInsightAyahExpanded, setReadingInsightAyahExpanded] =
    createSignal(false);
  const [readingInsightTafsir, setReadingInsightTafsir] = createSignal("");
  const [readingInsightLoading, setReadingInsightLoading] = createSignal(false);
  const [readingInsightWordMeaning, setReadingInsightWordMeaning] =
    createSignal<ArabicWordMeaningPayload>();
  const [readingInsightWordLoading, setReadingInsightWordLoading] =
    createSignal(false);
  const [readingInsightAyahTruncated, setReadingInsightAyahTruncated] =
    createSignal(false);
  const [mushafAudioVisible, setMushafAudioVisible] = createSignal(false);
  const [mushafPlaying, setMushafPlaying] = createSignal(false);
  const [mushafPlaybackRequested, setMushafPlaybackRequested] =
    createSignal(false);
  const [mushafAyah, setMushafAyah] = createSignal(0);
  const [mushafTime, setMushafTime] = createSignal(0);
  const [mushafDuration, setMushafDuration] = createSignal(0);
  const [mushafSeekWord, setMushafSeekWord] = createSignal<string>();
  const [autoScroll, setAutoScroll] = createSignal(false);
  const [autoScrollDone, setAutoScrollDone] = createSignal(false);
  let scrollFrame: number | undefined;
  let previousScrollTime: number | undefined;

  const rawPreferences = loadJson<Partial<Preferences>>(READER_KEY, {});
  const [preferences, setPreferences] = createSignal<Preferences>({
    uiScale: bounded(rawPreferences.uiScale, 90, 130, 100),
    arabicFont: ["noto", "amiri", "scheherazade", "system"].includes(
      rawPreferences.arabicFont ?? "",
    )
      ? rawPreferences.arabicFont!
      : "scheherazade",
    tafsirFont: ["noto", "amiri", "scheherazade", "system"].includes(
      rawPreferences.tafsirFont ?? "",
    )
      ? rawPreferences.tafsirFont!
      : "noto",
    wordHighlightStyle:
      rawPreferences.wordHighlightStyle === "box" ? "box" : "color",
    ayahScale: bounded(rawPreferences.ayahScale, 75, 150, 100),
    tafsirFontSize: bounded(rawPreferences.tafsirFontSize, 12, 24, 15),
    playbackSpeed: bounded(rawPreferences.playbackSpeed, 50, 200, 100),
    autoScrollLevel: normalizedAutoScrollLevel(rawPreferences.autoScrollLevel),
  });

  const [offlineSelected, setOfflineSelected] = createSignal(new Set<number>());
  const [offlineSearch, setOfflineSearch] = createSignal("");
  const [offlineReciter, setOfflineReciter] = createSignal(reciterId());
  const [offlineManifest, setOfflineManifest] = createSignal(
    loadJson<OfflineManifest>(OFFLINE_MANIFEST_KEY, {}),
  );
  const [offlineBytes, setOfflineBytes] = createSignal(
    Math.max(0, Number(localStorage.getItem(OFFLINE_BYTES_KEY)) || 0),
  );
  const [downloadProgress, setDownloadProgress] = createSignal<{
    current: number;
    total: number;
  }>();

  const [session, setSession] = createSignal<SessionGroup[]>([]);
  const [quizPool, setQuizPool] = createSignal<QuizChoice[]>([]);
  const [mode, setMode] = createSignal<"practice" | "quiz">("practice");
  const [sessionLoading, setSessionLoading] = createSignal(false);
  const [groupIndex, setGroupIndex] = createSignal(0);
  const [verseIndex, setVerseIndex] = createSignal(0);
  const [ayahRepeat, setAyahRepeat] = createSignal(1);
  const [surahRepeat, setSurahRepeat] = createSignal(1);
  const [cycle, setCycle] = createSignal(1);
  const [playing, setPlaying] = createSignal(false);
  const [playbackMessage, setPlaybackMessage] = createSignal("");
  const [currentTime, setCurrentTime] = createSignal(0);
  const [practiceHighlightOverride, setPracticeHighlightOverride] =
    createSignal<number>();
  const [duration, setDuration] = createSignal(0);
  const [quizChoices, setQuizChoices] = createSignal<QuizChoice[]>([]);
  const [quizAnswer, setQuizAnswer] = createSignal<string>();
  const [quizCorrect, setQuizCorrect] = createSignal(0);
  const [quizTotal, setQuizTotal] = createSignal(0);
  const [quizFinished, setQuizFinished] = createSignal(false);
  const [studyTab, setStudyTab] = createSignal<"translation" | "tafsir">(
    initialLanguage === "ar" ? "tafsir" : "translation",
  );
  const [tafsirId, setTafsirId] = createSignal(0);
  const [tafsirText, setTafsirText] = createSignal("");
  const [tafsirLoading, setTafsirLoading] = createSignal(false);
  let audio!: HTMLAudioElement;
  let standbyAudio!: HTMLAudioElement;
  let readingAudio!: HTMLAudioElement;
  let mushafAudio!: HTMLAudioElement;
  let mushafStandbyAudio!: HTMLAudioElement;
  let delayTimer: number | undefined;
  let readingWordTimer: number | undefined;
  let mushafSeekHighlightTimer: number | undefined;
  let mushafPlayRequest = 0;
  let readingWordRequest = 0;
  const unavailableWordAudio = new Set<string>();
  let readingWordPlayback:
    | {
        request: number;
        verse: ReadingPayload["verses"][number];
        position: number;
        fallback: boolean;
        wordAudioUrl?: string;
        endSeconds?: number;
      }
    | undefined;
  let sessionRequest = 0;
  let readingRequest = 0;
  let readingAudioReciterId = reciterId();
  let tafsirRequest = 0;
  let readingInsightRequest = 0;
  let readingInsightWordRequest = 0;

  const chapters = () => catalog()?.chapters ?? [];
  const reciters = () => catalog()?.reciters ?? [];
  const tafsirs = () => catalog()?.tafsirs ?? [];
  const localizedTafsirs = () => {
    const target = language() === "ar" ? "arabic" : "english";
    const matching = tafsirs().filter(
      (item) => item.languageName.toLocaleLowerCase() === target,
    );
    return matching.length ? matching : tafsirs();
  };
  const visibleChapters = createMemo(() =>
    filterChapters(chapters(), search()),
  );
  const offlineVisible = createMemo(() =>
    filterChapters(chapters(), offlineSearch()),
  );
  const currentGroup = () => session()[groupIndex()];
  const currentVerse = () => currentGroup()?.verses[verseIndex()];
  const activeReciter = () =>
    reciters().find((item) => item.id === reciterId());

  function filterChapters(items: Chapter[], value: string): Chapter[] {
    const filter = value.trim().toLocaleLowerCase();
    return items.filter(
      (chapter) =>
        !filter ||
        String(chapter.id).includes(filter) ||
        chapter.nameSimple.toLocaleLowerCase().includes(filter) ||
        chapter.nameArabic.includes(filter),
    );
  }
  function notify(text: string, error = false): void {
    clearTimeout(toastTimer);
    clearTimeout(toastExitTimer);
    setToastExiting(false);
    setToast({ text, error });
    toastTimer = window.setTimeout(() => {
      setToastExiting(true);
      toastExitTimer = window.setTimeout(() => {
        setToast();
        setToastExiting(false);
      }, 250);
    }, 3750);
  }
  function changeLanguage(next: Language, persist = true): void {
    setLanguage(next);
    if (next === "ar") setStudyTab("tafsir");
    const preferred = preferredTafsir(next, tafsirs());
    if (preferred) setTafsirId(preferred.id);
    if (persist) localStorage.setItem(LANGUAGE_KEY, next);
  }
  function preferredTafsir(
    selectedLanguage: Language,
    items: TafsirResource[],
  ): TafsirResource | undefined {
    const languageName = selectedLanguage === "ar" ? "arabic" : "english";
    return (
      items.find(
        (item) => item.languageName.toLocaleLowerCase() === languageName,
      ) ?? items[0]
    );
  }
  function toggleSelection(id: number, offline = false): void {
    const source = offline ? offlineSelected() : selected();
    const next = new Set(source);
    next.has(id) ? next.delete(id) : next.add(id);
    offline ? setOfflineSelected(next) : setSelected(next);
  }
  function selectAllVisible(offline = false): void {
    const items = offline ? offlineVisible() : visibleChapters();
    const source = offline ? offlineSelected() : selected();
    const next = new Set(source);
    const all = items.length > 0 && items.every((item) => next.has(item.id));
    for (const item of items) all ? next.delete(item.id) : next.add(item.id);
    offline ? setOfflineSelected(next) : setSelected(next);
  }
  function offlineKey(
    chapterId: number,
    selectedReciter = reciterId(),
  ): string {
    return `${selectedReciter}:${chapterId}`;
  }
  function isOffline(
    chapterId: number,
    selectedReciter = reciterId(),
  ): boolean {
    return Boolean(offlineManifest()[offlineKey(chapterId, selectedReciter)]);
  }
  function formatBytes(bytes: number): string {
    if (bytes < 1) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
    return `${new Intl.NumberFormat(language(), { maximumFractionDigits: power ? 1 : 0 }).format(bytes / 1024 ** power)} ${units[power]}`;
  }
  function reciterName(item: Reciter): string {
    return language() === "ar" ? item.nameArabic : item.nameEnglish;
  }
  function chapterName(item: Chapter): string {
    return language() === "ar" ? item.nameArabic : item.nameSimple;
  }
  function localNumber(value: number): string {
    return new Intl.NumberFormat(language(), { useGrouping: false }).format(
      value,
    );
  }

  function saveReadingProgress(chapterId: number, pageNumber?: number): void {
    const next = { chapterId, pageNumber };
    setReadingProgress(next);
    localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(next));
    localStorage.setItem(READING_KEY, String(chapterId));
  }

  function commitBookmark(bookmark: Bookmark): void {
    const result = toggleBookmark(bookmarks(), bookmark);
    setBookmarks(result.bookmarks);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(result.bookmarks));
    notify(tr(result.saved ? "bookmarkSaved" : "bookmarkRemoved"));
  }

  function bookmarkBase(chapter: Chapter) {
    return {
      chapterId: chapter.id,
      chapterNameSimple: chapter.nameSimple,
      chapterNameArabic: chapter.nameArabic,
      createdAt: Date.now(),
    };
  }

  function toggleSurahBookmark(): void {
    const chapter = reading()?.chapter;
    if (!chapter) return;
    toggleChapterBookmark(chapter);
  }

  function toggleChapterBookmark(chapter: Chapter): void {
    commitBookmark({
      ...bookmarkBase(chapter),
      type: "surah",
      id: `surah:${chapter.id}`,
    });
  }

  function togglePageBookmark(pageNumber: number): void {
    const chapter = reading()?.chapter;
    if (!chapter) return;
    commitBookmark({
      ...bookmarkBase(chapter),
      type: "page",
      pageNumber,
      id: `page:${pageNumber}`,
    });
  }

  function toggleAyahBookmark(verse: ReadingPayload["verses"][number]): void {
    const chapter = reading()?.chapter;
    if (!chapter) return;
    commitBookmark({
      ...bookmarkBase(chapter),
      type: "ayah",
      verseKey: verse.verseKey,
      pageNumber: verse.pageNumber,
      arabic: verse.arabic,
      id: `ayah:${verse.verseKey}`,
    });
  }

  function removeBookmark(id: string): void {
    const next = bookmarks().filter((item) => item.id !== id);
    setBookmarks(next);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    notify(tr("bookmarkRemoved"));
  }

  async function requestSession(
    ids: number[],
    selectedReciter: number,
  ): Promise<SessionPayload> {
    const requested = chapters().filter((chapter) => ids.includes(chapter.id));
    const parts = await Promise.all(
      batchChapters(requested).map((batch) =>
        getJson<SessionPayload>(
          `/api/session?${new URLSearchParams({ surahs: batch.map((c) => c.id).join(","), reciter: String(selectedReciter) })}`,
        ),
      ),
    );
    return {
      groups: parts.flatMap((part) => part.groups),
      quizPool: [
        ...new Map(
          parts
            .flatMap((part) => part.quizPool)
            .map((choice) => [choice.verseKey, choice]),
        ).values(),
      ],
    };
  }
  function sharedUrl(): string {
    const url = new URL(location.href);
    url.search = encodePracticeLink({
      surahIds: [...selected()],
      reciterId: reciterId(),
      ayahRepeats: ayahRepeats(),
      surahRepeats: surahRepeats(),
      cycles: cycles(),
      ayahDelay: ayahDelay(),
      surahDelay: surahDelay(),
      memorization: memorization(),
      language: language(),
    }).toString();
    return url.toString();
  }
  async function copyLink(): Promise<void> {
    const value = sharedUrl();
    history.replaceState(null, "", value);
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* Clipboard may be unavailable in older installed PWAs. */
    }
    notify(tr("linkCopied"));
  }
  function navigate(
    next: MainTab,
    historyMode: "push" | "replace" | "none" = "push",
  ): void {
    stopPlayback();
    stopReadingWord(true);
    stopMushafAudio(true, true);
    pauseAutoScroll();
    setTab(next);
    if (next === "reading") {
      setReadingLibrary(true);
      setReadingTarget();
    }
    if (historyMode !== "none")
      history[`${historyMode}State`](
        null,
        "",
        urlForMainTab(location.href, next),
      );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openReadingTarget(
    target: ReadingTarget,
    historyMode: "push" | "replace" = "push",
  ): void {
    stopPlayback();
    stopReadingWord(true);
    stopMushafAudio(true, true);
    pauseAutoScroll();
    setTab("reading");
    setReadingLibrary(false);
    setReadingTarget(target);
    history[`${historyMode}State`](
      null,
      "",
      urlForReadingTarget(location.href, target),
    );
    void loadReading(target.chapterId, false, target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showReadingLibrary(): void {
    stopReadingWord(true);
    stopMushafAudio(true, true);
    pauseAutoScroll();
    setReadingLibrary(true);
    setReadingTarget();
    history.pushState(null, "", urlForMainTab(location.href, "reading"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function readingPageChanged(
    pageNumber: number,
    preserveTarget = false,
  ): void {
    saveReadingProgress(readingChapter(), pageNumber);
    const current = readingTarget();
    const target: ReadingTarget = {
      chapterId: readingChapter(),
      pageNumber,
      verseKey: preserveTarget ? current?.verseKey : undefined,
    };
    if (!preserveTarget) setReadingTarget(target);
    history.replaceState(null, "", urlForReadingTarget(location.href, target));
  }
  async function loadReading(
    chapterId: number,
    updateUrl = true,
    target?: ReadingTarget,
  ): Promise<void> {
    const chapter = chapters().find((item) => item.id === chapterId);
    if (!chapter) return;
    const request = ++readingRequest;
    const requestedReciter = reciterId();
    const resolvedTarget =
      target ??
      (readingTarget()?.chapterId === chapterId
        ? readingTarget()!
        : { chapterId });
    setReadingChapter(chapterId);
    setReadingTarget(resolvedTarget);
    setReadingLibrary(false);
    saveReadingProgress(chapterId, resolvedTarget.pageNumber);
    setReadingLoading(true);
    setReadingError(false);
    pauseAutoScroll();
    stopReadingWord();
    stopMushafAudio(true, true);
    setMushafAyah(0);
    setReadingInsight();
    if (updateUrl)
      history.replaceState(
        null,
        "",
        urlForReadingTarget(location.href, resolvedTarget),
      );
    try {
      const payload = await getJson<ReadingPayload>(
        `/api/reading?chapter=${chapterId}&reciter=${requestedReciter}`,
      );
      if (request !== readingRequest || tab() !== "reading") return;
      if (
        payload.chapter.id !== chapterId ||
        payload.verses.length !== chapter.versesCount
      )
        throw new Error("invalid reading payload");
      setReading(payload);
      readingAudioReciterId = requestedReciter;
      setAutoScrollDone(false);
    } catch {
      if (request === readingRequest) setReadingError(true);
    } finally {
      if (request === readingRequest) setReadingLoading(false);
    }
  }
  function scrollStep(timestamp: number): void {
    if (!autoScroll()) return;
    if (mushafAudioVisible() || readingWord()) {
      previousScrollTime = timestamp;
      scrollFrame = requestAnimationFrame(scrollStep);
      return;
    }
    const elapsed =
      previousScrollTime === undefined
        ? 0
        : Math.min(250, timestamp - previousScrollTime);
    previousScrollTime = timestamp;
    const mobileViewport = window.matchMedia("(max-width: 768px)").matches;
    window.scrollBy(
      0,
      (autoScrollPixelsPerSecond(
        preferences().autoScrollLevel,
        mobileViewport,
      ) *
        elapsed) /
        1000,
    );
    if (
      reachedScrollEnd(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      )
    ) {
      pauseAutoScroll();
      setAutoScrollDone(true);
      return;
    }
    scrollFrame = requestAnimationFrame(scrollStep);
  }
  function startAutoScroll(): void {
    document.documentElement.classList.add("auto-scrolling");
    if (autoScrollDone()) {
      window.scrollTo({ top: 0 });
      setAutoScrollDone(false);
    }
    previousScrollTime = undefined;
    setAutoScroll(true);
    scrollFrame = requestAnimationFrame(scrollStep);
  }
  function pauseAutoScroll(): void {
    setAutoScroll(false);
    document.documentElement.classList.remove("auto-scrolling");
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
    scrollFrame = undefined;
  }

  function stopReadingWord(removeSource = false): void {
    readingWordRequest += 1;
    if (readingWordTimer !== undefined) clearTimeout(readingWordTimer);
    readingWordTimer = undefined;
    readingWordPlayback = undefined;
    if (readingAudio) {
      readingAudio.pause();
      if (removeSource) {
        readingAudio.removeAttribute("src");
        readingAudio.load();
      }
    }
    setReadingWord();
  }

  async function waitForReadingMetadata(request: number): Promise<void> {
    if (readingAudio.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        readingAudio.removeEventListener("loadedmetadata", loaded);
        readingAudio.removeEventListener("error", failed);
      };
      const loaded = () => {
        cleanup();
        if (request === readingWordRequest) resolve();
        else reject(new DOMException("Playback was superseded", "AbortError"));
      };
      const failed = () => {
        cleanup();
        reject(readingAudio.error ?? new Error("Audio metadata failed"));
      };
      readingAudio.addEventListener("loadedmetadata", loaded, { once: true });
      readingAudio.addEventListener("error", failed, { once: true });
    });
  }

  async function playReadingWordFallback(
    request: number,
    markUnavailable = false,
  ): Promise<void> {
    const context = readingWordPlayback;
    if (markUnavailable && context?.wordAudioUrl)
      unavailableWordAudio.add(context.wordAudioUrl);
    if (!context || context.request !== request || context.fallback) return;
    const segment = wordPlaybackSegment(
      context.verse.wordTimings,
      context.position,
    );
    if (!segment) {
      stopReadingWord();
      notify(tr("playbackFailed"), true);
      return;
    }
    context.fallback = true;
    context.endSeconds = segment.endSeconds;
    try {
      readingAudio.pause();
      readingAudio.src = context.verse.audioUrl;
      readingAudio.load();
      await waitForReadingMetadata(request);
      if (request !== readingWordRequest) return;
      readingAudio.currentTime = segment.startSeconds;
      readingAudio.playbackRate = preferences().playbackSpeed / 100;
      await readingAudio.play();
      if (request !== readingWordRequest) return;
      const durationMs =
        ((segment.endSeconds - segment.startSeconds) /
          readingAudio.playbackRate) *
        1000;
      readingWordTimer = window.setTimeout(
        () => request === readingWordRequest && stopReadingWord(),
        Math.max(50, durationMs - 35),
      );
    } catch {
      if (request !== readingWordRequest) return;
      stopReadingWord();
      notify(tr("playbackFailed"), true);
    }
  }

  async function playReadingWord(
    verse: ReadingPayload["verses"][number],
    position: number,
  ): Promise<void> {
    const word = verse.words.find((item) => item.position === position);
    if (!word || !readingAudio) return;
    if (mushafAudio) mushafAudio.pause();
    setMushafPlaying(false);
    stopReadingWord();
    const request = ++readingWordRequest;
    readingWordPlayback = {
      request,
      verse,
      position,
      fallback: false,
      wordAudioUrl: word.audioUrl,
    };
    setReadingWord(`${verse.verseKey}:${position}`);
    if (!word.audioUrl || unavailableWordAudio.has(word.audioUrl)) {
      await playReadingWordFallback(request);
      return;
    }
    try {
      readingAudio.src = word.audioUrl;
      readingAudio.load();
      readingAudio.playbackRate = preferences().playbackSpeed / 100;
      await readingAudio.play();
      if (request !== readingWordRequest) return;
    } catch {
      if (request !== readingWordRequest) return;
      await playReadingWordFallback(request, true);
    }
  }

  function inspectReadingWord(
    verse: ReadingPayload["verses"][number],
    position: number,
  ): void {
    const word = verse.words.find((item) => item.position === position);
    if (!word) return;
    readingInsightRequest += 1;
    readingInsightWordRequest += 1;
    setReadingInsightScope("word");
    setReadingInsightAyahExpanded(false);
    setReadingInsightAyahTruncated(false);
    setReadingInsightTafsir("");
    setReadingInsightLoading(false);
    setReadingInsightWordMeaning();
    setReadingInsightWordLoading(false);
    setReadingInsight({ word, verseKey: verse.verseKey });
    if (language() === "ar")
      void loadReadingInsightWordMeaning(verse.verseKey, word.text);
  }

  function inspectReadingAyah(verse: ReadingPayload["verses"][number]): void {
    const word = verse.words[0];
    if (!word) return;
    readingInsightRequest += 1;
    readingInsightWordRequest += 1;
    setReadingInsight({ word, verseKey: verse.verseKey });
    setReadingInsightScope("ayah");
    setReadingInsightAyahExpanded(false);
    setReadingInsightAyahTruncated(false);
    setReadingInsightWordMeaning();
    setReadingInsightWordLoading(false);
    setReadingInsightTafsir("");
    void loadReadingInsightTafsir(verse.verseKey);
  }

  async function copyReadingInsightAyah(): Promise<void> {
    const verse = readingInsightVerse();
    if (!verse) return;
    try {
      await navigator.clipboard.writeText(verse.arabic);
      notify(tr("ayahCopied"));
    } catch {
      notify(tr("copyFailed"), true);
    }
  }

  function toggleReadingInsightAudio(): void {
    const insight = readingInsight();
    if (!insight) return;
    const key = `${insight.verseKey}:${insight.word.position}`;
    if (readingWord() === key) {
      stopReadingWord();
      return;
    }
    const verse = reading()?.verses.find(
      (item) => item.verseKey === insight.verseKey,
    );
    if (verse) void playReadingWord(verse, insight.word.position);
  }

  function readingInsightVerse(): ReadingPayload["verses"][number] | undefined {
    const insight = readingInsight();
    if (!insight) return;
    return reading()?.verses.find((item) => item.verseKey === insight.verseKey);
  }

  function showReadingInsightAyah(): void {
    const insight = readingInsight();
    if (!insight) return;
    setReadingInsightScope("ayah");
    setReadingInsightAyahExpanded(false);
    setReadingInsightAyahTruncated(false);
    if (!readingInsightTafsir() && !readingInsightLoading())
      void loadReadingInsightTafsir(insight.verseKey);
  }

  function showReadingInsightWord(): void {
    const insight = readingInsight();
    if (!insight) return;
    setReadingInsightScope("word");
    if (
      language() === "ar" &&
      !readingInsightWordMeaning() &&
      !readingInsightWordLoading()
    )
      void loadReadingInsightWordMeaning(insight.verseKey, insight.word.text);
  }

  async function loadReadingInsightWordMeaning(
    verseKey: string,
    word: string,
  ): Promise<void> {
    const request = ++readingInsightWordRequest;
    setReadingInsightWordMeaning();
    setReadingInsightWordLoading(true);
    try {
      const payload = await getJson<ArabicWordMeaningPayload>(
        `/api/word-meaning?verse=${encodeURIComponent(verseKey)}&word=${encodeURIComponent(word)}`,
      );
      if (request === readingInsightWordRequest)
        setReadingInsightWordMeaning(payload);
    } catch {
      if (request === readingInsightWordRequest)
        setReadingInsightWordMeaning({
          text: "",
          sourceName: "",
          sourceAuthor: "",
        });
    } finally {
      if (request === readingInsightWordRequest)
        setReadingInsightWordLoading(false);
    }
  }

  function closeReadingInsight(): void {
    readingInsightRequest += 1;
    readingInsightWordRequest += 1;
    setReadingInsightLoading(false);
    setReadingInsightWordLoading(false);
    setReadingInsight();
  }

  async function loadReadingInsightTafsir(
    verseKey: string,
    resourceId = tafsirId(),
  ): Promise<void> {
    const request = ++readingInsightRequest;
    setReadingInsightTafsir("");
    setReadingInsightLoading(true);
    try {
      if (!resourceId) return;
      const payload = await getJson<{ text: string }>(
        `/api/tafsir?tafsir=${resourceId}&verse=${encodeURIComponent(verseKey)}`,
      );
      if (request === readingInsightRequest)
        setReadingInsightTafsir(payload.text);
    } catch {
      if (request === readingInsightRequest)
        setReadingInsightTafsir(tr("readingUnavailable"));
    } finally {
      if (request === readingInsightRequest) setReadingInsightLoading(false);
    }
  }

  function stopMushafAudio(removeSource = false, hide = false): void {
    mushafPlayRequest += 1;
    if (mushafSeekHighlightTimer !== undefined)
      clearTimeout(mushafSeekHighlightTimer);
    mushafSeekHighlightTimer = undefined;
    setMushafSeekWord();
    if (mushafAudio) {
      mushafAudio.pause();
      if (removeSource) {
        mushafAudio.removeAttribute("src");
        mushafAudio.load();
      }
    }
    if (mushafStandbyAudio) {
      mushafStandbyAudio.pause();
      if (removeSource) {
        mushafStandbyAudio.removeAttribute("src");
        mushafStandbyAudio.load();
      }
    }
    setMushafPlaying(false);
    setMushafPlaybackRequested(false);
    setMushafTime(0);
    setMushafDuration(0);
    if (hide) setMushafAudioVisible(false);
  }

  async function waitForMushafMetadata(): Promise<void> {
    const element = mushafAudio;
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        element.removeEventListener("loadedmetadata", loaded);
        element.removeEventListener("error", failed);
      };
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(element.error ?? new Error("Audio metadata failed"));
      };
      element.addEventListener("loadedmetadata", loaded, { once: true });
      element.addEventListener("error", failed, { once: true });
    });
  }

  async function playMushafAyah(
    index = mushafAyah(),
    startSeconds = 0,
    seekWordKey?: string,
  ): Promise<void> {
    const verses = reading()?.verses ?? [];
    const next = Math.min(verses.length - 1, Math.max(0, index));
    const verse = verses[next];
    if (!verse || !mushafAudio) return;
    const request = ++mushafPlayRequest;
    stopReadingWord();
    if (mushafSeekHighlightTimer !== undefined)
      clearTimeout(mushafSeekHighlightTimer);
    mushafSeekHighlightTimer = undefined;
    setMushafSeekWord(seekWordKey);
    setMushafPlaybackRequested(true);
    setMushafPlaying(false);
    setMushafTime(startSeconds);
    setMushafDuration(0);
    setMushafAyah(next);
    setMushafAudioVisible(true);
    const source = new URL(verse.audioUrl, location.href).href;
    if (mushafStandbyAudio?.src === source) {
      const previous = mushafAudio;
      mushafAudio = mushafStandbyAudio;
      mushafStandbyAudio = previous;
    } else if (mushafAudio.src !== source) {
      mushafAudio.src = verse.audioUrl;
      mushafAudio.load();
    }
    try {
      await waitForMushafMetadata();
      if (request !== mushafPlayRequest) return;
      mushafAudio.currentTime = Math.max(0, startSeconds);
      mushafAudio.playbackRate = preferences().playbackSpeed / 100;
      await mushafAudio.play();
      if (request !== mushafPlayRequest) return;
      setMushafPlaying(true);
      if (seekWordKey)
        mushafSeekHighlightTimer = window.setTimeout(() => {
          setMushafSeekWord();
          mushafSeekHighlightTimer = undefined;
        }, 320);
      preloadNextMushafAyah(next);
    } catch {
      if (request !== mushafPlayRequest) return;
      setMushafSeekWord();
      setMushafPlaying(false);
      setMushafPlaybackRequested(false);
      notify(tr("playbackFailed"), true);
    }
  }

  function preloadNextMushafAyah(index: number): void {
    const nextVerse = reading()?.verses[index + 1];
    if (!nextVerse || !mushafStandbyAudio) return;
    const source = new URL(nextVerse.audioUrl, location.href).href;
    if (mushafStandbyAudio.src === source) return;
    mushafStandbyAudio.src = nextVerse.audioUrl;
    mushafStandbyAudio.load();
  }

  function mushafAudioEnded(element: HTMLAudioElement): void {
    if (element !== mushafAudio) return;
    const next = mushafAyah() + 1;
    if (next < (reading()?.verses.length ?? 0)) void playMushafAyah(next);
    else {
      stopMushafAudio();
      if (autoScroll()) pauseAutoScroll();
    }
  }

  function mushafAudioPlaying(element: HTMLAudioElement): void {
    if (element !== mushafAudio) return;
    setMushafPlaying(true);
    setMushafPlaybackRequested(true);
  }

  function mushafAudioPaused(element: HTMLAudioElement): void {
    if (element === mushafAudio) setMushafPlaying(false);
  }

  function mushafAudioTimeUpdated(element: HTMLAudioElement): void {
    if (element !== mushafAudio) return;
    setMushafTime(element.currentTime);
    setMushafDuration(Number.isFinite(element.duration) ? element.duration : 0);
  }

  function toggleMushafAudio(): void {
    if (mushafPlaybackRequested()) {
      mushafPlayRequest += 1;
      mushafAudio.pause();
      setMushafPlaying(false);
      setMushafPlaybackRequested(false);
      return;
    }
    if (!mushafAudioVisible() || mushafAudio.ended) {
      void playMushafAyah(0);
      return;
    }
    const verse = reading()?.verses[mushafAyah()];
    const expectedSource = verse
      ? new URL(verse.audioUrl, location.href).href
      : "";
    if (!verse || mushafAudio.src !== expectedSource) {
      void playMushafAyah();
      return;
    }
    stopReadingWord();
    setMushafPlaybackRequested(true);
    mushafAudio.playbackRate = preferences().playbackSpeed / 100;
    void mushafAudio
      .play()
      .then(() => {
        setMushafPlaying(true);
        preloadNextMushafAyah(mushafAyah());
      })
      .catch(() => {
        setMushafPlaying(false);
        setMushafPlaybackRequested(false);
        notify(tr("playbackFailed"), true);
      });
  }

  async function changeMushafReciter(next: number): Promise<void> {
    if (next === reciterId()) return;
    const current = reading();
    if (!current) {
      setReciterId(next);
      await loadReading(readingChapter(), false);
      return;
    }
    const previousReciter = readingAudioReciterId;
    const wasVisible = mushafAudioVisible();
    const wasPlaying = mushafPlaybackRequested();
    const ayah = mushafAyah();
    const activeVerse = current.verses[ayah];
    const soughtPosition = mushafSeekWord()?.startsWith(
      `${activeVerse?.verseKey}:`,
    )
      ? Number(mushafSeekWord()?.split(":").at(-1))
      : null;
    const activePosition =
      soughtPosition && Number.isInteger(soughtPosition)
        ? soughtPosition
        : activeVerse
          ? activeWordPosition(
              activeVerse.wordTimings,
              mushafAudio.currentTime * 1000,
            )
          : null;
    const request = ++readingRequest;
    stopReadingWord();
    if (mushafAudio) mushafAudio.pause();
    setMushafPlaying(false);
    setMushafTime(0);
    setMushafDuration(0);
    setReciterId(next);
    try {
      const payload = await getJson<ReadingPayload>(
        `/api/reading?chapter=${current.chapter.id}&reciter=${next}`,
      );
      if (request !== readingRequest || tab() !== "reading") return;
      if (
        payload.chapter.id !== current.chapter.id ||
        payload.verses.length !== current.verses.length
      )
        throw new Error("invalid reading payload");
      const refreshedByKey = new Map(
        payload.verses.map((verse) => [verse.verseKey, verse]),
      );
      const verses = current.verses.map((verse) => {
        const refreshed = refreshedByKey.get(verse.verseKey);
        if (!refreshed) throw new Error("missing refreshed ayah audio");
        return {
          ...verse,
          audioUrl: refreshed.audioUrl,
          wordTimings: refreshed.wordTimings.length
            ? refreshed.wordTimings
            : verse.wordTimings,
        };
      });
      setReading({ ...current, verses });
      readingAudioReciterId = next;
      setMushafAyah(Math.min(ayah, Math.max(0, verses.length - 1)));
      setMushafAudioVisible(wasVisible);
      if (wasPlaying) {
        const verse = verses[mushafAyah()];
        const start =
          activePosition === null || !verse
            ? 0
            : (wordStartSeconds(verse.wordTimings, activePosition) ?? 0);
        await playMushafAyah(
          mushafAyah(),
          start,
          activePosition === null || !verse
            ? undefined
            : `${verse.verseKey}:${activePosition}`,
        );
      }
    } catch {
      if (request !== readingRequest) return;
      setReciterId(previousReciter);
      setMushafAudioVisible(wasVisible);
      notify(tr("playbackFailed"), true);
      if (wasPlaying) await playMushafAyah(ayah);
    }
  }

  async function seekMushafAudio(
    verse: ReadingPayload["verses"][number],
    position?: number,
  ): Promise<void> {
    const index =
      reading()?.verses.findIndex((item) => item.verseKey === verse.verseKey) ??
      -1;
    if (index < 0) return;
    const startMs =
      position === undefined
        ? 0
        : (verse.wordTimings.find((item) => item.position === position)
            ?.startMs ?? 0);
    const start = Math.max(0, startMs / 1000);
    await playMushafAyah(
      index,
      start,
      position === undefined ? undefined : `${verse.verseKey}:${position}`,
    );
  }

  function savePreferences(next: Preferences): void {
    setPreferences(next);
    localStorage.setItem(READER_KEY, JSON.stringify(next));
  }
  function updatePreference<K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ): void {
    savePreferences({ ...preferences(), [key]: value });
  }

  async function refreshCacheSize(): Promise<void> {
    if (!("caches" in window)) return;
    let total = 0;
    const cache = await caches.open(OFFLINE_CACHE);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      total +=
        Number(response?.headers.get("content-length")) ||
        (response ? (await response.clone().blob()).size : 0);
    }
    setOfflineBytes(total);
    localStorage.setItem(OFFLINE_BYTES_KEY, String(total));
  }
  async function downloadChapters(chapterIds: number[]): Promise<void> {
    if (!("caches" in window)) {
      notify(tr("offlineUnsupported"), true);
      return;
    }
    const selectedReciter = offlineReciter();
    const ids = chapterIds.filter((id) => !isOffline(id, selectedReciter));
    if (!ids.length || downloadProgress()) return;
    try {
      const payload = await requestSession(ids, selectedReciter);
      const groups = payload.groups;
      const total = groups.reduce((sum, group) => sum + group.verses.length, 0);
      let current = 0;
      let bytes = 0;
      setDownloadProgress({ current, total });
      const cache = await caches.open(OFFLINE_CACHE);
      const next = { ...offlineManifest() };
      for (const group of groups) {
        const urls: string[] = [];
        let chapterBytes = 0;
        for (const verse of group.verses) {
          const request = new Request(verse.audioUrl);
          const response = await fetch(request);
          if (!response.ok) throw new Error("audio download failed");
          const size =
            Number(response.headers.get("content-length")) ||
            (await response.clone().blob()).size;
          chapterBytes += size;
          bytes += size;
          await cache.put(request, response);
          urls.push(verse.audioUrl);
          current += 1;
          setDownloadProgress({ current, total });
        }
        next[offlineKey(group.chapter.id, selectedReciter)] = {
          chapterId: group.chapter.id,
          reciterId: selectedReciter,
          audioUrls: urls,
          downloadedAt: Date.now(),
          bytes: chapterBytes,
        };
      }
      setOfflineManifest(next);
      localStorage.setItem(OFFLINE_MANIFEST_KEY, JSON.stringify(next));
      localStorage.setItem(OFFLINE_PRESENT_KEY, "true");
      setOfflineBytes(offlineBytes() + bytes);
      localStorage.setItem(OFFLINE_BYTES_KEY, String(offlineBytes()));
      notify(tr("downloadComplete"));
    } catch {
      notify(tr("downloadFailed"), true);
    } finally {
      setDownloadProgress();
      void refreshCacheSize();
    }
  }
  async function downloadSelected(): Promise<void> {
    await downloadChapters([...offlineSelected()]);
  }
  async function downloadAll(): Promise<void> {
    const ids = chapters().map((chapter) => chapter.id);
    setOfflineSelected(new Set(ids));
    await downloadChapters(ids);
  }
  async function removeDownloads(): Promise<void> {
    if (!("caches" in window)) return;
    await caches.delete(OFFLINE_CACHE);
    setOfflineManifest({});
    setOfflineBytes(0);
    localStorage.removeItem(OFFLINE_MANIFEST_KEY);
    localStorage.removeItem(OFFLINE_PRESENT_KEY);
    localStorage.removeItem(OFFLINE_BYTES_KEY);
    notify(tr("downloadsRemoved"));
  }

  function clearDelay(): void {
    if (delayTimer !== undefined) clearTimeout(delayTimer);
    delayTimer = undefined;
  }
  function stopPlayback(): void {
    clearDelay();
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setPlaying(false);
    setPracticeHighlightOverride();
  }
  function preloadNext(): void {
    const groups = session();
    let g = groupIndex();
    let v = verseIndex() + 1;
    if (v >= (groups[g]?.verses.length ?? 0)) {
      g += 1;
      v = 0;
    }
    const next = groups[g]?.verses[v];
    if (next && standbyAudio) {
      standbyAudio.src = next.audioUrl;
      standbyAudio.load();
    }
  }
  async function seekPracticeAudio(seconds: number): Promise<void> {
    const target = Math.max(0, seconds);
    setCurrentTime(target);
    const apply = () => {
      const maximum = Number.isFinite(audio.duration)
        ? Math.max(0, audio.duration - 0.01)
        : target;
      audio.currentTime = Math.min(target, maximum);
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      apply();
      return;
    }
    await new Promise<void>((resolve) => {
      let timeout: number | undefined;
      const finish = () => {
        clearTimeout(timeout);
        audio.removeEventListener("loadedmetadata", loaded);
        audio.removeEventListener("error", finish);
        resolve();
      };
      const loaded = () => {
        apply();
        finish();
      };
      audio.addEventListener("loadedmetadata", loaded, { once: true });
      audio.addEventListener("error", finish, { once: true });
      timeout = window.setTimeout(finish, 5000);
    });
  }
  async function prepareCurrentAudio(
    force = false,
    startSeconds?: number,
  ): Promise<void> {
    const verse = currentVerse();
    if (!verse) return;
    if (force || audio.src !== new URL(verse.audioUrl, location.href).href) {
      audio.src = verse.audioUrl;
      audio.load();
    }
    audio.playbackRate = preferences().playbackSpeed / 100;
    if (startSeconds !== undefined) await seekPracticeAudio(startSeconds);
  }
  async function playCurrent(
    force = false,
    startSeconds?: number,
    highlightPosition?: number,
  ): Promise<void> {
    const verse = currentVerse();
    if (!verse) return;
    setQuizChoices([]);
    setQuizAnswer();
    setQuizFinished(false);
    setPlaybackMessage(tr("loadingAudio"));
    setPracticeHighlightOverride(highlightPosition);
    try {
      await prepareCurrentAudio(force, startSeconds);
      await audio.play();
      setPlaying(true);
      setPlaybackMessage(tr("playingAyah", { key: verse.verseKey }));
      preloadNext();
    } catch {
      setPlaying(false);
      setPlaybackMessage(tr("playbackFailed"));
      notify(tr("playbackFailed"), true);
    }
  }
  async function playFromWord(position: number): Promise<void> {
    const verse = currentVerse();
    if (!verse) return;
    const start = wordStartSeconds(verse.wordTimings ?? [], position);
    if (start === null) return;
    clearDelay();
    await playCurrent(false, start, position);
  }
  function schedulePlay(seconds: number, message: string): void {
    setPlaybackMessage(message);
    clearDelay();
    delayTimer = window.setTimeout(() => {
      delayTimer = undefined;
      void playCurrent(true);
    }, seconds * 1000);
  }
  function finishPractice(): void {
    setPlaying(false);
    setPlaybackMessage(tr("sessionFinished"));
  }
  function advancePractice(): void {
    if (ayahRepeat() < ayahRepeats()) {
      setAyahRepeat((value) => value + 1);
      schedulePlay(
        ayahDelay(),
        ayahDelay()
          ? tr("repeatingIn", { seconds: ayahDelay() })
          : tr("repeating"),
      );
      return;
    }
    setAyahRepeat(1);
    const group = currentGroup();
    if (!group) return;
    if (verseIndex() + 1 < group.verses.length) {
      setVerseIndex((value) => value + 1);
      schedulePlay(ayahDelay(), tr("loadingAudio"));
      return;
    }
    if (surahRepeat() < surahRepeats()) {
      setSurahRepeat((value) => value + 1);
      setVerseIndex(0);
      schedulePlay(
        surahDelay(),
        surahDelay()
          ? tr("repeatingIn", { seconds: surahDelay() })
          : tr("repeating"),
      );
      return;
    }
    setSurahRepeat(1);
    if (groupIndex() + 1 < session().length) {
      setGroupIndex((value) => value + 1);
      setVerseIndex(0);
      void playCurrent(true);
      return;
    }
    const totalCycles = cycles();
    if (totalCycles === "forever" || cycle() < totalCycles) {
      setCycle((value) => value + 1);
      setGroupIndex(0);
      setVerseIndex(0);
      void playCurrent(true);
      return;
    }
    finishPractice();
  }
  function showQuestion(): void {
    const group = currentGroup();
    if (!group || verseIndex() + 1 >= group.verses.length) {
      nextQuizSurah();
      return;
    }
    const correct = group.verses[verseIndex() + 1]!;
    setQuizChoices(
      buildQuizChoices(
        { verseKey: correct.verseKey, arabic: correct.arabic },
        quizPool(),
      ),
    );
    setPlaybackMessage(tr("chooseNext"));
  }
  function nextQuizSurah(): void {
    if (groupIndex() + 1 < session().length) {
      setGroupIndex((value) => value + 1);
      setVerseIndex(0);
      void playCurrent(true);
    } else {
      setQuizFinished(true);
      setPlaybackMessage(tr("sessionComplete"));
    }
  }
  function answerQuiz(choice: QuizChoice): void {
    if (quizAnswer()) return;
    const correct = currentGroup()!.verses[verseIndex() + 1]!;
    const isCorrect = choice.verseKey === correct.verseKey;
    setQuizAnswer(choice.verseKey);
    setQuizTotal((value) => value + 1);
    if (isCorrect) setQuizCorrect((value) => value + 1);
    setPlaybackMessage(
      isCorrect
        ? tr("correct")
        : tr("correctAnswer", { key: correct.verseKey }),
    );
    window.setTimeout(() => {
      setVerseIndex((value) => value + 1);
      setQuizChoices([]);
      setQuizAnswer();
      void playCurrent(true);
    }, 1050);
  }
  function audioEnded(): void {
    setPlaying(false);
    setPracticeHighlightOverride();
    mode() === "quiz" ? showQuestion() : advancePractice();
  }
  async function startSession(
    selectedMode: "practice" | "quiz",
  ): Promise<void> {
    const ids = [...selected()];
    if (!ids.length) return;
    stopPlayback();
    const request = ++sessionRequest;
    setSessionLoading(true);
    try {
      const payload = await requestSession(ids, reciterId());
      if (request !== sessionRequest) return;
      setSession(payload.groups);
      setQuizPool(payload.quizPool);
      setMode(selectedMode);
      setGroupIndex(0);
      setVerseIndex(0);
      setAyahRepeat(1);
      setSurahRepeat(1);
      setCycle(1);
      setQuizCorrect(0);
      setQuizTotal(0);
      setTab("practice");
      window.scrollTo({ top: 0 });
      await playCurrent(true);
    } catch {
      notify(tr("sessionUnavailable"), true);
    } finally {
      if (request === sessionRequest) setSessionLoading(false);
    }
  }
  async function loadTafsir(): Promise<void> {
    const verse = currentVerse();
    if (!verse || !tafsirId()) return;
    const request = ++tafsirRequest;
    setTafsirLoading(true);
    setTafsirText("");
    try {
      const value = await getJson<{ text: string }>(
        `/api/tafsir?tafsir=${tafsirId()}&verse=${encodeURIComponent(verse.verseKey)}`,
      );
      if (request === tafsirRequest) setTafsirText(value.text);
    } catch {
      if (request === tafsirRequest) setTafsirText(tr("tafsirUnavailable"));
    } finally {
      if (request === tafsirRequest) setTafsirLoading(false);
    }
  }
  async function switchPlayerSurah(chapterId: number): Promise<void> {
    stopPlayback();
    try {
      const payload = await requestSession([chapterId], reciterId());
      setSession(payload.groups);
      setQuizPool(payload.quizPool);
      setGroupIndex(0);
      setVerseIndex(0);
      setAyahRepeat(1);
      setSurahRepeat(1);
      await playCurrent(true);
    } catch {
      notify(tr("sessionUnavailable"), true);
    }
  }
  async function switchPlayerReciter(next: number): Promise<void> {
    if (next === reciterId()) return;
    const previousGroups = session();
    if (!previousGroups.length) {
      setReciterId(next);
      return;
    }
    const previousQuizPool = quizPool();
    const previousReciter = reciterId();
    const activeChapter = currentGroup()?.chapter.id;
    const activeVerse = currentVerse()?.verseKey;
    const activeTime = audio.currentTime || currentTime();
    const activeTimings = currentVerse()?.wordTimings ?? [];
    let activePosition = activeWordPosition(activeTimings, activeTime * 1000);
    if (activePosition === null) {
      for (const timing of activeTimings) {
        if (timing.startMs > activeTime * 1000) break;
        activePosition = timing.position;
      }
    }
    const wasPlaying = playing();
    const previousGroupIndex = groupIndex();
    const previousVerseIndex = verseIndex();
    const request = ++sessionRequest;
    clearDelay();
    audio.pause();
    setPlaying(false);
    if (activePosition !== null) setPracticeHighlightOverride(activePosition);
    setReciterId(next);
    setSessionLoading(true);
    setPlaybackMessage(tr("loadingAudio"));
    try {
      const payload = await requestSession(
        previousGroups.map((group) => group.chapter.id),
        next,
      );
      if (request !== sessionRequest) return;
      const previousVerses = new Map(
        previousGroups.flatMap((group) =>
          group.verses.map((verse) => [verse.verseKey, verse] as const),
        ),
      );
      const refreshedGroups = payload.groups.map((group) => ({
        ...group,
        verses: group.verses.map((verse) => ({
          ...verse,
          wordTimings: verse.wordTimings?.length
            ? verse.wordTimings
            : (previousVerses.get(verse.verseKey)?.wordTimings ?? []),
        })),
      }));
      setSession(refreshedGroups);
      setQuizPool(payload.quizPool);
      const nextGroup = Math.max(
        0,
        refreshedGroups.findIndex(
          (group) => group.chapter.id === activeChapter,
        ),
      );
      const nextVerse = Math.max(
        0,
        refreshedGroups[nextGroup]?.verses.findIndex(
          (verse) => verse.verseKey === activeVerse,
        ) ?? 0,
      );
      setGroupIndex(nextGroup);
      setVerseIndex(nextVerse);
      const timings =
        refreshedGroups[nextGroup]?.verses[nextVerse]?.wordTimings;
      const resumeTime =
        activePosition === null
          ? activeTime
          : (wordStartSeconds(timings ?? [], activePosition) ?? activeTime);
      if (wasPlaying)
        await playCurrent(
          true,
          resumeTime,
          activePosition === null ? undefined : activePosition,
        );
      else await prepareCurrentAudio(true, resumeTime);
    } catch {
      if (request !== sessionRequest) return;
      setReciterId(previousReciter);
      setSession(previousGroups);
      setQuizPool(previousQuizPool);
      setGroupIndex(previousGroupIndex);
      setVerseIndex(previousVerseIndex);
      notify(tr("sessionUnavailable"), true);
      if (wasPlaying)
        await playCurrent(
          true,
          activeTime,
          activePosition === null ? undefined : activePosition,
        );
      else await prepareCurrentAudio(true, activeTime);
    } finally {
      if (request === sessionRequest) setSessionLoading(false);
    }
  }

  createEffect(() => {
    const next = preferences();
    const scale = next.ayahScale / 100;
    const fonts: Record<ArabicFont, string> = {
      noto: '"Noto Naskh Arabic", serif',
      amiri: '"Amiri Quran", serif',
      scheherazade: '"Scheherazade New", serif',
      system: '"Traditional Arabic", Tahoma, serif',
    };
    document.documentElement.style.setProperty(
      "--ui-font-scale",
      String(next.uiScale / 100),
    );
    document.documentElement.style.setProperty(
      "--ayah-font-size",
      `clamp(${32 * scale}px, ${4.2 * scale}vw, ${58 * scale}px)`,
    );
    document.documentElement.style.setProperty(
      "--tafsir-font-size",
      `${next.tafsirFontSize}px`,
    );
    document.documentElement.style.setProperty(
      "--reader-arabic-font",
      fonts[next.arabicFont],
    );
    document.documentElement.style.setProperty(
      "--tafsir-arabic-font",
      fonts[next.tafsirFont],
    );
    if (audio) audio.playbackRate = next.playbackSpeed / 100;
    if (readingAudio) readingAudio.playbackRate = next.playbackSpeed / 100;
    if (mushafAudio) mushafAudio.playbackRate = next.playbackSpeed / 100;
  });
  createEffect(() => {
    document.documentElement.lang = language();
    document.documentElement.dir = language() === "ar" ? "rtl" : "ltr";
    document.title = language() === "ar" ? "حفظ القرآن" : "Quran Memo";
  });
  createEffect(() => {
    if (studyTab() === "tafsir" && currentVerse() && tafsirId())
      void loadTafsir();
  });

  function loadCatalog(): void {
    setCatalogError(false);
    void getJson<CatalogPayload>("/api/catalog")
      .then((value) => {
        setCatalog({ ...value, tafsirs: value.tafsirs ?? [] });
        if (!shared.reciterId) setReciterId(value.defaultReciterId);
        setOfflineReciter(shared.reciterId ?? value.defaultReciterId);
        const preferred = preferredTafsir(language(), value.tafsirs ?? []);
        if (preferred) setTafsirId(preferred.id);
        if (tab() === "reading" && !readingLibrary())
          void loadReading(
            readingChapter(),
            false,
            readingTarget() ?? { chapterId: readingChapter() },
          );
        void refreshCacheSize();
      })
      .catch(() => setCatalogError(true));
  }

  onMount(() => {
    loadCatalog();
    const popstate = () => {
      const next = mainTabFromUrl(new URL(location.href));
      const target = readingTargetFromUrl(new URL(location.href));
      stopPlayback();
      stopReadingWord(true);
      stopMushafAudio(true, true);
      pauseAutoScroll();
      setTab(next);
      setReadingLibrary(next === "reading" && !target);
      setReadingTarget(target);
      if (next === "reading" && target)
        void loadReading(target.chapterId, false, target);
    };
    const stopScroll = (event: Event) => {
      const target = event.target;
      if (
        !autoScroll() ||
        (target instanceof Element && target.closest('[role="listbox"]'))
      )
        return;
      pauseAutoScroll();
    };
    window.addEventListener("popstate", popstate);
    window.addEventListener("wheel", stopScroll, { passive: true });
    window.addEventListener("touchmove", stopScroll, { passive: true });
    onCleanup(() => {
      window.removeEventListener("popstate", popstate);
      window.removeEventListener("wheel", stopScroll);
      window.removeEventListener("touchmove", stopScroll);
      stopPlayback();
      stopReadingWord(true);
      stopMushafAudio(true, true);
      pauseAutoScroll();
      clearTimeout(toastTimer);
      clearTimeout(toastExitTimer);
      clearTimeout(mushafSeekHighlightTimer);
    });
    if ("serviceWorker" in navigator)
      window.addEventListener(
        "load",
        () =>
          void navigator.serviceWorker
            .register("/sw.js", { updateViaCache: "none" })
            .then((registration) => registration.update())
            .catch(console.error),
        { once: true },
      );
  });

  const activeWords = createMemo(() => {
    const verse = currentVerse();
    if (!verse) return [];
    const words = verse.words?.length
      ? verse.words
      : verse.arabic
          .split(/\s+/)
          .map((text, index) => ({ position: index + 1, text }));
    return memorizationWords(words, memorization());
  });
  const highlightedWord = createMemo(
    () =>
      practiceHighlightOverride() ??
      activeWordPosition(
        currentVerse()?.wordTimings ?? [],
        currentTime() * 1000,
      ),
  );
  const mushafHighlightedWord = createMemo(() => {
    const soughtWord = mushafSeekWord();
    if (soughtWord) return soughtWord;
    if (!mushafAudioVisible() || !mushafPlaying()) return;
    const verse = reading()?.verses[mushafAyah()];
    if (!verse) return;
    const position = activeWordPosition(verse.wordTimings, mushafTime() * 1000);
    return position === null ? undefined : `${verse.verseKey}:${position}`;
  });
  const selectedDownloadSize = createMemo(() =>
    [...offlineSelected()].reduce(
      (sum, id) =>
        sum + (offlineManifest()[offlineKey(id, offlineReciter())]?.bytes ?? 0),
      0,
    ),
  );
  const bookmarkIds = createMemo(
    () => new Set(bookmarks().map((item) => item.id)),
  );

  const Hero = (props: {
    eyebrow: MessageKey;
    title: MessageKey;
    description: MessageKey;
  }) => <UIHero tr={tr} {...props} />;
  const PanelHeading = (props: {
    number: string;
    title: MessageKey;
    description: MessageKey;
  }) => <UIPanelHeading tr={tr} {...props} />;
  const Field = (props: { label: MessageKey; children: JSX.Element }) => (
    <UIField tr={tr} {...props} />
  );
  const SurahList = (props: {
    items: Chapter[];
    values: Set<number>;
    reciter: number;
    onToggle: (id: number) => void;
  }) => (
    <UISurahList
      tr={tr}
      language={language()}
      isOffline={isOffline}
      {...props}
    />
  );
  const Stat = (props: { label: MessageKey; value: string }) => (
    <UIStat tr={tr} {...props} />
  );

  return (
    <>
      <div class="pointer-events-none fixed top-[15%] left-[-260px] size-[420px] rounded-full bg-[#8fbf9c] opacity-10 blur-[100px]" />
      <div class="pointer-events-none fixed right-[-280px] bottom-[5%] size-[420px] rounded-full bg-[#c59a50] opacity-10 blur-[100px]" />
      <div class="relative mx-auto w-[min(1380px,calc(100%-48px))] max-md:pb-[var(--bottom-nav-h)] max-sm:w-[calc(100%-24px)]">
        <Header
          language={language()}
          tab={tab()}
          tr={tr}
          onLanguage={changeLanguage}
          onNavigate={navigate}
        />
        <MobileNavigation tab={tab()} tr={tr} onNavigate={navigate} />
        <main>
          <Show
            when={shouldRenderPlayer(tab(), session().length)}
            fallback={
              <>
                <Show when={tab() === "practice"}>
                  <PracticeFeatureView
                    tr={tr}
                    language={language()}
                    chapters={chapters()}
                    visible={visibleChapters()}
                    reciters={reciters()}
                    selected={selected()}
                    reciterId={reciterId()}
                    ayahRepeats={ayahRepeats()}
                    surahRepeats={surahRepeats()}
                    cycles={cycles()}
                    memorization={memorization()}
                    ayahDelay={ayahDelay()}
                    surahDelay={surahDelay()}
                    search={search()}
                    loading={sessionLoading()}
                    catalogReady={Boolean(catalog())}
                    catalogError={catalogError()}
                    retryCatalog={loadCatalog}
                    setReciter={setReciterId}
                    setAyahRepeats={setAyahRepeats}
                    setSurahRepeats={setSurahRepeats}
                    setCycles={setCycles}
                    setMemorization={setMemorization}
                    setAyahDelay={setAyahDelay}
                    setSurahDelay={setSurahDelay}
                    setSearch={setSearch}
                    clear={() => setSelected(new Set())}
                    selectVisible={() => selectAllVisible()}
                    toggle={(id) => toggleSelection(id)}
                    start={(mode) => void startSession(mode)}
                    share={() => void copyLink()}
                    isOffline={isOffline}
                    bounded={bounded}
                  />
                </Show>
                <Show when={tab() === "reading"}>
                  <Show
                    when={!readingLibrary()}
                    fallback={
                      <ReadingLibraryView
                        tr={tr}
                        language={language()}
                        chapters={chapters()}
                        progress={readingProgress()}
                        catalogReady={Boolean(catalog())}
                        catalogError={catalogError()}
                        bookmarkIds={bookmarkIds()}
                        retry={loadCatalog}
                        open={(chapterId, pageNumber) =>
                          openReadingTarget({ chapterId, pageNumber })
                        }
                        toggleBookmark={toggleChapterBookmark}
                      />
                    }
                  >
                    <ReadingView
                      tr={tr}
                      language={language()}
                      chapters={chapters()}
                      chapterId={readingChapter()}
                      payload={reading()}
                      loading={readingLoading()}
                      error={readingError()}
                      scrolling={autoScroll()}
                      scrollComplete={autoScrollDone()}
                      load={(chapter) => void loadReading(chapter)}
                      target={readingTarget()}
                      backToLibrary={showReadingLibrary}
                      pageChanged={readingPageChanged}
                      bookmarkIds={bookmarkIds()}
                      toggleSurahBookmark={toggleSurahBookmark}
                      togglePageBookmark={togglePageBookmark}
                      startScroll={startAutoScroll}
                      pauseScroll={pauseAutoScroll}
                      chapterName={chapterName}
                      activeWord={readingWord() ?? mushafHighlightedWord()}
                      boxHighlight={preferences().wordHighlightStyle === "box"}
                      playWord={(verse, position) =>
                        void playReadingWord(verse, position)
                      }
                      inspectWord={inspectReadingWord}
                      inspectAyah={inspectReadingAyah}
                      seekWord={(verse, position) =>
                        void seekMushafAudio(verse, position)
                      }
                      seekAyah={(verse) => void seekMushafAudio(verse)}
                      audioVisible={mushafAudioVisible()}
                      audioPlaying={mushafPlaybackRequested()}
                      audioAyah={mushafAyah()}
                      audioTime={mushafTime()}
                      audioDuration={mushafDuration()}
                      reciterName={
                        activeReciter() ? reciterName(activeReciter()!) : ""
                      }
                      reciterId={reciterId()}
                      reciters={reciters()}
                      changeReciter={(value) => void changeMushafReciter(value)}
                      toggleAudio={toggleMushafAudio}
                      previousAudio={() =>
                        void playMushafAyah(mushafAyah() - 1)
                      }
                      nextAudio={() => void playMushafAyah(mushafAyah() + 1)}
                      closeAudio={() => stopMushafAudio(true, true)}
                    />
                  </Show>
                </Show>
                <Show when={tab() === "bookmarks"}>
                  <BookmarksView
                    tr={tr}
                    language={language()}
                    bookmarks={bookmarks()}
                    open={openReadingTarget}
                    remove={removeBookmark}
                  />
                </Show>
                <Show when={tab() === "downloads"}>
                  <DownloadsView />
                </Show>
                <Show when={tab() === "settings"}>
                  <SettingsView
                    tr={tr}
                    preferences={preferences()}
                    update={updatePreference}
                    normalizeScroll={normalizedAutoScrollLevel}
                    reset={() => {
                      savePreferences({ ...defaultPreferences });
                      notify(tr("preferencesReset"));
                    }}
                  />
                </Show>
              </>
            }
          >
            <PlayerView />
          </Show>
        </main>
        <footer class="flex min-h-[90px] items-center justify-between border-t border-white/10 text-[0.625rem] tracking-wider text-[#6f7c75] uppercase max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:gap-2">
          <span>{tr("contentCredit")}</span>
          <span class="normal-case">
            Built by{" "}
            <a
              class="text-gold hover:underline"
              href="mailto:mail@abdulrahman.dev"
            >
              Abdulrahman Salah
            </a>
          </span>
        </footer>
      </div>
      <Show when={readingInsight()}>
        {(insight) => (
          <div
            class="fixed inset-0 z-[90] grid items-end bg-black/60 p-3 backdrop-blur-[3px] md:place-items-center"
            onClick={closeReadingInsight}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label={tr("wordMeaning")}
              class="memo-scrollbar max-h-[calc(100dvh-24px)] w-full max-w-[560px] animate-rise overflow-y-auto rounded-[24px] border border-white/12 bg-[#17251f] p-5 shadow-[0_30px_90px_rgba(0,0,0,.55)] max-md:rounded-b-[18px] md:max-h-[88dvh]"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15 md:hidden" />
              <header class="flex items-start justify-between gap-4 border-b border-hairline pb-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
                <div class="min-w-0">
                  <span class="text-[0.625rem] font-bold tracking-wider text-gold uppercase">
                    {tr("wordMeaning")}
                  </span>
                  <strong class="font-reader-arabic mt-1 block text-[36px] leading-normal text-ink">
                    {insight().word.text}
                  </strong>
                </div>
                <div class="flex shrink-0 items-center gap-2 max-sm:justify-end max-sm:gap-1">
                  <button
                    type="button"
                    class={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-[0.6875rem] font-bold transition active:scale-[.98] ${
                      readingWord() ===
                      `${insight().verseKey}:${insight().word.position}`
                        ? "border-gold/45 bg-gold/12 text-gold"
                        : "border-white/12 text-[#cbd5cf] hover:border-gold/35 hover:text-gold"
                    }`}
                    aria-label={tr("playFromWord", {
                      word: insight().word.text,
                    })}
                    aria-pressed={
                      readingWord() ===
                      `${insight().verseKey}:${insight().word.position}`
                    }
                    onClick={toggleReadingInsightAudio}
                  >
                    <Icon
                      name={
                        readingWord() ===
                        `${insight().verseKey}:${insight().word.position}`
                          ? "pause"
                          : "play"
                      }
                      class="size-3.5"
                    />
                    <span>
                      {tr(
                        readingWord() ===
                          `${insight().verseKey}:${insight().word.position}`
                          ? "pause"
                          : "listen",
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    class={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-[0.6875rem] font-bold transition active:scale-[.96] ${bookmarkIds().has(`ayah:${insight().verseKey}`) ? "border-gold/45 bg-gold/12 text-gold" : "border-white/12 text-[#cbd5cf] hover:border-gold/35 hover:text-gold"}`}
                    aria-label={tr(
                      bookmarkIds().has(`ayah:${insight().verseKey}`)
                        ? "removeSavedAyah"
                        : "saveAyah",
                    )}
                    aria-pressed={bookmarkIds().has(
                      `ayah:${insight().verseKey}`,
                    )}
                    onClick={() => {
                      const verse = readingInsightVerse();
                      if (verse) toggleAyahBookmark(verse);
                    }}
                  >
                    <Icon name="bookmark" class="size-4" />
                    <span>
                      {tr(
                        bookmarkIds().has(`ayah:${insight().verseKey}`)
                          ? "savedBookmark"
                          : "saveBookmarkAction",
                      )}
                    </span>
                  </button>
                  <button
                    class="grid size-11 place-items-center rounded-full border border-hairline text-muted transition hover:border-accent/35 hover:text-accent active:scale-[.96]"
                    aria-label={tr("closePlayer")}
                    onClick={closeReadingInsight}
                  >
                    <Icon name="close" class="size-4" />
                  </button>
                </div>
              </header>
              <div class="pt-4">
                <div class="mb-2 flex items-center justify-between gap-4 px-1">
                  <b class="text-[0.625rem] font-bold tracking-wider text-gold uppercase">
                    {tr("tafsirScope")}
                  </b>
                  <span class="font-mono text-[0.625rem] text-muted">
                    {insight().verseKey}
                  </span>
                </div>
                <div class="grid grid-cols-2 rounded-xl border border-hairline bg-paper/45 p-1">
                  <button
                    type="button"
                    class={`min-h-11 rounded-lg px-3 text-xs font-bold transition ${
                      readingInsightScope() === "word"
                        ? "bg-gold text-[#142019] shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                    aria-pressed={readingInsightScope() === "word"}
                    onClick={showReadingInsightWord}
                  >
                    {tr("wordScope")}
                  </button>
                  <button
                    type="button"
                    class={`min-h-11 rounded-lg px-3 text-xs font-bold transition ${
                      readingInsightScope() === "ayah"
                        ? "bg-gold text-[#142019] shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                    aria-pressed={readingInsightScope() === "ayah"}
                    onClick={showReadingInsightAyah}
                  >
                    {tr("fullAyahScope")}
                  </button>
                </div>
                <button
                  type="button"
                  class={`${styles.button} mt-3 w-full`}
                  onClick={() => void copyReadingInsightAyah()}
                >
                  <Icon name="copy" class="size-4" />
                  {tr("copyAyah")}
                </button>
                <Show
                  when={readingInsightScope() === "ayah"}
                  fallback={
                    <div class="mt-3 rounded-2xl border border-hairline bg-paper/45 px-4 py-5">
                      <p class="text-[0.625rem] font-bold tracking-wider text-gold uppercase">
                        {tr(
                          language() === "ar"
                            ? "arabicWordMeaning"
                            : "wordMeaning",
                        )}
                      </p>
                      <Show
                        when={language() === "ar"}
                        fallback={
                          <p
                            class="mt-2 text-start text-[17px] leading-7 text-ink"
                            dir="auto"
                          >
                            {insight().word.meaning ?? "—"}
                          </p>
                        }
                      >
                        <p
                          class="tafsir-reader mt-3 text-start leading-8 text-ink"
                          dir="rtl"
                        >
                          {readingInsightWordLoading()
                            ? tr("loadingWordMeaning")
                            : readingInsightWordMeaning()?.text ||
                              tr("wordMeaningUnavailable")}
                        </p>
                        <Show when={readingInsightWordMeaning()?.sourceName}>
                          <div class="mt-4 border-t border-hairline pt-3 text-start">
                            <span class="block text-[0.625rem] font-bold text-gold">
                              {readingInsightWordMeaning()?.sourceName}
                            </span>
                            <span class="mt-1 block text-[0.625rem] text-muted">
                              {readingInsightWordMeaning()?.sourceAuthor}
                            </span>
                          </div>
                        </Show>
                      </Show>
                      <div class="mt-5 border-t border-hairline pt-4">
                        <p class="text-[0.625rem] font-bold tracking-wider text-gold uppercase">
                          {tr("tajweed")}
                        </p>
                        <Show
                          when={(insight().word.tajweedRules?.length ?? 0) > 0}
                          fallback={
                            <p class="mt-2 text-start text-xs leading-6 text-muted">
                              {tr("tajweedUnavailable")}
                            </p>
                          }
                        >
                          {(() => {
                            const rules = () =>
                              prioritizeTajweedRules(
                                insight().word.tajweedRules ?? [],
                              );
                            const primaryRule = () => rules()[0];
                            return (
                              <div class="mt-3">
                                <Show when={primaryRule()} keyed>
                                  {(rule) => {
                                    const copy = () =>
                                      tajweedRuleCopy(rule, language());
                                    return (
                                      <div class="rounded-xl border border-gold/20 bg-gold/5 px-3.5 py-3 text-start">
                                        <p class="text-xs text-gold">
                                          <span class="font-bold">
                                            {tr("tajweedRule")}:
                                          </span>{" "}
                                          <b>{copy().name}</b>
                                        </p>
                                        <p class="mt-1.5 text-xs leading-6 text-muted">
                                          {copy().description}
                                        </p>
                                      </div>
                                    );
                                  }}
                                </Show>
                                <Show when={rules().length > 1}>
                                  <details class="mt-2 rounded-xl border border-hairline bg-paper/45 px-3.5 py-2.5 text-start">
                                    <summary class="cursor-pointer text-[0.6875rem] font-bold text-muted transition hover:text-gold">
                                      {tr("otherTajweedRules")}
                                    </summary>
                                    <div class="mt-2 flex flex-wrap gap-2">
                                      <For each={rules().slice(1)}>
                                        {(rule) => (
                                          <span class="rounded-full border border-hairline px-2.5 py-1 text-[0.625rem] text-muted">
                                            {
                                              tajweedRuleCopy(rule, language())
                                                .name
                                            }
                                          </span>
                                        )}
                                      </For>
                                    </div>
                                  </details>
                                </Show>
                              </div>
                            );
                          })()}
                        </Show>
                      </div>
                    </div>
                  }
                >
                  <div class="mt-3 rounded-2xl border border-hairline bg-paper/45 px-4 py-4">
                    <p
                      ref={(element) =>
                        requestAnimationFrame(() =>
                          setReadingInsightAyahTruncated(
                            element.scrollHeight > element.clientHeight + 1,
                          ),
                        )
                      }
                      class="font-reader-arabic text-center text-[21px] leading-[2] text-ink"
                      classList={{
                        "insight-ayah-collapsed": !readingInsightAyahExpanded(),
                        "memo-scrollbar max-h-[24dvh] overflow-y-auto":
                          readingInsightAyahExpanded(),
                      }}
                      dir="rtl"
                    >
                      {readingInsightVerse()?.arabic}
                    </p>
                    <Show
                      when={
                        readingInsightAyahTruncated() ||
                        readingInsightAyahExpanded()
                      }
                    >
                      <button
                        type="button"
                        class="mx-auto mt-2 block min-h-11 rounded-full px-3 text-[0.625rem] font-bold text-gold transition hover:bg-gold/8"
                        aria-expanded={readingInsightAyahExpanded()}
                        onClick={() =>
                          setReadingInsightAyahExpanded((value) => !value)
                        }
                      >
                        {tr(
                          readingInsightAyahExpanded()
                            ? "collapseAyah"
                            : "expandAyah",
                        )}
                      </button>
                    </Show>
                  </div>
                  <div class="mt-3">
                    <CustomSelect
                      label={tr("tafsir")}
                      value={tafsirId()}
                      options={localizedTafsirs().map((item) => ({
                        value: item.id,
                        label:
                          language() === "ar"
                            ? item.nameArabic
                            : item.nameEnglish,
                      }))}
                      onChange={(value) => {
                        const next = Number(value);
                        setTafsirId(next);
                        void loadReadingInsightTafsir(insight().verseKey, next);
                      }}
                    />
                  </div>
                  <Show
                    when={!readingInsightLoading()}
                    fallback={<SkeletonLines count={5} class="mt-5" />}
                  >
                    <p
                      class="tafsir-reader memo-scrollbar mt-3 max-h-[38dvh] overflow-auto text-start leading-8 whitespace-pre-line text-muted"
                      dir="auto"
                    >
                      {readingInsightTafsir() || tr("chooseTafsir")}
                    </p>
                  </Show>
                </Show>
              </div>
            </section>
          </div>
        )}
      </Show>
      <Show when={toast()}>
        {(value) => (
          <div
            role="status"
            class={`toast fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border px-5 py-3 text-sm shadow-[0_18px_50px_var(--strong-shadow)] max-md:bottom-[var(--bottom-nav-h)] ${toastExiting() ? "toast-exit" : ""} ${value().error ? "border-danger/50 bg-danger/10 text-danger" : "border-hairline bg-panel text-ink"}`}
          >
            {value().text}
          </div>
        )}
      </Show>
      <audio
        ref={audio}
        preload="auto"
        onEnded={audioEnded}
        onTimeUpdate={() => {
          setCurrentTime(audio.currentTime);
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          if (
            practiceHighlightOverride() !== undefined &&
            activeWordPosition(
              currentVerse()?.wordTimings ?? [],
              audio.currentTime * 1000,
            ) !== null
          )
            setPracticeHighlightOverride();
        }}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <audio ref={standbyAudio} preload="auto" />
      <audio
        ref={readingAudio}
        preload="metadata"
        onEnded={() => stopReadingWord()}
        onTimeUpdate={() => {
          const context = readingWordPlayback;
          if (
            context?.fallback &&
            context.endSeconds !== undefined &&
            readingAudio.currentTime >= context.endSeconds - 0.025
          )
            stopReadingWord();
        }}
        onError={() => {
          const context = readingWordPlayback;
          if (context && !context.fallback)
            void playReadingWordFallback(context.request, true);
        }}
      />
      <audio
        ref={(element) => (mushafAudio = element)}
        preload="auto"
        onEnded={(event) => mushafAudioEnded(event.currentTarget)}
        onPlaying={(event) => mushafAudioPlaying(event.currentTarget)}
        onPause={(event) => mushafAudioPaused(event.currentTarget)}
        onTimeUpdate={(event) => mushafAudioTimeUpdated(event.currentTarget)}
      />
      <audio
        ref={(element) => (mushafStandbyAudio = element)}
        preload="auto"
        onEnded={(event) => mushafAudioEnded(event.currentTarget)}
        onPlaying={(event) => mushafAudioPlaying(event.currentTarget)}
        onPause={(event) => mushafAudioPaused(event.currentTarget)}
        onTimeUpdate={(event) => mushafAudioTimeUpdated(event.currentTarget)}
      />
    </>
  );

  function DownloadsView() {
    const downloadedCount = () => Object.keys(offlineManifest()).length;
    return (
      <section class="animate-enter py-14 max-md:py-8">
        <Hero
          eyebrow="offlineListening"
          title="downloadsTitle"
          description="downloadsDescription"
        />
        <div class="grid grid-cols-[minmax(300px,.65fr)_minmax(480px,1.35fr)] items-start gap-5 max-[980px]:grid-cols-1">
          <aside
            class={`${panel} sticky top-6 p-7 max-[980px]:static max-sm:p-5`}
          >
            <PanelHeading
              number="01"
              title="downloadSettings"
              description="downloadSettingsDescription"
            />
            <Field label="reciter">
              <ReciterPicker
                tr={tr}
                language={language()}
                reciters={reciters()}
                value={offlineReciter()}
                disabled={Boolean(downloadProgress())}
                onChange={setOfflineReciter}
              />
            </Field>
            <Show
              when={downloadedCount()}
              fallback={
                <div class="my-5">
                  <EmptyState
                    tr={tr}
                    icon="download"
                    title="noOfflineDownloads"
                    hint="noOfflineDownloadsHint"
                    compact
                  />
                </div>
              }
            >
              <div class="my-5 rounded-2xl border border-hairline bg-paper/45 p-4">
                <b class="block">
                  {tr("offlineCount", { count: downloadedCount() })}
                </b>
                <small class="mt-1 block text-muted">
                  {tr("offlineStorageNote")}
                </small>
              </div>
            </Show>
            <div class="grid grid-cols-2 gap-2 text-center">
              <div class="rounded-xl border border-hairline bg-paper/35 p-3">
                <small class="block text-muted">{tr("downloadSize")}</small>
                <b class="mt-1 block text-gold">
                  {formatBytes(selectedDownloadSize())}
                </b>
              </div>
              <div class="rounded-xl border border-hairline bg-paper/35 p-3">
                <small class="block text-muted">{tr("cacheSize")}</small>
                <b class="mt-1 block text-gold">
                  {formatBytes(offlineBytes())}
                </b>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                class={primary}
                disabled={
                  !offlineSelected().size || Boolean(downloadProgress())
                }
                onClick={() => void downloadSelected()}
              >
                <Icon name="download" />
                {tr("downloadSelected")}
              </button>
              <button
                class={button}
                disabled={
                  !chapters().length ||
                  Boolean(downloadProgress()) ||
                  chapters().every((chapter) =>
                    isOffline(chapter.id, offlineReciter()),
                  )
                }
                onClick={() => void downloadAll()}
              >
                <Icon name="download" />
                {tr("downloadAllSurahs")}
              </button>
              <button
                class={`${button} col-span-2`}
                disabled={!downloadedCount() || Boolean(downloadProgress())}
                onClick={() => void removeDownloads()}
              >
                <Icon name="trash" />
                {tr("removeDownloads")}
              </button>
            </div>
            <Show when={downloadProgress()}>
              {(progress) => (
                <div class="mt-4">
                  <progress
                    class="w-full accent-gold"
                    max={progress().total}
                    value={progress().current}
                  />
                  <p class="text-center text-xs text-muted">
                    {tr("downloadingAudio", progress())}
                  </p>
                </div>
              )}
            </Show>
          </aside>
          <section class={`${panel} p-7 max-sm:p-5`}>
            <PanelHeading
              number="02"
              title="chooseDownloads"
              description="chooseDownloadsDescription"
            />
            <div class="mb-5 flex gap-2 max-sm:flex-col">
              <input
                class={field}
                type="search"
                value={offlineSearch()}
                placeholder={tr("searchSurahs")}
                onInput={(e) => setOfflineSearch(e.currentTarget.value)}
              />
              <button class={button} onClick={() => selectAllVisible(true)}>
                {tr("selectVisible")}
              </button>
            </div>
            <Show
              when={offlineVisible().length > 0 || !offlineSearch()}
              fallback={
                <EmptyState
                  tr={tr}
                  icon="search"
                  title="noSearchResults"
                  hint="noSearchResultsHint"
                />
              }
            >
              <SurahList
                items={offlineVisible()}
                values={offlineSelected()}
                reciter={offlineReciter()}
                onToggle={(id) => toggleSelection(id, true)}
              />
            </Show>
          </section>
        </div>
      </section>
    );
  }

  function PlayerView() {
    const group = currentGroup;
    const verse = currentVerse;
    const adjustAyahRepeats = (change: number) => {
      const next = bounded(ayahRepeats() + change, 1, 100, 1);
      setAyahRepeats(next);
      setAyahRepeat((value) => Math.min(value, next));
    };
    const adjustSurahRepeats = (change: number) => {
      const next = bounded(surahRepeats() + change, 1, 100, 3);
      setSurahRepeats(next);
      setSurahRepeat((value) => Math.min(value, next));
    };
    return (
      <section class="min-h-[calc(100vh-105px)] animate-enter py-8">
        <div class="mb-6 flex justify-between">
          <button
            class={button}
            onClick={() => {
              stopPlayback();
              setSession([]);
              setPlaybackMessage("");
            }}
          >
            <Icon name="left" />
            {tr("changeSession")}
          </button>
          <button class={button} onClick={() => void copyLink()}>
            <Icon name="share" />
            {tr("shareSession")}
          </button>
        </div>
        <div class="grid grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)] items-start gap-5 max-[980px]:grid-cols-1">
          <article
            class={`${panel} flex min-h-[620px] flex-col p-8 max-sm:min-h-[530px] max-sm:p-5`}
          >
            <Show when={Boolean(group() && verse())}>
              <>
                <PlayerMasthead
                  tr={tr}
                  chapter={group()!.chapter}
                  verse={verse()!}
                  number={localNumber}
                />
                <div class="flex flex-1 flex-col justify-center px-[3%] text-center">
                  <p
                    class={`arabic-reader leading-[2] text-ink ${memorization() === "hidden" ? "text-[20px]! text-muted" : ""}`}
                    dir="rtl"
                    lang="ar"
                    translate="no"
                  >
                    <Show
                      when={activeWords().length}
                      fallback={tr("memoryHidden")}
                    >
                      <For each={activeWords()}>
                        {(word) => {
                          const timed = () =>
                            Boolean(
                              currentVerse()?.wordTimings?.some(
                                (timing) => timing.position === word.position,
                              ),
                            );
                          const classList = () => ({
                            active: highlightedWord() === word.position,
                            box: preferences().wordHighlightStyle === "box",
                          });
                          return (
                            <Show
                              when={timed()}
                              fallback={
                                <span
                                  class="arabic-word"
                                  classList={classList()}
                                >
                                  {word.text}{" "}
                                </span>
                              }
                            >
                              <button
                                type="button"
                                class="arabic-word"
                                classList={classList()}
                                aria-label={tr("playFromWord", {
                                  word: word.text,
                                })}
                                onClick={() => void playFromWord(word.position)}
                              >
                                {word.text}
                              </button>{" "}
                            </Show>
                          );
                        }}
                      </For>
                    </Show>
                  </p>
                  <div class="mx-auto my-7 flex w-[150px] items-center gap-3 text-gold">
                    <span class="h-px flex-1 bg-gradient-to-r from-transparent to-gold/50" />
                    ◆
                    <span class="h-px flex-1 bg-gradient-to-l from-transparent to-gold/50" />
                  </div>
                  <div class="mx-auto w-[min(760px,100%)]">
                    <div class="mx-auto mb-3 flex w-fit gap-1 rounded-xl border border-hairline bg-paper/45 p-1">
                      <button
                        class={`min-h-11 rounded-lg px-4 text-xs transition ${studyTab() === "translation" ? "bg-gold font-bold text-[#172019]" : "text-muted hover:text-ink"}`}
                        onClick={() => setStudyTab("translation")}
                      >
                        {tr("translation")}
                      </button>
                      <button
                        class={`min-h-11 rounded-lg px-4 text-xs transition ${studyTab() === "tafsir" ? "bg-gold font-bold text-[#172019]" : "text-muted hover:text-ink"}`}
                        onClick={() => setStudyTab("tafsir")}
                      >
                        {tr("tafsir")}
                      </button>
                    </div>
                    <Show when={studyTab() === "translation"}>
                      <div class="rounded-[18px] border border-hairline bg-paper/45 px-5 py-4">
                        <p
                          class="font-serif text-[clamp(15px,1.5vw,19px)] leading-7 text-muted"
                          dir="ltr"
                        >
                          {verse()!.translation}
                        </p>
                      </div>
                    </Show>
                    <Show when={studyTab() === "tafsir"}>
                      <div class="rounded-[18px] border border-hairline bg-paper/45 p-3.5 text-start max-sm:p-3">
                        <div class="mb-3 flex items-center gap-3 max-sm:block">
                          <span class="shrink-0 text-[0.625rem] font-bold tracking-wide text-gold uppercase max-sm:mb-2 max-sm:block rtl:tracking-normal rtl:normal-case">
                            {tr("tafsirSource")}
                          </span>
                          <div class="min-w-0 flex-1">
                            <CustomSelect
                              label={tr("tafsir")}
                              value={tafsirId()}
                              options={localizedTafsirs().map((item) => ({
                                value: item.id,
                                label:
                                  language() === "ar"
                                    ? item.nameArabic
                                    : item.nameEnglish,
                              }))}
                              onChange={(value) => setTafsirId(Number(value))}
                            />
                          </div>
                        </div>
                        <div class="border-t border-hairline pt-3">
                          <Show
                            when={!tafsirLoading()}
                            fallback={<SkeletonLines count={4} class="py-2" />}
                          >
                            <p
                              class="tafsir-reader memo-scrollbar max-h-[220px] min-h-[70px] overflow-y-auto px-1 text-start leading-[2.05] whitespace-pre-line text-muted"
                              dir="auto"
                            >
                              {tafsirText() || tr("chooseTafsir")}
                            </p>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>
                  <Show when={mode() === "quiz" && quizChoices().length}>
                    <QuizPanel
                      tr={tr}
                      choices={quizChoices()}
                      answer={quizAnswer()}
                      expectedVerseKey={
                        group()!.verses[verseIndex() + 1]?.verseKey
                      }
                      correct={quizCorrect()}
                      total={quizTotal()}
                      onAnswer={answerQuiz}
                    />
                  </Show>
                  <Show when={quizFinished()}>
                    <div class="mx-auto mt-8 w-[min(460px,100%)] rounded-2xl border border-gold/20 bg-gold/5 p-7 text-center">
                      <span class="text-xs text-gold uppercase">
                        {tr("sessionComplete")}
                      </span>
                      <strong class="my-3 block font-serif text-7xl text-gold-bright">
                        {accuracy(quizCorrect(), quizTotal())}%
                      </strong>
                      <h3 class="font-serif text-xl">{tr("accuracyTitle")}</h3>
                      <p class="text-xs text-muted">
                        {tr("quizDetail", {
                          correct: quizCorrect(),
                          total: quizTotal(),
                        })}
                      </p>
                      <button
                        class={`${primary} mt-5`}
                        onClick={() => {
                          setGroupIndex(0);
                          setVerseIndex(0);
                          setQuizCorrect(0);
                          setQuizTotal(0);
                          setQuizFinished(false);
                          void playCurrent(true);
                        }}
                      >
                        {tr("retryQuiz")}
                      </button>
                    </div>
                  </Show>
                </div>
              </>
            </Show>
          </article>
          <aside class={`${panel} p-7`}>
            <p class={eyebrow}>{tr("nowPlaying")}</p>
            <h2 class="font-serif text-3xl rtl:font-arabic">
              {group()?.chapter.nameSimple}
            </h2>
            <p class="mt-1 truncate text-sm text-muted">
              {activeReciter() ? reciterName(activeReciter()!) : ""}
            </p>
            <div class="mt-5 grid gap-3 border-t border-hairline pt-5">
              <Field label="playerReciter">
                <ReciterPicker
                  tr={tr}
                  language={language()}
                  reciters={reciters()}
                  value={reciterId()}
                  disabled={sessionLoading()}
                  onChange={(value) => void switchPlayerReciter(value)}
                />
              </Field>
              <div class="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
                <button
                  class={button}
                  disabled={
                    (group()?.chapter.id ?? 1) <= 1 || mode() === "quiz"
                  }
                  onClick={() =>
                    void switchPlayerSurah(group()!.chapter.id - 1)
                  }
                >
                  <Icon name="left" />
                </button>
                <CustomSelect
                  label={tr("currentSurah")}
                  value={group()?.chapter.id ?? 1}
                  disabled={mode() === "quiz"}
                  options={chapters().map((item) => ({
                    value: item.id,
                    label: `${localNumber(item.id)} — ${chapterName(item)}`,
                  }))}
                  onChange={(value) => void switchPlayerSurah(Number(value))}
                />
                <button
                  class={button}
                  disabled={
                    (group()?.chapter.id ?? 114) >= 114 || mode() === "quiz"
                  }
                  onClick={() =>
                    void switchPlayerSurah(group()!.chapter.id + 1)
                  }
                >
                  <Icon name="right" />
                </button>
              </div>
            </div>
            <Show when={mode() === "practice"}>
              <div class="mt-5 grid grid-cols-2 gap-2">
                <RepeatControl
                  label={tr("ayahRepeats")}
                  current={ayahRepeat()}
                  target={ayahRepeats()}
                  onDecrease={() => adjustAyahRepeats(-1)}
                  onIncrease={() => adjustAyahRepeats(1)}
                />
                <RepeatControl
                  label={tr("surahRepeat")}
                  current={surahRepeat()}
                  target={surahRepeats()}
                  onDecrease={() => adjustSurahRepeats(-1)}
                  onIncrease={() => adjustSurahRepeats(1)}
                />
                <Stat
                  label="selectionCycle"
                  value={`${cycle()} / ${cycles()}`}
                />
              </div>
            </Show>
            <Show when={mode() === "quiz"}>
              <div class="mt-5 flex justify-between rounded-xl border border-gold/20 bg-gold/5 p-3">
                <span class="text-xs text-muted">{tr("quizScore")}</span>
                <b>
                  {quizCorrect()} / {quizTotal()}
                </b>
              </div>
            </Show>
            <div class="mt-6">
              <div class="h-1 overflow-hidden rounded-full bg-ink/10">
                <i
                  class="block h-full bg-gold"
                  style={{
                    width: `${duration() ? Math.min(100, (currentTime() / duration()) * 100) : 0}%`,
                  }}
                />
              </div>
              <div class="mt-2 flex justify-between font-mono text-[0.625rem] text-muted">
                <span>{formatTime(currentTime())}</span>
                <span>{formatTime(duration())}</span>
              </div>
            </div>
            <div class="my-6 flex items-center justify-center gap-4">
              <button
                class="grid size-11 place-items-center rounded-full border border-hairline transition hover:border-accent/45 hover:text-accent active:scale-[.96]"
                disabled={mode() === "quiz"}
                aria-label={tr("previousAyah")}
                onClick={() => {
                  if (verseIndex() > 0) {
                    setVerseIndex((v) => v - 1);
                    void playCurrent(true);
                  }
                }}
              >
                <Icon name="left" />
              </button>
              <button
                class="grid size-16 place-items-center rounded-full bg-gold text-[#122019] shadow-[0_12px_30px_rgba(216,184,114,.14)] transition hover:bg-gold-bright active:scale-[.97]"
                aria-label={tr(playing() ? "pause" : "play")}
                onClick={() => (playing() ? audio.pause() : void playCurrent())}
              >
                <Icon name={playing() ? "pause" : "play"} class="size-6" />
              </button>
              <button
                class="grid size-11 place-items-center rounded-full border border-hairline transition hover:border-accent/45 hover:text-accent active:scale-[.96]"
                disabled={mode() === "quiz"}
                aria-label={tr("nextAyah")}
                onClick={() => {
                  if (verseIndex() + 1 < (group()?.verses.length ?? 0)) {
                    setVerseIndex((v) => v + 1);
                    void playCurrent(true);
                  }
                }}
              >
                <Icon name="right" />
              </button>
            </div>
            <p class="min-h-5 text-center text-xs text-muted">
              {playbackMessage()}
            </p>
          </aside>
        </div>
      </section>
    );
  }
  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds)) return "0:00";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }
}

const root = document.getElementById("root");
if (root) render(() => <App />, root);
