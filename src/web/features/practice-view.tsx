import { For, Show, createMemo } from "solid-js";
import {
  CustomSelect,
  Field,
  Icon,
  PanelHeading,
  SurahList,
  styles,
  type Translator,
} from "../components/ui.tsx";
import { ReciterPicker } from "../components/reciter-picker.tsx";
import { EmptyState, ErrorState, Skeleton } from "../components/feedback.tsx";
import type { Language } from "../i18n.ts";
import type { MemorizationLevel } from "../practice-link.ts";
import type { Chapter, Reciter } from "../web-types.ts";

interface PracticeViewProps {
  tr: Translator;
  language: Language;
  chapters: Chapter[];
  visible: Chapter[];
  reciters: Reciter[];
  selected: Set<number>;
  reciterId: number;
  ayahRepeats: number;
  surahRepeats: number;
  cycles: number | "forever";
  memorization: MemorizationLevel;
  ayahDelay: number;
  surahDelay: number;
  search: string;
  loading: boolean;
  catalogReady: boolean;
  catalogError: boolean;
  retryCatalog(): void;
  setReciter(value: number): void;
  setAyahRepeats(value: number): void;
  setSurahRepeats(value: number): void;
  setCycles(value: number | "forever"): void;
  setMemorization(value: MemorizationLevel): void;
  setAyahDelay(value: number): void;
  setSurahDelay(value: number): void;
  setSearch(value: string): void;
  clear(): void;
  selectVisible(): void;
  toggle(id: number): void;
  start(mode: "practice" | "quiz"): void;
  share(): void;
  isOffline(chapter: number, reciter: number): boolean;
  bounded(value: unknown, min: number, max: number, fallback: number): number;
}

