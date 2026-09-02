import { Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  CustomSelect,
  Icon,
  styles,
  type Translator,
} from "../components/ui.tsx";
import { ReciterPicker } from "../components/reciter-picker.tsx";
import { ErrorState, Skeleton } from "../components/feedback.tsx";
import type { Language } from "../i18n.ts";
import {
  groupReadingPages,
  quranNumber,
  readingPageIndexForVerse,
} from "../reading.ts";
import type { Chapter, ReadingPayload, Reciter } from "../web-types.ts";
import { Basmala, MushafPage, MushafText } from "./mushaf-page.tsx";

interface ReadingViewProps {
  tr: Translator;
  language: Language;
  chapters: Chapter[];
  chapterId: number;
  payload?: ReadingPayload;
  loading: boolean;
  error: boolean;
  scrolling: boolean;
  scrollComplete: boolean;
  load(chapter: number): void;
  startScroll(): void;
  pauseScroll(): void;
  chapterName(chapter: Chapter): string;
  activeWord?: string;
  boxHighlight: boolean;
  playWord(verse: ReadingPayload["verses"][number], position: number): void;
  inspectWord(verse: ReadingPayload["verses"][number], position: number): void;
  seekWord(verse: ReadingPayload["verses"][number], position: number): void;
  seekAyah(verse: ReadingPayload["verses"][number]): void;
  audioVisible: boolean;
  audioPlaying: boolean;
  audioAyah: number;
  audioTime: number;
  audioDuration: number;
  reciterName: string;
  reciterId: number;
  reciters: Reciter[];
  changeReciter(value: number): void;
  toggleAudio(): void;
  previousAudio(): void;
  nextAudio(): void;
  closeAudio(): void;
}

interface SurahSelectProps {
  tr: Translator;
  chapters: Chapter[];
  chapterId: number;
  chapterName(chapter: Chapter): string;
  load(chapter: number): void;
}

function SurahSelect(props: SurahSelectProps) {
  return (
    <CustomSelect
      label={props.tr("surah")}
      value={props.chapterId}
      compact
      disabled={!props.chapters.length}
      options={props.chapters.map((chapter) => ({
        value: chapter.id,
        label: `${quranNumber(chapter.id)} — ${props.chapterName(chapter)}`,
      }))}
      onChange={(value) => props.load(Number(value))}
    />
  );
}

/** Prev / surah select / next — shared by the control bar and the mini player. */
function SurahNavigator(props: SurahSelectProps & { mini?: boolean }) {
  const buttonClass = props.mini
    ? "reading-player-mini-button"
    : "reading-nav-button";
  const iconClass = props.mini ? "size-3.5" : "size-4";
  return (
    <div
      class={
        props.mini
          ? "grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1.5"
          : "reading-surah-row grid grid-cols-[46px_minmax(180px,1fr)_46px] items-center gap-2 max-sm:grid-cols-[44px_minmax(0,1fr)_44px]"
      }
    >
      <button
        class={buttonClass}
        aria-label={props.tr("previousSurah")}
        disabled={props.chapterId <= 1}
        onClick={() => props.load(props.chapterId - 1)}
      >
        <Icon name="left" class={`${iconClass} rtl:rotate-180`} />
      </button>
      <SurahSelect {...props} />
      <button
        class={buttonClass}
        aria-label={props.tr("nextSurah")}
        disabled={props.chapterId >= 114}
        onClick={() => props.load(props.chapterId + 1)}
      >
        <Icon name="right" class={`${iconClass} rtl:rotate-180`} />
      </button>
    </div>
  );
}

