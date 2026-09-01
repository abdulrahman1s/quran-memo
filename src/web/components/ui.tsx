import { For, Show, createSignal, type JSX } from "solid-js";
import type { Language, MessageKey } from "../i18n.ts";
import type { MainTab } from "../navigation.ts";
import type { Chapter } from "../web-types.ts";

export const styles = {
  field:
    "w-full rounded-[13px] border border-white/[.18] bg-[rgba(7,13,11,.38)] px-3.5 py-[13px] text-ink transition hover:border-gold/30 disabled:opacity-40",
  panel:
    "rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(25,38,33,.92),rgba(17,27,23,.93))] shadow-[0_30px_80px_rgba(0,0,0,.28)] backdrop-blur-xl max-sm:backdrop-blur-none",
  button:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-bold transition hover:border-gold/40 hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-35",
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold px-4 text-xs font-bold text-[#172019] transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-35",
  eyebrow:
    "mb-4 text-[11px] font-bold uppercase tracking-[.19em] text-gold rtl:tracking-normal rtl:normal-case",
};

export type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

export function Icon(props: { name: string; class?: string }): JSX.Element {
  const paths: Record<string, JSX.Element> = {
    play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
    pause: <path d="M8 5v14M16 5v14" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />,
    settings: <path d="M4 7h10m4 0h2M14 4v6M4 17h2m4 0h10M10 14v6" />,
    book: (
      <path d="M3 5.5A4.5 4.5 0 0 1 7.5 4H12v16H7.5A4.5 4.5 0 0 0 3 21.5Zm18 0A4.5 4.5 0 0 0 16.5 4H12v16h4.5a4.5 4.5 0 0 1 4.5 1.5Z" />
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    share: <path d="M14 5h5v5M19 5l-9 9M18 13v6H5V6h6" />,
    trash: <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />,
    reset: <path d="M4 7v5h5M5.6 16A8 8 0 1 0 4 12" />,
    help: (
      <path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.25c-1.2.75-1.7 1.25-1.7 2.75M12 18h.01" />
    ),
    disc: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    down: <path d="m6 9 6 6 6-6" />,
    scroll: (
      <>
        <path d="M12 3v18" />
        <path d="m8 7 4-4 4 4M8 17l4 4 4-4" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      class={props.class ?? "size-[18px] shrink-0"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {paths[props.name]}
    </svg>
  );
}

export interface SelectOption {
  value: string | number;
  label: string;
}

const mainTabs: Array<[MainTab, string, MessageKey]> = [
  ["practice", "play", "practiceTab"],
  ["reading", "book", "readingTab"],
  ["downloads", "download", "downloadsTab"],
  ["settings", "settings", "settingsTab"],
];

export function CustomSelect(props: {
  value: string | number;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
  wrapSelected?: boolean;
  onChange(value: string): void;
}) {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;
  const selected = () =>
    props.options.find(
      (option) => String(option.value) === String(props.value),
    );
  return (
    <div
      ref={root}
      class="relative"
      onFocusOut={(event) => {
        if (!root.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          root.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <button
        type="button"
        class="flex min-h-[50px] w-full items-center justify-between gap-3 rounded-[13px] border border-white/15 bg-black/20 px-3.5 text-start text-[13px] font-semibold transition hover:border-gold/50 disabled:opacity-40"
        aria-label={props.label}
        aria-haspopup="listbox"
        aria-expanded={open()}
        disabled={props.disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          class={
            props.wrapSelected
              ? "line-clamp-2 min-w-0 leading-[1.35]"
              : "truncate"
          }
          title={selected()?.label}
        >
          {selected()?.label ?? "—"}
        </span>
        <Icon
          name="down"
          class={`size-4 text-muted transition ${open() ? "rotate-180" : ""}`}
        />
      </button>
      <Show when={open()}>
        <div
          role="listbox"
          class="memo-scrollbar absolute inset-x-0 top-[calc(100%+7px)] z-[70] max-h-[260px] animate-rise overflow-auto rounded-[14px] border border-white/15 bg-panel p-2 shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:top-auto max-sm:bottom-[calc(76px+env(safe-area-inset-bottom))] max-sm:max-h-[52dvh] max-sm:rounded-[20px]"
        >
          <For each={props.options}>
            {(option) => {
              const active = () => String(option.value) === String(props.value);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active()}
                  class={`grid min-h-11 w-full grid-cols-[24px_1fr] items-center gap-2 rounded-[10px] border px-2 text-start text-xs ${active() ? "border-gold/25 bg-gold/10" : "border-transparent hover:bg-white/5"}`}
                  onClick={() => {
                    props.onChange(String(option.value));
                    setOpen(false);
                  }}
                >
                  <span
                    class={`grid size-[22px] place-items-center rounded-md border ${active() ? "border-gold bg-gold text-[#132019]" : "border-white/15"}`}
                  >
                    {active() && <Icon name="check" class="size-3" />}
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function Header(props: {
  language: Language;
  tab: MainTab;
  tr: Translator;
  onLanguage: (value: Language) => void;
  onNavigate: (tab: MainTab) => void;
}) {
  return (
    <header class="grid min-h-[104px] grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 max-md:min-h-[88px] max-md:grid-cols-[1fr_auto]">
      <a
        href="/"
        class="inline-flex items-center gap-[13px] text-ink no-underline"
      >
        <span class="grid size-[46px] place-items-center rounded-[15px] bg-[linear-gradient(135deg,#efd28f,#b68d4f)] font-arabic text-[27px] font-bold text-[#122019] shadow-[0_10px_35px_rgba(216,184,114,.15)]">
          ق
        </span>
        <span>
          <strong class="block font-serif text-[19px] tracking-[.02em]">
            {props.tr("brandName")}
          </strong>
          <small class="mt-[3px] block text-[11px] tracking-[.08em] text-muted uppercase max-sm:hidden">
            {props.tr("brandTagline")}
          </small>
        </span>
      </a>
      <nav
        aria-label="Main navigation"
        class="flex gap-1 rounded-[13px] border border-white/10 bg-white/[.025] p-1 max-md:hidden"
      >
        <For each={mainTabs}>
          {(item) => (
            <button
              type="button"
              aria-current={props.tab === item[0] ? "page" : undefined}
              onClick={() => props.onNavigate(item[0])}
              class={`flex items-center gap-[7px] rounded-[9px] px-3.5 py-[9px] text-[11px] leading-none font-bold max-sm:flex-1 max-sm:justify-center max-sm:px-2 ${props.tab === item[0] ? "bg-gold text-[#172019]" : "text-muted hover:text-ink"}`}
            >
              <Icon name={item[1]} class="size-[9px]" />
              {props.tr(item[2])}
            </button>
          )}
        </For>
      </nav>
      <div class="flex justify-end">
        <div class="flex gap-1 rounded-xl border border-white/10 p-1">
          <button
            class={`rounded-lg px-3 py-2 text-[10px] font-bold ${props.language === "en" ? "bg-gold text-[#172019]" : "text-muted"}`}
            aria-pressed={props.language === "en"}
            onClick={() => props.onLanguage("en")}
          >
            EN
          </button>
          <button
            class={`rounded-lg px-3 py-2 text-[10px] font-bold ${props.language === "ar" ? "bg-gold text-[#172019]" : "text-muted"}`}
            aria-pressed={props.language === "ar"}
            onClick={() => props.onLanguage("ar")}
          >
            العربية
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileNavigation(props: {
  tab: MainTab;
  tr: Translator;
  onNavigate: (tab: MainTab) => void;
}) {
  return (
    <nav
      aria-label="Mobile navigation"
      class="fixed inset-x-0 bottom-0 z-[60] hidden border-t border-white/10 bg-[#0e1915]/95 px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-16px_45px_rgba(0,0,0,.32)] backdrop-blur-xl max-md:block"
    >
      <div class="mx-auto grid max-w-[520px] grid-cols-4 gap-1">
        <For each={mainTabs}>
          {(item) => (
            <button
              type="button"
              aria-current={props.tab === item[0] ? "page" : undefined}
              onClick={() => props.onNavigate(item[0])}
              class={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] leading-none font-bold transition ${props.tab === item[0] ? "bg-gold/10 text-gold-bright" : "text-muted active:bg-white/5"}`}
            >
              <Icon name={item[1]} class="size-[18px]" />
              <span>{props.tr(item[2])}</span>
            </button>
          )}
        </For>
      </div>
    </nav>
  );
}

export function Hero(props: {
  tr: Translator;
  eyebrow: MessageKey;
  title: MessageKey;
  description: MessageKey;
}) {
  return (
    <div class="mb-10 max-w-[760px]">
      <p class={styles.eyebrow}>{props.tr(props.eyebrow)}</p>
      <h1 class="m-0 font-serif text-[clamp(40px,5.5vw,72px)] leading-none tracking-[-.045em] rtl:font-arabic rtl:tracking-normal">
        {props.tr(props.title)}
      </h1>
      <p class="mt-5 max-w-[610px] text-base leading-7 text-muted">
        {props.tr(props.description)}
      </p>
    </div>
  );
}
export function PanelHeading(props: {
  tr: Translator;
  number: string;
  title: MessageKey;
  description: MessageKey;
}) {
  return (
    <div class="mb-6 flex gap-3.5 border-b border-white/10 pb-6 max-sm:mb-4 max-sm:gap-3 max-sm:pb-4">
      <span class="h-fit rounded-full border border-gold/25 px-2 py-1 text-[9px] font-bold text-gold">
        {props.number}
      </span>
      <div>
        <h2 class="font-serif text-[23px] max-sm:text-xl rtl:font-arabic">
          {props.tr(props.title)}
        </h2>
        <p class="mt-1 text-xs text-muted max-sm:text-[11px]">
          {props.tr(props.description)}
        </p>
      </div>
    </div>
  );
}
export function Field(props: {
  tr: Translator;
  label: MessageKey;
  children: JSX.Element;
}) {
  return (
    <label class="my-[19px] grid gap-[9px] text-xs font-semibold tracking-[.02em] text-[#bdc8c1] max-sm:my-3 max-sm:gap-1.5 max-sm:text-[11px]">
      <span>{props.tr(props.label)}</span>
      {props.children}
    </label>
  );
}
export function Preference(props: {
  tr: Translator;
  label: MessageKey;
  description: MessageKey;
  icon: JSX.Element;
  output?: string;
  children: JSX.Element;
}) {
  return (
    <div class="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-3 rounded-2xl border border-white/10 bg-white/[.025] px-[18px] py-[17px] max-sm:grid-cols-[38px_minmax(0,1fr)_auto] max-sm:px-[13px] max-sm:py-[15px]">
      <span class="row-span-2 grid size-[42px] place-items-center rounded-xl bg-gold/[.085] font-arabic text-[19px] font-semibold text-gold max-sm:size-[38px]">
        {props.icon}
      </span>
      <span class="min-w-0">
        <b class="block text-sm">{props.tr(props.label)}</b>
        <small class="mt-1 block text-[10px] leading-4 text-muted">
          {props.tr(props.description)}
        </small>
      </span>
      <Show when={props.output}>
        <output class="rounded-full border border-gold/20 px-2.5 py-1.5 font-mono text-[10px] font-bold text-gold-bright">
          {props.output}
        </output>
      </Show>
      <div class="col-[2/-1]">{props.children}</div>
    </div>
  );
}
export function Stat(props: {
  tr: Translator;
  label: MessageKey;
  value: string;
}) {
  return (
    <div class="rounded-xl border border-white/10 bg-white/[.035] p-3 last:col-span-2">
      <span class="block text-[10px] text-muted">{props.tr(props.label)}</span>
      <b class="mt-1 block">{props.value}</b>
    </div>
  );
}

export function RepeatControl(props: {
  label: string;
  current: number;
  target: number;
  minimum?: number;
  maximum?: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const minimum = () => props.minimum ?? 1;
  const maximum = () => props.maximum ?? 100;
  return (
    <div class="rounded-[14px] border border-white/10 bg-white/[.035] p-[13px]">
      <div class="flex items-center justify-between gap-3">
        <span class="text-[10px] text-muted">{props.label}</span>
        <b class="text-sm">
          {props.current} / {props.target}
        </b>
      </div>
      <div class="mt-3 grid min-h-[42px] grid-cols-[38px_minmax(0,1fr)_38px] overflow-hidden rounded-xl border border-white/10">
        <button
          type="button"
          class="grid place-items-center border-e border-white/10 text-lg font-semibold text-gold transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`${props.label}: decrease`}
          disabled={props.target <= minimum()}
          onClick={props.onDecrease}
        >
          −
        </button>
        <strong class="grid place-items-center text-sm">{props.target}</strong>
        <button
          type="button"
          class="grid place-items-center border-s border-white/10 text-lg font-semibold text-gold transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`${props.label}: increase`}
          disabled={props.target >= maximum()}
          onClick={props.onIncrease}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SurahList(props: {
  items: Chapter[];
  values: Set<number>;
  reciter: number;
  tr: Translator;
  language: Language;
  isOffline: (chapter: number, reciter: number) => boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      class="memo-scrollbar grid max-h-[610px] grid-cols-2 gap-2 overflow-auto pe-1 max-sm:grid-cols-1"
      aria-label={props.tr("chooseSurahs")}
    >
      <For each={props.items}>
        {(chapter) => {
          const checked = () => props.values.has(chapter.id);
          return (
            <button
              type="button"
              role="checkbox"
              aria-checked={checked()}
              onClick={() => props.onToggle(chapter.id)}
              class={`grid min-h-[70px] grid-cols-[24px_28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[15px] border p-3 text-start transition ${checked() ? "border-gold/30 bg-gold/10" : "border-transparent bg-white/[.025] hover:border-white/10 hover:bg-white/5"}`}
            >
              <span
                class={`grid size-6 place-items-center rounded-lg border ${checked() ? "border-gold bg-gold text-[#122019]" : "border-white/15"}`}
              >
                {checked() && <Icon name="check" class="size-3.5" />}
              </span>
              <span class="font-mono text-[10px] text-[#76857d]">
                {String(chapter.id).padStart(3, "0")}
              </span>
              <span class="min-w-0">
                <b class="block truncate text-[13px]">
                  {props.language === "ar"
                    ? chapter.nameArabic
                    : chapter.nameSimple}
                </b>
                <small class="mt-1 block truncate text-[10px] text-muted">
                  {chapter.versesCount} {props.tr("ayahs")}
                  {props.isOffline(chapter.id, props.reciter)
                    ? ` · ${props.tr("offlineReady")}`
                    : ""}
                </small>
              </span>
              <strong class="font-arabic text-lg font-medium" translate="no">
                {props.language === "ar"
                  ? chapter.nameSimple
                  : chapter.nameArabic}
              </strong>
            </button>
          );
        }}
      </For>
    </div>
  );
}
