import { Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  CustomSelect,
  Icon,
  styles,
  type Translator,
} from "../components/ui.tsx";
import {
  groupReadingPages,
  quranNumber,
  readingPageIndexForVerse,
} from "../reading.ts";
import type { Chapter, ReadingPayload } from "../web-types.ts";
import { Basmala, MushafPage, MushafText } from "./mushaf-page.tsx";

interface ReadingViewProps {
  tr: Translator;
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
  reciterOptions: Array<{ value: number; label: string }>;
  changeReciter(value: number): void;
  toggleAudio(): void;
  previousAudio(): void;
  nextAudio(): void;
  closeAudio(): void;
}

export function ReadingView(props: ReadingViewProps) {
  const [pageIndex, setPageIndex] = createSignal(0);
  const [continuous, setContinuous] = createSignal(false);
  const pages = createMemo(() =>
    groupReadingPages(props.payload?.verses ?? []),
  );
  const page = () => pages()[pageIndex()];
  let reader!: HTMLElement;
  const formatTime = (seconds: number) =>
    Number.isFinite(seconds)
      ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
      : "0:00";

  createEffect(() => {
    props.chapterId;
    setPageIndex(0);
    setContinuous(false);
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

  function showPages(): void {
    props.pauseScroll();
    setContinuous(false);
    requestAnimationFrame(() =>
      reader?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <section
      class={`mx-auto w-[min(1040px,100%)] animate-enter py-10 max-sm:py-7 ${props.audioVisible ? "max-md:pb-28" : ""}`}
    >
      <div class="grid gap-5">
        <div class="sticky top-3 z-20 grid grid-cols-[46px_minmax(180px,1fr)_46px_auto] items-center gap-2 rounded-2xl border border-white/10 bg-[#111c18]/95 p-2 shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-xl max-sm:grid-cols-[42px_minmax(0,1fr)_42px] max-sm:backdrop-blur-none">
          <button
            class="reading-nav-button"
            aria-label={props.tr("previousSurah")}
            disabled={props.chapterId <= 1}
            onClick={() => props.load(props.chapterId - 1)}
          >
            <Icon name="left" class="size-4 rtl:rotate-180" />
          </button>
          <CustomSelect
            label={props.tr("surah")}
            value={props.chapterId}
            disabled={!props.chapters.length}
            options={props.chapters.map((chapter) => ({
              value: chapter.id,
              label: `${quranNumber(chapter.id)} — ${props.chapterName(chapter)}`,
            }))}
            onChange={(value) => props.load(Number(value))}
          />
          <button
            class="reading-nav-button"
            aria-label={props.tr("nextSurah")}
            disabled={props.chapterId >= 114}
            onClick={() => props.load(props.chapterId + 1)}
          >
            <Icon name="right" class="size-4 rtl:rotate-180" />
          </button>
          <div class="flex flex-wrap gap-2 max-sm:col-span-3">
            <button
              class={`reading-mode-button ${props.audioPlaying ? "border-gold/35! text-gold!" : ""}`}
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
            <div class="min-w-[260px] flex-[1.8] max-sm:order-last max-sm:basis-full">
              <CustomSelect
                label={props.tr("reciter")}
                value={props.reciterId}
                options={props.reciterOptions}
                wrapSelected
                onChange={(value) => props.changeReciter(Number(value))}
              />
            </div>
            <Show when={continuous()}>
              <button class="reading-mode-button" onClick={showPages}>
                <Icon name="book" />
                <span class="max-md:hidden">{props.tr("pageView")}</span>
              </button>
            </Show>
            <button
              class={`reading-mode-button ${props.scrolling ? "border-gold/35! text-gold!" : ""}`}
              disabled={!props.payload}
              aria-pressed={props.scrolling}
              aria-label={props.tr(
                props.scrolling
                  ? "pauseAutoScroll"
                  : props.scrollComplete
                    ? "restartAutoScroll"
                    : "startAutoScroll",
              )}
              onClick={() =>
                continuous() && props.scrolling
                  ? props.pauseScroll()
                  : beginAutoScroll()
              }
            >
              <Icon name={props.scrolling ? "pause" : "scroll"} />
              <span>
                {props.tr(
                  props.scrolling
                    ? "pauseAutoScroll"
                    : props.scrollComplete
                      ? "restartAutoScroll"
                      : "startAutoScroll",
                )}
              </span>
            </button>
          </div>
        </div>
        <p class="hidden px-2 text-center text-[10px] text-muted max-md:block">
          {props.tr("holdForMeaning")}
        </p>
        <Show when={props.loading}>
          <div
            class={`${styles.panel} grid min-h-36 place-items-center text-muted`}
          >
            {props.tr("loadingReading")}
          </div>
        </Show>
        <Show when={props.error}>
          <div
            class={`${styles.panel} grid min-h-36 place-items-center gap-3 p-7 text-center text-danger`}
          >
            <p>{props.tr("readingUnavailable")}</p>
            <button
              class={styles.button}
              onClick={() => props.load(props.chapterId)}
            >
              {props.tr("retry")}
            </button>
          </div>
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
                        <p class="mt-2 text-[11px] text-muted" dir="auto">
                          {props.tr("juzAndHizb", {
                            juz: quranNumber(verse().juzNumber),
                            hizb: quranNumber(verse().hizbNumber),
                          })}
                        </p>
                      )}
                    </Show>
                    <div class="mx-auto mt-4 flex w-20 items-center gap-2 text-gold/55">
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
          class="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 hidden overflow-hidden rounded-[20px] border border-white/12 bg-[#16241e]/97 shadow-[0_18px_55px_rgba(0,0,0,.5)] backdrop-blur-xl max-md:block"
          dir="auto"
        >
          <div class="h-[3px] bg-white/8">
            <span
              class="block h-full bg-gold transition-[width]"
              style={{
                width: `${props.audioDuration ? Math.min(100, (props.audioTime / props.audioDuration) * 100) : 0}%`,
              }}
            />
          </div>
          <div class="grid min-h-[74px] grid-cols-[minmax(0,1fr)_36px_50px_36px_28px] items-center gap-1 px-3">
            <div class="min-w-0 text-start">
              <b class="block truncate text-[12px] text-ink">
                {props.payload?.chapter.nameArabic}
              </b>
              <span class="mt-0.5 block truncate text-[9px] text-muted">
                {props.reciterName} · {props.audioAyah + 1}/
                {props.payload?.verses.length ?? 0} ·{" "}
                {formatTime(props.audioTime)}
              </span>
            </div>
            <button
              class="mushaf-player-control"
              disabled={props.audioAyah <= 0}
              aria-label={props.tr("previousAyah")}
              onClick={props.previousAudio}
            >
              <Icon name="left" class="size-4 rtl:rotate-180" />
            </button>
            <button
              class="grid size-11 place-items-center rounded-full bg-gold text-[#132019] shadow-[0_8px_22px_rgba(216,184,114,.2)]"
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
              class="grid size-7 place-items-center text-muted"
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