export function ReadingView(props: ReadingViewProps) {
  const [pageIndex, setPageIndex] = createSignal(0);
  const [continuous, setContinuous] = createSignal(false);
  const [mobilePlayerExpanded, setMobilePlayerExpanded] = createSignal(false);
  const pages = createMemo(() =>
    groupReadingPages(props.payload?.verses ?? []),
  );
  const page = () => pages()[pageIndex()];
  let reader!: HTMLElement;
  const formatTime = (seconds: number) =>
    Number.isFinite(seconds)
      ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
      : "0:00";
  const scrollLabel = () =>
    props.tr(
      props.scrolling
        ? "pauseAutoScroll"
        : props.scrollComplete
          ? "restartAutoScroll"
          : "startAutoScroll",
    );
  const activeControl = "border-gold/45! bg-gold/10! text-gold-bright!";

  createEffect(() => {
    props.chapterId;
    setPageIndex(0);
    setContinuous(false);
    setMobilePlayerExpanded(false);
  });

  createEffect(() => {
    if (!props.audioVisible) setMobilePlayerExpanded(false);
  });

  createEffect(() => {
    if (!props.audioPlaying || props.scrolling) return;
    const verse = props.payload?.verses[props.audioAyah];
    if (!verse) return;
    const nextPage = readingPageIndexForVerse(pages(), verse.verseKey);
    if (nextPage < 0 || (!continuous() && nextPage === pageIndex())) return;
    setContinuous(false);
    setPageIndex(nextPage);
    requestAnimationFrame(() =>
      reader?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  });

  createEffect(() => {
    const wordKey = props.activeWord;
    if (!wordKey || !props.scrolling || !props.audioPlaying || !continuous())
      return;
    requestAnimationFrame(() => {
      if (!reader) return;
      const word = [
        ...reader.querySelectorAll<HTMLElement>("[data-word-key]"),
      ].find((element) => element.dataset.wordKey === wordKey);
      if (!word) return;
      const rect = word.getBoundingClientRect();
      const comfortableTop = window.innerHeight * 0.28;
      const comfortableBottom = window.innerHeight * 0.68;
      if (rect.top < comfortableTop || rect.bottom > comfortableBottom)
        word.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  function goToPage(next: number): void {
    setPageIndex(Math.min(pages().length - 1, Math.max(0, next)));
    reader?.focus({ preventScroll: true });
  }

  function beginAutoScroll(): void {
    props.startScroll();
    setContinuous(true);
  }

  function toggleScroll(): void {
    continuous() && props.scrolling ? props.pauseScroll() : beginAutoScroll();
  }

  function showPages(): void {
    props.pauseScroll();
    setContinuous(false);
    requestAnimationFrame(() =>
      reader?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function turnPage(next: number): void {
    props.pauseScroll();
    setContinuous(false);
    setPageIndex(Math.min(pages().length - 1, Math.max(0, next)));
    requestAnimationFrame(() =>
      reader?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  const PageReciterRow = () => (
    <div
      data-mobile-page-row
      class="reading-mobile-page-row grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-1"
    >
      <button
        class="reading-nav-button"
        aria-label={props.tr("previousPage")}
        disabled={pageIndex() <= 0}
        onClick={() => turnPage(pageIndex() - 1)}
      >
        <Icon name="left" class="size-3.5" />
      </button>
      <div class="reading-mobile-reciter min-w-0">
        <ReciterPicker
          tr={props.tr}
          language={props.language}
          reciters={props.reciters}
          value={props.reciterId}
          compact
          onChange={props.changeReciter}
        />
      </div>
      <button
        class="reading-nav-button"
        aria-label={props.tr("nextPage")}
        disabled={pageIndex() >= pages().length - 1}
        onClick={() => turnPage(pageIndex() + 1)}
      >
        <Icon name="right" class="size-3.5" />
      </button>
    </div>
  );

  const MobileSurahRow = (rowProps: { play: boolean }) => (
    <div
      data-mobile-surah-row
      class="reading-mobile-surah-row grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-1"
    >
      <Show when={rowProps.play} fallback={<span aria-hidden="true" />}>
        <button
          class={`reading-mode-button ${props.audioPlaying ? activeControl : ""}`}
          disabled={!props.payload}
          aria-label={props.tr(props.audioPlaying ? "pauseSurah" : "playSurah")}
          onClick={props.toggleAudio}
        >
          <Icon name={props.audioPlaying ? "pause" : "play"} />
        </button>
      </Show>
      <div class="reading-mobile-surah min-w-0">
        <SurahSelect
          tr={props.tr}
          chapters={props.chapters}
          chapterId={props.chapterId}
          chapterName={props.chapterName}
          load={props.load}
        />
      </div>
      <button
        class={`reading-mode-button reading-mobile-scroll-action ${props.scrolling ? activeControl : ""}`}
        disabled={!props.payload}
        aria-pressed={props.scrolling}
        aria-label={scrollLabel()}
        onClick={toggleScroll}
      >
        <Icon name={props.scrolling ? "pause" : "scroll"} class="size-3.5" />
      </button>
    </div>
  );

  return (
    <section
      class={`mx-auto w-[min(1040px,100%)] animate-enter py-10 max-md:pt-7 ${props.audioVisible ? (mobilePlayerExpanded() ? "max-md:pb-[250px]" : "max-md:pb-[150px]") : "max-md:pb-[175px]"}`}
    >
      <div class="grid gap-5">
        <div
          data-reading-toolbar
          class="sticky top-3 z-20 rounded-2xl border border-white/10 bg-[rgba(14,25,21,.97)] p-2.5 shadow-[0_14px_40px_rgba(0,0,0,.3)] backdrop-blur-xl max-md:fixed max-md:inset-x-3 max-md:top-auto max-md:bottom-[calc(var(--bottom-nav-h)+12px)] max-md:z-[55] max-md:rounded-[16px] max-md:p-1"
          classList={{ "max-md:hidden": props.audioVisible }}
        >
          <div class="max-md:hidden">
            <SurahNavigator
              tr={props.tr}
              chapters={props.chapters}
              chapterId={props.chapterId}
              chapterName={props.chapterName}
              load={props.load}
            />
            <div class="reading-control-grid mt-1.5">
              <button
                class={`reading-mode-button reading-audio-action ${props.audioPlaying ? activeControl : ""}`}
                disabled={!props.payload}
                aria-label={props.tr(
                  props.audioPlaying ? "pauseSurah" : "playSurah",
                )}
                onClick={props.toggleAudio}
              >
                <Icon name={props.audioPlaying ? "pause" : "play"} />
                <span>
                  {props.tr(props.audioPlaying ? "pauseSurah" : "playSurah")}
                </span>
              </button>
              <div class="reading-reciter-control min-w-0">
                <ReciterPicker
                  tr={props.tr}
                  language={props.language}
                  reciters={props.reciters}
                  value={props.reciterId}
                  compact
                  onChange={props.changeReciter}
                />
              </div>
              <div class="reading-secondary-actions">
                <button
                  class="reading-mode-button reading-page-action"
                  classList={{ hidden: !continuous() }}
                  aria-hidden={!continuous()}
                  tabIndex={continuous() ? 0 : -1}
                  onClick={showPages}
                >
                  <Icon name="book" />
                  <span>{props.tr("pageView")}</span>
                </button>
                <button
                  class={`reading-mode-button reading-scroll-action ${props.scrolling ? activeControl : ""}`}
                  disabled={!props.payload}
                  aria-pressed={props.scrolling}
                  aria-label={scrollLabel()}
                  onClick={toggleScroll}
                >
                  <Icon name={props.scrolling ? "pause" : "scroll"} />
                  <span>{scrollLabel()}</span>
                </button>
              </div>
            </div>
          </div>
          <div class="hidden gap-1 max-md:grid">
            <PageReciterRow />
            <MobileSurahRow play />
          </div>
        </div>
        <p class="hidden px-2 text-center text-[0.625rem] text-muted max-md:block">
          {props.tr("holdForMeaning")}
        </p>
        <Show when={props.loading}>
          <div
            class={`${styles.panel} grid gap-4 px-[clamp(24px,7vw,84px)] py-[clamp(40px,6vw,72px)]`}
            aria-label={props.tr("loadingReading")}
            aria-busy="true"
          >
            <Skeleton class="mx-auto h-8 w-48" />
            <Skeleton class="mx-auto mt-6 h-5 w-full" />
            <Skeleton class="mx-auto h-5 w-[92%]" />
            <Skeleton class="mx-auto h-5 w-full" />
            <Skeleton class="mx-auto h-5 w-[85%]" />
            <Skeleton class="mx-auto h-5 w-[70%]" />
          </div>
        </Show>
        <Show when={props.error}>
          <ErrorState
            tr={props.tr}
            message="readingUnavailable"
            onRetry={() => props.load(props.chapterId)}
          />
        </Show>
        <Show when={!props.loading && !props.error && props.payload}>
          {(payload) => (
            <Show
              when={!continuous()}
              fallback={
                <article
                  ref={reader}
                  class="reading-sheet scroll-mt-24 px-[clamp(24px,7vw,84px)] py-[clamp(50px,8vw,96px)]"
                  dir="rtl"
                  lang="ar"
                  translate="no"
                >
                  <header class="mb-[clamp(42px,7vw,72px)] text-center">
                    <p
                      class="font-serif text-xs tracking-[.08em] text-gold"
                      dir="ltr"
                    >
                      {payload().chapter.nameSimple}
                    </p>
                    <h2 class="mt-1 font-arabic text-[clamp(28px,4vw,42px)] leading-normal font-semibold">
                      {payload().chapter.nameArabic}
                    </h2>
                    <Show when={payload().verses[0]}>
                      {(verse) => (
                        <p class="mt-2 text-[0.6875rem] text-muted" dir="auto">
                          {props.tr("juzAndHizb", {
                            juz: quranNumber(verse().juzNumber),
                            hizb: quranNumber(verse().hizbNumber),
                          })}
                        </p>
                      )}
                    </Show>
                    <div class="mx-auto mt-4 flex w-20 items-center gap-2 text-gold/70">
                      <span class="h-px flex-1 bg-current" />
                      <span class="size-1.5 rotate-45 bg-current" />
                      <span class="h-px flex-1 bg-current" />
                    </div>
                  </header>
                  <Show when={payload().chapter.id !== 9}>
                    <Basmala tr={props.tr} />
                  </Show>
                  <MushafText
                    tr={props.tr}
                    verses={
                      payload().chapter.id === 1
                        ? payload().verses.filter(
                            (verse) => verse.verseKey !== "1:1",
                          )
                        : payload().verses
                    }
                    numberOffset={payload().chapter.id === 1 ? -1 : 0}
                    activeWord={props.activeWord}
                    boxHighlight={props.boxHighlight}
                    playWord={props.playWord}
                    inspectWord={props.inspectWord}
                    seekWord={props.seekWord}
                    seekAyah={props.seekAyah}
                  />
                </article>
              }
            >
              <MushafPage
                tr={props.tr}
                payload={payload()}
                verses={page()?.verses ?? []}
                pageIndex={pageIndex()}
                pageCount={pages().length}
                reader={(element) => (reader = element)}
                goToPage={goToPage}
                activeWord={props.activeWord}
                boxHighlight={props.boxHighlight}
                playWord={props.playWord}
                inspectWord={props.inspectWord}
                seekWord={props.seekWord}
                seekAyah={props.seekAyah}
              />
            </Show>
          )}
        </Show>
      </div>
      <Show when={props.audioVisible}>
        <div
          data-mobile-audio-player
          class="reading-mobile-player fixed inset-x-3 bottom-[calc(var(--bottom-nav-h)+12px)] z-50 hidden overflow-hidden rounded-[18px] border border-white/10 bg-[#0e1915]/97 shadow-[0_18px_50px_rgba(0,0,0,.42)] backdrop-blur-xl max-md:block"
          dir={props.language === "ar" ? "rtl" : "ltr"}
        >
          <div class="h-[3px] bg-ink/8">
            <span
              class="block h-full bg-gold transition-[width]"
              style={{
                width: `${props.audioDuration ? Math.min(100, (props.audioTime / props.audioDuration) * 100) : 0}%`,
              }}
            />
          </div>
          <Show when={mobilePlayerExpanded()}>
            <div class="grid gap-1.5 border-b border-hairline bg-paper/70 p-2">
              <PageReciterRow />
              <MobileSurahRow play={false} />
            </div>
          </Show>
          <div class="grid min-h-[60px] grid-cols-[minmax(0,1fr)_40px_40px_44px_40px_36px] items-center gap-0.5 px-2">
            <div class="min-w-0 text-start">
              <b class="block truncate text-[0.75rem] text-ink">
                {props.payload ? props.chapterName(props.payload.chapter) : ""}
              </b>
              <span class="mt-0.5 block truncate text-[0.5625rem] text-muted">
                {props.reciterName} · {props.audioAyah + 1}/
                {props.payload?.verses.length ?? 0} ·{" "}
                {formatTime(props.audioTime)}
              </span>
            </div>
            <button
              class={`grid size-11 place-items-center rounded-lg border transition ${mobilePlayerExpanded() ? "border-gold/45 bg-gold/10 text-gold" : "border-white/10 text-muted"}`}
              aria-label={props.tr(
                mobilePlayerExpanded()
                  ? "hidePlayerOptions"
                  : "showPlayerOptions",
              )}
              aria-expanded={mobilePlayerExpanded()}
              onClick={() => setMobilePlayerExpanded((value) => !value)}
            >
              <Icon name="settings" class="size-3.5" />
            </button>
            <button
              class="mushaf-player-control"
              disabled={props.audioAyah <= 0}
              aria-label={props.tr("previousAyah")}
              onClick={props.previousAudio}
            >
              <Icon name="left" class="size-4 rtl:rotate-180" />
            </button>
            <button
              class="grid size-11 place-items-center rounded-full bg-gold text-[#122019] shadow-[0_8px_22px_rgba(216,184,114,.16)] transition active:scale-95"
              aria-label={props.tr(
                props.audioPlaying ? "pauseSurah" : "playSurah",
              )}
              onClick={props.toggleAudio}
            >
              <Icon
                name={props.audioPlaying ? "pause" : "play"}
                class="size-5"
              />
            </button>
            <button
              class="mushaf-player-control"
              disabled={
                props.audioAyah >= (props.payload?.verses.length ?? 1) - 1
              }
              aria-label={props.tr("nextAyah")}
              onClick={props.nextAudio}
            >
              <Icon name="right" class="size-4 rtl:rotate-180" />
            </button>
            <button
              class="grid size-9 place-items-center text-muted"
              aria-label={props.tr("closePlayer")}
              onClick={props.closeAudio}
            >
              <Icon name="close" class="size-3.5" />
            </button>
          </div>
        </div>
      </Show>
    </section>
  );
}
