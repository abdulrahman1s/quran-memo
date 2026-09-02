import { For, Show, onCleanup } from "solid-js";
import { Icon, type Translator } from "../components/ui.tsx";
import { quranNumber } from "../reading.ts";
import type { ReadingPayload } from "../web-types.ts";

type ReadingVerse = ReadingPayload["verses"][number];

interface MushafTextProps {
  tr: Translator;
  verses: ReadingVerse[];
  numberOffset?: number;
  activeWord?: string;
  boxHighlight?: boolean;
  playWord?(verse: ReadingVerse, position: number): void;
  inspectWord?(verse: ReadingVerse, position: number): void;
  seekWord?(verse: ReadingVerse, position: number): void;
  seekAyah?(verse: ReadingVerse): void;
}

function MushafWord(props: {
  tr: Translator;
  verse: ReadingVerse;
  word: ReadingVerse["words"][number];
  active: boolean;
  boxHighlight?: boolean;
  play?(): void;
  inspect?(): void;
  seek?(): void;
}) {
  let holdTimer: number | undefined;
  let clickTimer: number | undefined;
  let held = false;
  let startX = 0;
  let startY = 0;
  const cancelHold = () => {
    if (holdTimer !== undefined) clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const cancelClick = () => {
    if (clickTimer !== undefined) clearTimeout(clickTimer);
    clickTimer = undefined;
  };
  onCleanup(() => {
    cancelHold();
    cancelClick();
  });
  return (
    <button
      type="button"
      class="mushaf-word"
      data-word-key={`${props.verse.verseKey}:${props.word.position}`}
      classList={{ active: props.active, box: props.boxHighlight }}
      aria-label={props.tr("playFromWord", { word: props.word.text })}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        held = false;
        startX = event.clientX;
        startY = event.clientY;
        cancelClick();
        cancelHold();
        holdTimer = window.setTimeout(() => {
          held = true;
          props.inspect?.();
          navigator.vibrate?.(12);
        }, 520);
      }}
      onPointerMove={(event) => {
        if (
          Math.abs(event.clientX - startX) > 10 ||
          Math.abs(event.clientY - startY) > 10
        )
          cancelHold();
      }}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(event) => {
        event.preventDefault();
        cancelClick();
        cancelHold();
        held = true;
        props.inspect?.();
      }}
      onClick={(event) => {
        if (held) {
          event.preventDefault();
          held = false;
          return;
        }
        cancelClick();
        clickTimer = window.setTimeout(() => {
          clickTimer = undefined;
          props.play?.();
        }, 240);
      }}
      onDblClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        window.getSelection()?.removeAllRanges();
        cancelClick();
        cancelHold();
        props.seek?.();
      }}
    >
      {props.word.text}
    </button>
  );
}

function AyahMarker(props: { number: number }) {
  return (
    <span
      class="mushaf-ayah-marker"
      data-ayah-marker
      aria-label={String(props.number)}
    >
      <span aria-hidden="true">۝{quranNumber(props.number)}</span>
    </span>
  );
}

export function Basmala(props: { tr: Translator }) {
  return (
    <div class="basmala-opening text-center">
      <div class="flex items-center justify-center gap-2.5">
        <img
          src="/besmllah.svg"
          alt="بسم الله الرحمن الرحيم"
          class="basmala-mark h-auto w-[min(260px,72vw)]"
          width="220"
          height="45"
        />
      </div>
      <p class="mt-2 text-[0.8125rem] leading-6 text-muted" dir="auto">
        {props.tr("basmalaMeaning")}
      </p>
    </div>
  );
}

export function MushafText(props: MushafTextProps) {
  const verseNumber = (verseKey: string) => Number(verseKey.split(":")[1]) || 1;
  const wordKey = (verseKey: string, position: number) =>
    `${verseKey}:${position}`;

  return (
    <div class="arabic-reader mushaf-text text-ink">
      <For each={props.verses}>
        {(verse) => {
          const displayNumber = () =>
            Math.max(
              1,
              verseNumber(verse.verseKey) + (props.numberOffset ?? 0),
            );
          return (
            <span
              class="mushaf-verse"
              onDblClick={() => props.seekAyah?.(verse)}
            >
              <Show
                when={verse.words?.length}
                fallback={<>{verse.arabic.trim()}</>}
              >
                <For each={verse.words}>
                  {(word, index) => (
                    <>
                      <MushafWord
                        tr={props.tr}
                        verse={verse}
                        word={word}
                        active={
                          props.activeWord ===
                          wordKey(verse.verseKey, word.position)
                        }
                        boxHighlight={props.boxHighlight}
                        play={() => props.playWord?.(verse, word.position)}
                        inspect={() =>
                          props.inspectWord?.(verse, word.position)
                        }
                        seek={() => props.seekWord?.(verse, word.position)}
                      />
                      {index() < verse.words.length - 1 ? " " : ""}
                    </>
                  )}
                </For>
              </Show>
              {"\u00a0"}
              <AyahMarker number={displayNumber()} />{" "}
            </span>
          );
        }}
      </For>
    </div>
  );
}