export function PracticeView(props: PracticeViewProps) {
  const reciterName = (item: Reciter) =>
    props.language === "ar" ? item.nameArabic : item.nameEnglish;
  const selectedChapters = createMemo(() =>
    props.chapters.filter((chapter) => props.selected.has(chapter.id)),
  );
  return (
    <section class="animate-enter py-14 max-md:py-8 max-sm:py-5">
      <div class="mb-14 max-w-[790px] max-sm:mb-8">
        <p class={styles.eyebrow}>{props.tr("heroEyebrow")}</p>
        <h1 class="font-serif text-[clamp(48px,7vw,92px)] leading-[.94] font-medium tracking-[-.055em] max-sm:text-[40px] rtl:font-arabic rtl:tracking-normal">
          {props.tr("heroLineOne")}
          <br />
          <em class="font-normal text-gold">{props.tr("heroLineTwo")}</em>
        </h1>
        <p class="mt-7 max-w-[570px] text-[17px] leading-7 text-muted max-sm:mt-4 max-sm:text-sm max-sm:leading-6">
          {props.tr("heroDescription")}
        </p>
      </div>
      <div class="grid grid-cols-[minmax(300px,.72fr)_minmax(480px,1.28fr)] items-start gap-5 max-[860px]:grid-cols-1">
        <aside
          class={`${styles.panel} sticky top-6 p-[30px] max-[860px]:static max-sm:rounded-[20px] max-sm:p-4`}
        >
          <PanelHeading
            tr={props.tr}
            number="01"
            title="practiceSettings"
            description="practiceDescription"
          />
          <Field tr={props.tr} label="reciter">
            <ReciterPicker
              tr={props.tr}
              language={props.language}
              reciters={props.reciters}
              value={props.reciterId}
              onChange={props.setReciter}
            />
          </Field>
          <div class="grid grid-cols-2 gap-3">
            <Field tr={props.tr} label="ayahRepeats">
              <input
                class={`${styles.field} text-center text-base font-bold`}
                type="number"
                min="1"
                max="100"
                value={props.ayahRepeats}
                onChange={(e) =>
                  props.setAyahRepeats(
                    props.bounded(e.currentTarget.value, 1, 100, 1),
                  )
                }
              />
            </Field>
            <Field tr={props.tr} label="surahRepeats">
              <input
                class={`${styles.field} text-center text-base font-bold`}
                type="number"
                min="1"
                max="100"
                value={props.surahRepeats}
                onChange={(e) =>
                  props.setSurahRepeats(
                    props.bounded(e.currentTarget.value, 1, 100, 3),
                  )
                }
              />
            </Field>
          </div>
          <div class="grid grid-cols-2 gap-3 max-sm:gap-2">
            <Field tr={props.tr} label="fullCycles">
              <CustomSelect
                label={props.tr("fullCycles")}
                value={props.cycles}
                options={[
                  { value: 1, label: props.tr("oneCycle") },
                  { value: 2, label: props.tr("twoCycles") },
                  { value: 3, label: props.tr("threeCycles") },
                  { value: 5, label: props.tr("fiveCycles") },
                  { value: "forever", label: props.tr("forever") },
                ]}
                onChange={(value) =>
                  props.setCycles(
                    value === "forever" ? "forever" : Number(value),
                  )
                }
              />
            </Field>
            <Field tr={props.tr} label="memorizationMode">
              <CustomSelect
                label={props.tr("memorizationMode")}
                value={props.memorization}
                options={[
                  { value: "full", label: props.tr("memoryFull") },
                  { value: "first-words", label: props.tr("memoryFirstWords") },
                  { value: "initials", label: props.tr("memoryInitials") },
                  { value: "hidden", label: props.tr("memoryHidden") },
                ]}
                onChange={(value) =>
                  props.setMemorization(value as MemorizationLevel)
                }
              />
            </Field>
          </div>
          <details class="group my-5 rounded-[14px] border border-hairline bg-paper/60 px-4 py-3 max-sm:my-3.5">
            <summary class="flex cursor-pointer list-none items-center justify-between">
              <span>
                <b class="block text-xs text-ink">
                  {props.tr("timingSettings")}
                </b>
                <small class="mt-1 block text-[0.625rem] font-normal text-muted">
                  {props.tr("timingSummary", {
                    ayah: `${props.ayahDelay}s`,
                    surah: `${props.surahDelay}s`,
                  })}
                </small>
              </span>
              <Icon
                name="down"
                class="size-4 text-muted transition group-open:rotate-180"
              />
            </summary>
            <div class="mt-3">
              <Field tr={props.tr} label="pauseAfterAyah">
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={props.ayahDelay}
                  onInput={(e) =>
                    props.setAyahDelay(Number(e.currentTarget.value))
                  }
                />
              </Field>
              <Field tr={props.tr} label="pauseBetween">
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={props.surahDelay}
                  onInput={(e) =>
                    props.setSurahDelay(Number(e.currentTarget.value))
                  }
                />
              </Field>
            </div>
          </details>
          <div class="mt-6 flex items-center justify-between border-t border-hairline pt-5 text-[0.8125rem] text-muted max-sm:mt-4 max-sm:pt-4">
            <span>
              <b class="text-ink">{props.selected.size}</b>{" "}
              <i>{props.tr("surahsSelected")}</i>
            </span>
            <button
              class="min-h-11 px-2 text-gold transition hover:text-gold-bright disabled:opacity-40"
              disabled={!props.selected.size}
              onClick={props.clear}
            >
              {props.tr("clear")}
            </button>
          </div>
          <div class="flex min-h-[30px] flex-wrap gap-1.5" aria-live="polite">
            <For each={selectedChapters().slice(0, 5)}>
              {(chapter) => (
                <span class="rounded-full bg-white/[.055] px-[9px] py-1.5 text-[0.625rem] text-[#ced8d1]">
                  {props.language === "ar"
                    ? chapter.nameArabic
                    : chapter.nameSimple}
                </span>
              )}
            </For>
            <Show when={selectedChapters().length > 5}>
              <span class="rounded-full bg-white/[.055] px-[9px] py-1.5 text-[0.625rem] text-[#ced8d1]">
                +{selectedChapters().length - 5}
              </span>
            </Show>
          </div>
          <div class="grid gap-[9px]">
            <button
              class="mt-[18px] flex min-h-[54px] w-full items-center justify-between rounded-[14px] border-0 bg-[linear-gradient(135deg,#efd28f,#c49d5c)] px-[18px] py-[15px] text-start text-sm font-extrabold text-[#132019] shadow-[0_12px_30px_rgba(216,184,114,.14)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!props.selected.size || props.loading}
              onClick={() => props.start("practice")}
            >
              <strong class="inline-flex items-center gap-2.5">
                <Show when={props.loading}>
                  <span
                    class="size-4 animate-spin-slow rounded-full border-2 border-[#132019]/30 border-t-[#132019]"
                    aria-hidden="true"
                  />
                </Show>
                {props.loading
                  ? props.tr("preparing")
                  : props.tr("beginListening")}
              </strong>
              <Icon name="right" class="size-[18px] rtl:rotate-180" />
            </button>
            <button
              class="flex min-h-[58px] w-full items-center justify-between rounded-[14px] border border-gold/25 bg-gold/[.065] px-[17px] py-[13px] text-start transition hover:-translate-y-px hover:bg-gold/10 active:translate-y-0 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!props.selected.size || props.loading}
              onClick={() => props.start("quiz")}
            >
              <span>
                <b class="block text-xs">{props.tr("testMemory")}</b>
                <small class="mt-1 block text-[0.625rem] font-normal text-muted">
                  {props.tr("completeSurah")}
                </small>
              </span>
              <span class="grid size-7 place-items-center rounded-full border border-gold/30 text-gold">
                <Icon name="help" class="size-4" />
              </span>
            </button>
            <button
              class="mx-auto inline-flex min-h-11 items-center gap-2 px-3 py-2 text-[0.6875rem] text-muted transition hover:text-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!props.selected.size}
              onClick={props.share}
            >
              {props.tr("copyPracticeLink")}
              <Icon name="share" class="size-3.5" />
            </button>
          </div>
        </aside>
        <section class={`${styles.panel} p-7 max-sm:rounded-[20px] max-sm:p-4`}>
          <PanelHeading
            tr={props.tr}
            number="02"
            title="chooseSurahs"
            description="chooseDescription"
          />
          <div class="mb-3 flex items-center justify-between gap-3 rounded-xl border border-hairline bg-paper/70 px-3.5 py-2.5">
            <span class="text-[0.6875rem] text-muted">
              <b class="me-1.5 text-sm text-accent">{props.selected.size}</b>
              {props.tr("surahsSelected")}
            </span>
            <Show when={props.selected.size > 0}>
              <button
                type="button"
                class="min-h-11 rounded-lg px-2.5 text-[0.625rem] font-bold text-muted transition hover:bg-accent-soft hover:text-accent"
                onClick={props.clear}
              >
                {props.tr("clear")}
              </button>
            </Show>
          </div>
          <div class="mb-5 flex gap-2 max-sm:flex-col">
            <label class="relative flex-1">
              <Icon
                name="search"
                class="absolute start-3.5 top-3.5 size-4 text-muted"
              />
              <input
                class={`${styles.field} ps-10`}
                type="search"
                value={props.search}
                placeholder={props.tr("searchSurahs")}
                onInput={(e) => props.setSearch(e.currentTarget.value)}
              />
            </label>
            <button
              class={`${styles.button} shrink-0 border-accent/25 bg-accent-soft/50`}
              onClick={props.selectVisible}
            >
              <Icon name="check" class="size-3.5" />
              {props.tr("selectVisible")}
            </button>
          </div>
          <Show
            when={props.catalogReady}
            fallback={
              <Show
                when={props.catalogError}
                fallback={
                  <div
                    class="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1"
                    aria-label={props.tr("loadingCatalog")}
                    aria-busy="true"
                  >
                    <For each={Array.from({ length: 8 })}>
                      {() => (
                        <div class="grid min-h-[86px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[17px] border border-hairline bg-panel px-3.5 py-3">
                          <Skeleton class="size-10 rounded-full" />
                          <span class="grid gap-2">
                            <Skeleton class="h-3.5 w-3/5" />
                            <Skeleton class="h-2.5 w-2/5" />
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                }
              >
                <ErrorState
                  tr={props.tr}
                  message="catalogFailed"
                  onRetry={props.retryCatalog}
                />
              </Show>
            }
          >
            <Show
              when={props.visible.length > 0 || !props.search}
              fallback={
                <EmptyState
                  tr={props.tr}
                  icon="search"
                  title="noSearchResults"
                  hint="noSearchResultsHint"
                />
              }
            >
              <SurahList
                items={props.visible}
                values={props.selected}
                reciter={props.reciterId}
                tr={props.tr}
                language={props.language}
                isOffline={props.isOffline}
                onToggle={props.toggle}
              />
            </Show>
          </Show>
        </section>
      </div>
    </section>
  );
}
