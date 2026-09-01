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
  shouldRenderPlayer,
  urlForMainTab,
  urlForReadingChapter,
  type MainTab,
} from "./navigation.ts";
import { translate, type Language, type MessageKey } from "./i18n.ts";
import type {
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
import {
  SettingsView,
  type ArabicFont,
  type ReaderPreferences as Preferences,
} from "./features/settings-view.tsx";
import { ReadingView } from "./features/reading-view.tsx";
import { PracticeView as PracticeFeatureView } from "./features/practice-view.tsx";
import { PlayerMasthead } from "./features/player-masthead.tsx";
import { QuizPanel } from "./features/quiz-panel.tsx";

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
  arabicFont: "scheherazade",
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
  let toastTimer: number | undefined;

  const storedReading = Number(localStorage.getItem(READING_KEY));
  const [readingChapter, setReadingChapter] = createSignal(
    readingChapterFromUrl(
      new URL(location.href),
      storedReading >= 1 && storedReading <= 114 ? storedReading : 1,
    ),
  );
  const [reading, setReading] = createSignal<ReadingPayload>();
  const [readingLoading, setReadingLoading] = createSignal(false);
  const [readingError, setReadingError] = createSignal(false);
  const [readingWord, setReadingWord] = createSignal<string>();
  const [readingInsight, setReadingInsight] = createSignal<{
    word: ReadingPayload["verses"][number]["words"][number];
    verseKey: string;
  }>();
  const [readingInsightTafsir, setReadingInsightTafsir] = createSignal("");
  const [readingInsightLoading, setReadingInsightLoading] = createSignal(false);
  const [mushafAudioVisible, setMushafAudioVisible] = createSignal(false);
  const [mushafPlaying, setMushafPlaying] = createSignal(false);
  const [mushafAyah, setMushafAyah] = createSignal(0);
  const [mushafTime, setMushafTime] = createSignal(0);
  const [mushafDuration, setMushafDuration] = createSignal(0);
  const [autoScroll, setAutoScroll] = createSignal(false);
  const [autoScrollDone, setAutoScrollDone] = createSignal(false);
  let scrollFrame: number | undefined;
  let previousScrollTime: number | undefined;

  const rawPreferences = loadJson<Partial<Preferences>>(READER_KEY, {});
  const [preferences, setPreferences] = createSignal<Preferences>({
    arabicFont: ["noto", "amiri", "scheherazade", "system"].includes(
      rawPreferences.arabicFont ?? "",
    )
      ? rawPreferences.arabicFont!
      : "scheherazade",
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
  let delayTimer: number | undefined;
  let readingWordTimer: number | undefined;
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

  const chapters = () => catalog()?.chapters ?? [];
  const reciters = () => catalog()?.reciters ?? [];
  const tafsirs = () => catalog()?.tafsirs ?? [];
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
    setToast({ text, error });
    toastTimer = window.setTimeout(() => setToast(), 4000);
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
    if (historyMode !== "none")
      history[`${historyMode}State`](
        null,
        "",
        next === "reading"
          ? urlForReadingChapter(location.href, readingChapter())
          : urlForMainTab(location.href, next),
      );
    if (next === "reading") void loadReading(readingChapter(), false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function loadReading(
    chapterId: number,
    updateUrl = true,
  ): Promise<void> {
    const chapter = chapters().find((item) => item.id === chapterId);
    if (!chapter) return;
    const request = ++readingRequest;
    const requestedReciter = reciterId();
    setReadingChapter(chapterId);
    localStorage.setItem(READING_KEY, String(chapterId));
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
        urlForReadingChapter(location.href, chapterId),
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

  async function inspectReadingWord(
    verse: ReadingPayload["verses"][number],
    position: number,
  ): Promise<void> {
    const word = verse.words.find((item) => item.position === position);
    if (!word) return;
    setReadingInsight({ word, verseKey: verse.verseKey });
    await loadReadingInsightTafsir(verse.verseKey);
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
    if (mushafAudio) {
      mushafAudio.pause();
      if (removeSource) {
        mushafAudio.removeAttribute("src");
        mushafAudio.load();
      }
    }
    setMushafPlaying(false);
    setMushafTime(0);
    setMushafDuration(0);
    if (hide) setMushafAudioVisible(false);
  }

  async function playMushafAyah(index = mushafAyah()): Promise<void> {
    const verses = reading()?.verses ?? [];
    const next = Math.min(verses.length - 1, Math.max(0, index));
    const verse = verses[next];
    if (!verse || !mushafAudio) return;
    stopReadingWord();
    setMushafPlaying(false);
    setMushafTime(0);
    setMushafDuration(0);
    setMushafAyah(next);
    setMushafAudioVisible(true);
    const source = new URL(verse.audioUrl, location.href).href;
    if (mushafAudio.src !== source) {
      mushafAudio.src = verse.audioUrl;
      mushafAudio.load();
    }
    try {
      mushafAudio.currentTime = 0;
    } catch {
      /* A freshly loaded media element already starts at zero. */
    }
    mushafAudio.playbackRate = preferences().playbackSpeed / 100;
    try {
      await mushafAudio.play();
      setMushafPlaying(true);
      preloadNextMushafAyah(next);
    } catch {
      setMushafPlaying(false);
      notify(tr("playbackFailed"), true);
    }
  }

  function preloadNextMushafAyah(index: number): void {
    const nextVerse = reading()?.verses[index + 1];
    if (!nextVerse || !standbyAudio) return;
    const source = new URL(nextVerse.audioUrl, location.href).href;
    if (standbyAudio.src === source) return;
    standbyAudio.src = nextVerse.audioUrl;
    standbyAudio.load();
  }

  function toggleMushafAudio(): void {
    if (mushafPlaying()) {
      mushafAudio.pause();
      setMushafPlaying(false);
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
    mushafAudio.playbackRate = preferences().playbackSpeed / 100;
    void mushafAudio
      .play()
      .then(() => {
        setMushafPlaying(true);
        preloadNextMushafAyah(mushafAyah());
      })
      .catch(() => {
        setMushafPlaying(false);
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
    const wasPlaying = mushafPlaying();
    const ayah = mushafAyah();
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
          wordTimings: refreshed.wordTimings,
        };
      });
      setReading({ ...current, verses });
      readingAudioReciterId = next;
      setMushafAyah(Math.min(ayah, Math.max(0, verses.length - 1)));
      setMushafAudioVisible(wasVisible);
      if (wasPlaying) await playMushafAyah(mushafAyah());
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
    await playMushafAyah(index);
    const start = Math.max(0, startMs / 1000);
    if (mushafAudio) mushafAudio.currentTime = start;
    setMushafTime(start);
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
  async function downloadSelected(): Promise<void> {
    if (!("caches" in window)) {
      notify(tr("offlineUnsupported"), true);
      return;
    }
    const ids = [...offlineSelected()];
    if (!ids.length || downloadProgress()) return;
    try {
      const payload = await requestSession(ids, offlineReciter());
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
        next[offlineKey(group.chapter.id, offlineReciter())] = {
          chapterId: group.chapter.id,
          reciterId: offlineReciter(),
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
  async function playCurrent(force = false): Promise<void> {
    const verse = currentVerse();
    if (!verse) return;
    setQuizChoices([]);
    setQuizAnswer();
    setQuizFinished(false);
    setPlaybackMessage(tr("loadingAudio"));
    if (force || audio.src !== new URL(verse.audioUrl, location.href).href) {
      audio.src = verse.audioUrl;
      audio.load();
    }
    audio.playbackRate = preferences().playbackSpeed / 100;
    try {
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
    const source = new URL(verse.audioUrl, location.href).href;
    if (audio.src !== source) {
      audio.src = verse.audioUrl;
      audio.load();
    }
    audio.currentTime = start;
    setCurrentTime(start);
    await playCurrent();
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
    const activeChapter = currentGroup()?.chapter.id;
    const activeVerse = currentVerse()?.verseKey;
    const request = ++sessionRequest;
    stopPlayback();
    setReciterId(next);
    setSessionLoading(true);
    try {
      const payload = await requestSession(
        previousGroups.map((group) => group.chapter.id),
        next,
      );
      if (request !== sessionRequest) return;
      setSession(payload.groups);
      setQuizPool(payload.quizPool);
      const nextGroup = Math.max(
        0,
        payload.groups.findIndex((group) => group.chapter.id === activeChapter),
      );
      const nextVerse = Math.max(
        0,
        payload.groups[nextGroup]?.verses.findIndex(
          (verse) => verse.verseKey === activeVerse,
        ) ?? 0,
      );
      setGroupIndex(nextGroup);
      setVerseIndex(nextVerse);
      await playCurrent(true);
    } catch {
      notify(tr("sessionUnavailable"), true);
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

  onMount(() => {
    void getJson<CatalogPayload>("/api/catalog")
      .then((value) => {
        setCatalog({ ...value, tafsirs: value.tafsirs ?? [] });
        if (!shared.reciterId) setReciterId(value.defaultReciterId);
        setOfflineReciter(shared.reciterId ?? value.defaultReciterId);
        const preferred = preferredTafsir(language(), value.tafsirs ?? []);
        if (preferred) setTafsirId(preferred.id);
        if (tab() === "reading") void loadReading(readingChapter(), false);
        void refreshCacheSize();
      })
      .catch(() => setCatalogError(true));
    const popstate = () => {
      const next = mainTabFromUrl(new URL(location.href));
      stopPlayback();
      stopReadingWord(true);
      stopMushafAudio(true, true);
      pauseAutoScroll();
      setTab(next);
      if (next === "reading")
        void loadReading(
          readingChapterFromUrl(new URL(location.href), readingChapter()),
          false,
        );
    };
    const stopScroll = () => autoScroll() && pauseAutoScroll();
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
  const highlightedWord = createMemo(() =>
    activeWordPosition(currentVerse()?.wordTimings ?? [], currentTime() * 1000),
  );
  const mushafHighlightedWord = createMemo(() => {
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
      <div class="relative mx-auto w-[min(1380px,calc(100%-48px))] max-md:pb-[calc(76px+env(safe-area-inset-bottom))] max-sm:w-[calc(100%-24px)]">
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
                  <ReadingView
                    tr={tr}
                    chapters={chapters()}
                    chapterId={readingChapter()}
                    payload={reading()}
                    loading={readingLoading()}
                    error={readingError()}
                    scrolling={autoScroll()}
                    scrollComplete={autoScrollDone()}
                    load={(chapter) => void loadReading(chapter)}
                    startScroll={startAutoScroll}
                    pauseScroll={pauseAutoScroll}
                    chapterName={chapterName}
                    activeWord={readingWord() ?? mushafHighlightedWord()}
                    boxHighlight={preferences().wordHighlightStyle === "box"}
                    playWord={(verse, position) =>
                      void playReadingWord(verse, position)
                    }
                    inspectWord={(verse, position) =>
                      void inspectReadingWord(verse, position)
                    }
                    seekWord={(verse, position) =>
                      void seekMushafAudio(verse, position)
                    }
                    seekAyah={(verse) => void seekMushafAudio(verse)}
                    audioVisible={mushafAudioVisible()}
                    audioPlaying={mushafPlaying()}
                    audioAyah={mushafAyah()}
                    audioTime={mushafTime()}
                    audioDuration={mushafDuration()}
                    reciterName={
                      activeReciter() ? reciterName(activeReciter()!) : ""
                    }
                    reciterId={reciterId()}
                    reciterOptions={reciters().map((item) => ({
                      value: item.id,
                      label: reciterName(item),
                    }))}
                    changeReciter={(value) => void changeMushafReciter(value)}
                    toggleAudio={toggleMushafAudio}
                    previousAudio={() => void playMushafAyah(mushafAyah() - 1)}
                    nextAudio={() => void playMushafAyah(mushafAyah() + 1)}
                    closeAudio={() => stopMushafAudio(true, true)}
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
        <footer class="flex min-h-[90px] items-center justify-between border-t border-white/10 text-[10px] tracking-wider text-[#6f7c75] uppercase max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:gap-2">
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
            onClick={() => {
              readingInsightRequest += 1;
              setReadingInsight();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label={tr("wordMeaning")}
              class="w-full max-w-[560px] animate-rise rounded-[24px] border border-white/12 bg-[#17251f] p-5 shadow-[0_30px_90px_rgba(0,0,0,.55)] max-md:rounded-b-[18px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 md:hidden" />
              <header class="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <span class="text-[10px] font-bold tracking-wider text-gold uppercase">
                    {tr("wordMeaning")}
                  </span>
                  <strong class="font-reader-arabic mt-1 block text-[36px] leading-normal text-ink">
                    {insight().word.text}
                  </strong>
                  <p class="mt-1 text-sm text-[#cbd5cf]" dir="ltr">
                    {insight().word.meaning ?? "—"}
                  </p>
                </div>
                <button
                  class="grid size-9 place-items-center rounded-full border border-white/10 text-muted"
                  aria-label={tr("closePlayer")}
                  onClick={() => {
                    readingInsightRequest += 1;
                    setReadingInsight();
                  }}
                >
                  <Icon name="close" class="size-4" />
                </button>
              </header>
              <div class="pt-4">
                <div class="flex items-center justify-between gap-4">
                  <b class="text-xs text-gold">{tr("ayahTafsir")}</b>
                  <span class="font-mono text-[10px] text-muted">
                    {insight().verseKey}
                  </span>
                </div>
                <div class="mt-3">
                  <CustomSelect
                    label={tr("tafsir")}
                    value={tafsirId()}
                    options={tafsirs().map((item) => ({
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
                <p
                  class="tafsir-reader memo-scrollbar mt-3 max-h-[38dvh] overflow-auto text-start leading-8 whitespace-pre-line text-[#bdc9c2]"
                  dir="auto"
                >
                  {readingInsightLoading()
                    ? tr("loadingTafsir")
                    : readingInsightTafsir() || tr("chooseTafsir")}
                </p>
              </div>
            </section>
          </div>
        )}
      </Show>
      <Show when={toast()}>
        {(value) => (
          <div
            role="status"
            class={`fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 animate-rise rounded-xl border px-5 py-3 text-sm shadow-2xl max-md:bottom-[calc(84px+env(safe-area-inset-bottom))] ${value().error ? "border-danger/50 bg-[#3a211f] text-[#ffd6d0]" : "border-white/15 bg-[#21332a]"}`}
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
        ref={mushafAudio}
        preload="metadata"
        onEnded={() => {
          const next = mushafAyah() + 1;
          if (next < (reading()?.verses.length ?? 0)) void playMushafAyah(next);
          else {
            stopMushafAudio();
            if (autoScroll()) pauseAutoScroll();
          }
        }}
        onPlaying={() => setMushafPlaying(true)}
        onPause={() => setMushafPlaying(false)}
        onTimeUpdate={() => {
          setMushafTime(mushafAudio.currentTime);
          setMushafDuration(
            Number.isFinite(mushafAudio.duration) ? mushafAudio.duration : 0,
          );
        }}
      />
    </>
  );

  function DownloadsView() {
    const downloadedCount = () => Object.keys(offlineManifest()).length;
    return (
      <section class="animate-enter py-[76px] max-sm:py-12">
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
              <CustomSelect
                label={tr("reciter")}
                value={offlineReciter()}
                options={reciters().map((item) => ({
                  value: item.id,
                  label: reciterName(item),
                }))}
                onChange={(value) => setOfflineReciter(Number(value))}
              />
            </Field>
            <div class="my-5 rounded-2xl border border-white/10 bg-white/[.025] p-4">
              <b class="block">
                {downloadedCount()
                  ? tr("offlineCount", { count: downloadedCount() })
                  : tr("noOfflineDownloads")}
              </b>
              <small class="mt-1 block text-muted">
                {tr("offlineStorageNote")}
              </small>
            </div>
            <div class="grid grid-cols-2 gap-2 text-center">
              <div class="rounded-xl border border-white/10 p-3">
                <small class="block text-muted">{tr("downloadSize")}</small>
                <b class="mt-1 block text-gold">
                  {formatBytes(selectedDownloadSize())}
                </b>
              </div>
              <div class="rounded-xl border border-white/10 p-3">
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
            <SurahList
              items={offlineVisible()}
              values={offlineSelected()}
              reciter={offlineReciter()}
              onToggle={(id) => toggleSelection(id, true)}
            />
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
                    class={`arabic-reader leading-[2] text-[#f7f3e9] ${memorization() === "hidden" ? "text-[20px]! text-muted" : ""}`}
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
                    <div class="mx-auto mb-4 flex w-fit gap-1 rounded-xl border border-white/10 p-1">
                      <button
                        class={`rounded-lg px-4 py-2 text-xs ${studyTab() === "translation" ? "bg-gold font-bold text-[#172019]" : "text-muted"}`}
                        onClick={() => setStudyTab("translation")}
                      >
                        {tr("translation")}
                      </button>
                      <button
                        class={`rounded-lg px-4 py-2 text-xs ${studyTab() === "tafsir" ? "bg-gold font-bold text-[#172019]" : "text-muted"}`}
                        onClick={() => setStudyTab("tafsir")}
                      >
                        {tr("tafsir")}
                      </button>
                    </div>
                    <Show when={studyTab() === "translation"}>
                      <p
                        class="font-serif text-[clamp(16px,1.6vw,21px)] leading-7 text-[#bbc6bf]"
                        dir="ltr"
                      >
                        {verse()!.translation}
                      </p>
                    </Show>
                    <Show when={studyTab() === "tafsir"}>
                      <div class="mx-auto mb-3 max-w-[500px]">
                        <CustomSelect
                          label={tr("tafsir")}
                          value={tafsirId()}
                          options={tafsirs().map((item) => ({
                            value: item.id,
                            label:
                              language() === "ar"
                                ? item.nameArabic
                                : item.nameEnglish,
                          }))}
                          onChange={(value) => setTafsirId(Number(value))}
                        />
                      </div>
                      <p class="tafsir-reader memo-scrollbar max-h-[250px] overflow-auto text-start leading-8 whitespace-pre-line text-[#bbc6bf]">
                        {tafsirLoading()
                          ? tr("loadingTafsir")
                          : tafsirText() || tr("chooseTafsir")}
                      </p>
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
            <div class="mt-5 grid gap-3 border-t border-white/10 pt-5">
              <Field label="playerReciter">
                <CustomSelect
                  label={tr("playerReciter")}
                  value={reciterId()}
                  disabled={sessionLoading()}
                  options={reciters().map((item) => ({
                    value: item.id,
                    label: reciterName(item),
                  }))}
                  onChange={(value) => void switchPlayerReciter(Number(value))}
                />
              </Field>
              <div class="grid grid-cols-[38px_minmax(0,1fr)_38px] gap-2">
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
              <div class="h-1 overflow-hidden rounded-full bg-white/10">
                <i
                  class="block h-full bg-gold"
                  style={{
                    width: `${duration() ? Math.min(100, (currentTime() / duration()) * 100) : 0}%`,
                  }}
                />
              </div>
              <div class="mt-2 flex justify-between font-mono text-[10px] text-muted">
                <span>{formatTime(currentTime())}</span>
                <span>{formatTime(duration())}</span>
              </div>
            </div>
            <div class="my-6 flex items-center justify-center gap-4">
              <button
                class="grid size-11 place-items-center rounded-full border border-white/15"
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
                class="grid size-16 place-items-center rounded-full bg-gold text-[#122019]"
                aria-label={tr(playing() ? "pause" : "play")}
                onClick={() => (playing() ? audio.pause() : void playCurrent())}
              >
                <Icon name={playing() ? "pause" : "play"} class="size-6" />
              </button>
              <button
                class="grid size-11 place-items-center rounded-full border border-white/15"
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
