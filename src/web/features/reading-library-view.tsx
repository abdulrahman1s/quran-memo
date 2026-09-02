import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import type { ReadingProgress } from "../bookmarks.ts";
import { Hero, Icon, styles, type Translator } from "../components/ui.tsx";
import { EmptyState, ErrorState, Skeleton } from "../components/feedback.tsx";
import type { Language } from "../i18n.ts";
import { quranNumber } from "../reading.ts";
import type { Chapter } from "../web-types.ts";

export function ReadingLibraryView(props: {
  tr: Translator;
  language: Language;
  chapters: Chapter[];
  progress?: ReadingProgress;
  catalogReady: boolean;
  catalogError: boolean;
  bookmarkIds: Set<string>;
  retry(): void;
  open(chapterId: number, pageNumber?: number): void;
  toggleBookmark(chapter: Chapter): void;
}) {
  const [search, setSearch] = createSignal("");
  const [menuChapter, setMenuChapter] = createSignal<Chapter>();
  const visible = createMemo(() => {
    const query = search().trim().toLocaleLowerCase();
    return props.chapters.filter(
      (chapter) =>
        !query ||
        String(chapter.id).includes(query) ||
        chapter.nameSimple.toLocaleLowerCase().includes(query) ||
        chapter.nameArabic.includes(query),
    );
  });
  const lastChapter = () =>
    props.chapters.find((chapter) => chapter.id === props.progress?.chapterId);
  const name = (chapter: Chapter) =>
    props.language === "ar" ? chapter.nameArabic : chapter.nameSimple;

  const SurahCard = (cardProps: { chapter: Chapter }) => {
    let holdTimer: number | undefined;
    let held = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    const cancelHold = () => {
      clearTimeout(holdTimer);
      holdTimer = undefined;
    };
    const showMenu = () => {
      held = true;
      setMenuChapter(cardProps.chapter);
      navigator.vibrate?.(12);
    };
    onCleanup(cancelHold);
    return (
      <button
        type="button"
        class={`reading-library-surah grid min-h-[74px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3.5 py-3 text-start transition active:scale-[.99] ${props.progress?.chapterId === cardProps.chapter.id ? "border-gold/30 bg-gold/[.06]" : "border-white/10 bg-paper/45 hover:border-gold/25"}`}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          held = false;
          moved = false;
          startX = event.clientX;
          startY = event.clientY;
          cancelHold();
          holdTimer = window.setTimeout(showMenu, 520);
        }}
        onPointerMove={(event) => {
          if (
            Math.abs(event.clientX - startX) > 10 ||
            Math.abs(event.clientY - startY) > 10
          ) {
            moved = true;
            cancelHold();
          }
        }}
        onPointerUp={cancelHold}
        onPointerCancel={() => {
          moved = true;
          cancelHold();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          cancelHold();
          showMenu();
        }}
        onClick={(event) => {
          cancelHold();
          if (held || moved) {
            event.preventDefault();
            event.stopPropagation();
            held = false;
            moved = false;
            return;
          }
          props.open(cardProps.chapter.id);
        }}
      >
        <span class="grid size-[38px] place-items-center rounded-lg border border-gold/20 font-mono text-xs text-gold">
          {quranNumber(cardProps.chapter.id)}
        </span>
        <span class="min-w-0">
          <b class="block truncate text-sm text-ink">
            {name(cardProps.chapter)}
          </b>
          <small class="mt-1 block text-[0.625rem] text-muted">
            {quranNumber(cardProps.chapter.versesCount)} {props.tr("ayahs")}
          </small>
        </span>
        <Icon
          name={
            props.bookmarkIds.has(`surah:${cardProps.chapter.id}`)
              ? "bookmark"
              : "right"
          }
          class={`size-4 ${props.bookmarkIds.has(`surah:${cardProps.chapter.id}`) ? "text-gold" : "text-muted rtl:rotate-180"}`}
        />
      </button>
    );
  };

  return (
    <section class="mx-auto w-[min(1040px,100%)] animate-enter py-12 max-md:py-8">
      <Hero
        tr={props.tr}
        eyebrow="readingEyebrow"
        title="readingLibraryTitle"
        description="readingLibraryDescription"
      />
      <Show when={props.catalogError}>
        <ErrorState
          tr={props.tr}
          message="catalogFailed"
          onRetry={props.retry}
        />
      </Show>
      <Show when={!props.catalogReady && !props.catalogError}>
        <div class={`${styles.panel} grid gap-3 p-6`}>
          <Skeleton class="h-24 w-full" />
          <Skeleton class="h-12 w-full" />
          <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <For each={Array.from({ length: 8 })}>
              {() => <Skeleton class="h-[74px] w-full" />}
            </For>
          </div>
        </div>
      </Show>
      <Show when={props.catalogReady && !props.catalogError}>
        <Show when={lastChapter()}>
          {(chapter) => (
            <button
              type="button"
              class="mb-5 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-gold/25 bg-gold/[.07] p-5 text-start transition hover:border-gold/45 hover:bg-gold/10 active:scale-[.995] max-sm:p-4"
              onClick={() =>
                props.open(chapter().id, props.progress?.pageNumber)
              }
            >
              <span class="grid size-12 place-items-center rounded-xl bg-gold text-[#132019]">
                <Icon name="book" class="size-5" />
              </span>
              <span class="min-w-0">
                <small class="block text-[0.625rem] font-bold tracking-wider text-gold uppercase rtl:tracking-normal">
                  {props.tr("continueReading")}
                </small>
                <b class="mt-1 block truncate text-base text-ink">
                  {name(chapter())}
                </b>
                <span class="mt-1 block text-[0.6875rem] text-muted">
                  {props.progress?.pageNumber
                    ? props.tr("mushafPage", {
                        page: quranNumber(props.progress.pageNumber),
                      })
                    : props.tr("surahNumber", {
                        number: quranNumber(chapter().id),
                      })}
                </span>
              </span>
              <Icon name="right" class="size-5 rtl:rotate-180" />
            </button>
          )}
        </Show>
        <div class={`${styles.panel} p-5 max-sm:p-3.5`}>
          <div class="mb-4 flex items-center justify-between gap-4 max-sm:items-start">
            <div>
              <h2 class="font-serif text-xl text-ink rtl:font-arabic">
                {props.tr("allSurahs")}
              </h2>
              <p class="mt-1 text-xs text-muted">
                {props.tr("chooseReadingSurah")}
              </p>
            </div>
            <span class="shrink-0 font-mono text-xs text-gold">
              {quranNumber(props.chapters.length)}
            </span>
          </div>
          <label class="relative mb-4 block">
            <Icon
              name="search"
              class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted rtl:right-3.5 rtl:left-auto"
            />
            <input
              type="search"
              class={`${styles.field} ps-10`}
              value={search()}
              placeholder={props.tr("searchSurahs")}
              aria-label={props.tr("searchSurahs")}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
          </label>
          <Show
            when={visible().length}
            fallback={
              <EmptyState
                tr={props.tr}
                icon="search"
                title="noSearchResults"
                hint="noSearchResultsHint"
                compact
              />
            }
          >
            <div class="reading-library-list grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              <For each={visible()}>
                {(chapter) => <SurahCard chapter={chapter} />}
              </For>
            </div>
          </Show>
        </div>
      </Show>
      <Show when={menuChapter()}>
        {(chapter) => (
          <Portal>
            <div
              class="fixed inset-0 z-[100] grid items-end bg-black/60 p-3 backdrop-blur-[3px] md:place-items-center"
              onClick={() => setMenuChapter()}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label={props.tr("surahActions")}
                class="w-full max-w-[440px] animate-rise rounded-[22px] border border-white/12 bg-[#17251f] p-4 shadow-[0_30px_90px_rgba(0,0,0,.55)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15 md:hidden" />
                <div class="mb-4 flex items-center gap-3 px-1">
                  <span class="grid size-11 place-items-center rounded-xl border border-gold/25 font-mono text-sm text-gold">
                    {quranNumber(chapter().id)}
                  </span>
                  <div class="min-w-0 text-start">
                    <small class="block text-[0.625rem] font-bold tracking-wider text-gold uppercase rtl:tracking-normal">
                      {props.tr("surahActions")}
                    </small>
                    <b class="mt-1 block truncate text-base text-ink">
                      {name(chapter())}
                    </b>
                  </div>
                </div>
                <div class="grid gap-2">
                  <button
                    type="button"
                    class={styles.primary}
                    onClick={() => {
                      props.toggleBookmark(chapter());
                      setMenuChapter();
                    }}
                  >
                    <Icon name="bookmark" class="size-4" />
                    {props.tr(
                      props.bookmarkIds.has(`surah:${chapter().id}`)
                        ? "removeSavedSurah"
                        : "saveSurah",
                    )}
                  </button>
                  <button
                    type="button"
                    class={styles.button}
                    onClick={() => {
                      setMenuChapter();
                      props.open(chapter().id);
                    }}
                  >
                    <Icon name="book" class="size-4" />
                    {props.tr("openSurah")}
                  </button>
                  <button
                    type="button"
                    class={`${styles.button} border-transparent text-muted`}
                    onClick={() => setMenuChapter()}
                  >
                    {props.tr("cancel")}
                  </button>
                </div>
              </section>
            </div>
          </Portal>
        )}
      </Show>
    </section>
  );
}
