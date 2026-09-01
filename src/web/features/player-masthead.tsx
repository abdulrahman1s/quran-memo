import type { Translator } from "../components/ui.tsx";
import type { Chapter, Verse } from "../web-types.ts";

interface PlayerMastheadProps {
  tr: Translator;
  chapter: Chapter;
  verse: Verse;
  number(value: number): string;
}

export function PlayerMasthead(props: PlayerMastheadProps) {
  const verseNumber = () => Number(props.verse.verseKey.split(":")[1]) || 1;

  return (
    <header>
      <div
        class="grid grid-cols-[1fr_auto] items-center gap-5 text-[11px] tracking-wide text-muted"
        dir="ltr"
      >
        <span>
          {props.tr("ayahProgress", {
            current: props.number(verseNumber()),
            total: props.number(props.chapter.versesCount),
          })}
        </span>
        <div class="flex items-center gap-3 text-right" dir="rtl">
          <strong class="font-medium text-ink">
            {props.tr("surahNumber", {
              number: props.number(props.chapter.id),
            })}
          </strong>
          <span class="h-5 w-px bg-white/10" aria-hidden="true" />
          <span class="text-gold">
            {props.verse.juzNumber
              ? props.tr("juzAndHizb", {
                  juz: props.number(props.verse.juzNumber),
                  hizb: props.number(props.verse.hizbNumber ?? 1),
                })
              : ""}
          </span>
        </div>
      </div>
      <div
        class="mt-10 grid grid-cols-[78px_minmax(0,1fr)] items-center gap-[clamp(24px,5vw,64px)] border-b border-white/10 pb-10 max-sm:mt-7 max-sm:grid-cols-[62px_minmax(0,1fr)] max-sm:gap-5 max-sm:pb-7"
        dir="ltr"
      >
        <span class="grid size-[78px] place-items-center rounded-full border border-gold/30 font-mono text-sm font-semibold text-gold max-sm:size-[62px] max-sm:text-xs">
          {props.verse.verseKey}
        </span>
        <div class="text-right" dir="rtl">
          <p
            class="font-serif text-[clamp(17px,1.7vw,23px)] text-muted"
            dir="ltr"
          >
            {props.chapter.nameSimple}
          </p>
          <h2 class="font-reader-arabic mt-1 text-[clamp(34px,3.8vw,50px)] leading-[1.2] font-medium text-ink">
            {props.chapter.nameArabic}
          </h2>
        </div>
      </div>
    </header>
  );
}