interface MushafPageProps {
  tr: Translator;
  payload: ReadingPayload;
  verses: ReadingVerse[];
  pageIndex: number;
  pageCount: number;
  reader(element: HTMLElement): void;
  goToPage(index: number): void;
  activeWord?: string;
  boxHighlight?: boolean;
  playWord?(verse: ReadingVerse, position: number): void;
  inspectWord?(verse: ReadingVerse, position: number): void;
  seekWord?(verse: ReadingVerse, position: number): void;
  seekAyah?(verse: ReadingVerse): void;
}

export function MushafPage(props: MushafPageProps) {
  const opensSurah = () => props.pageIndex === 0;
  const hasBasmala = () => opensSurah() && props.payload.chapter.id !== 9;
  const pageVerses = () =>
    hasBasmala() && props.payload.chapter.id === 1
      ? props.verses.filter((verse) => verse.verseKey !== "1:1")
      : props.verses;
  const pageMetadata = () => props.verses[0];

  return (
    <article
      ref={props.reader}
      tabindex="0"
      aria-label={props.tr("pageOf", {
        current: props.pageIndex + 1,
        total: props.pageCount,
      })}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") props.goToPage(props.pageIndex + 1);
        if (event.key === "ArrowRight") props.goToPage(props.pageIndex - 1);
      }}
      class="reading-sheet scroll-mt-24 overflow-hidden"
      dir="rtl"
      lang="ar"
      translate="no"
    >
      <header class="px-6 pt-7 text-center max-sm:pt-5">
        <div class="flex items-center justify-between gap-4 text-[0.6875rem] text-muted">
          <p class="font-serif tracking-[.08em] text-gold" dir="ltr">
            {props.payload.chapter.nameSimple}
          </p>
          <Show when={pageMetadata()}>
            {(verse) => (
              <p dir="auto">
                {props.tr("juzAndHizb", {
                  juz: quranNumber(verse().juzNumber),
                  hizb: quranNumber(verse().hizbNumber),
                })}
              </p>
            )}
          </Show>
        </div>
        <h2 class="mt-1 font-arabic text-[clamp(24px,3vw,34px)] leading-normal font-semibold text-ink">
          {props.payload.chapter.nameArabic}
        </h2>
        <div class="mx-auto mt-4 flex w-20 items-center gap-2 text-gold/55">
          <span class="h-px flex-1 bg-current" />
          <span class="size-1.5 rotate-45 bg-current" />
          <span class="h-px flex-1 bg-current" />
        </div>
      </header>

      <div class="grid min-h-[650px] content-center px-[clamp(24px,7vw,84px)] py-[clamp(42px,7vw,78px)] max-sm:min-h-[500px]">
        <Show when={hasBasmala()}>
          <Basmala tr={props.tr} />
        </Show>
        <MushafText
          tr={props.tr}
          verses={pageVerses()}
          numberOffset={props.payload.chapter.id === 1 ? -1 : 0}
          activeWord={props.activeWord}
          boxHighlight={props.boxHighlight}
          playWord={props.playWord}
          inspectWord={props.inspectWord}
          seekWord={props.seekWord}
          seekAyah={props.seekAyah}
        />
      </div>

      <footer
        class="grid grid-cols-[1fr_auto_1fr] items-center border-t border-hairline px-5 py-4"
        dir="ltr"
      >
        <button
          type="button"
          class="reading-page-button justify-self-start"
          disabled={props.pageIndex <= 0}
          aria-label={props.tr("previousPage")}
          onClick={() => props.goToPage(props.pageIndex - 1)}
        >
          <Icon name="left" class="size-4" />
        </button>
        <span class="font-mono text-[0.8125rem] tracking-[.1em] text-muted max-sm:text-sm">
          {quranNumber(props.pageIndex + 1)} / {quranNumber(props.pageCount)}
        </span>
        <button
          type="button"
          class="reading-page-button justify-self-end"
          disabled={props.pageIndex >= props.pageCount - 1}
          aria-label={props.tr("nextPage")}
          onClick={() => props.goToPage(props.pageIndex + 1)}
        >
          <Icon name="right" class="size-4" />
        </button>
      </footer>
    </article>
  );
}
