import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { Language } from "../i18n.ts";
import type { Reciter } from "../web-types.ts";
import { Icon, styles, type Translator } from "./ui.tsx";

interface ReciterPickerProps {
  tr: Translator;
  language: Language;
  reciters: Reciter[];
  value: number;
  disabled?: boolean;
  compact?: boolean;
  onChange(value: number): void;
}

function styleLabel(style: string | null, language: Language): string {
  const normalized = style?.trim().toLocaleLowerCase();
  if (normalized === "mujawwad") return language === "ar" ? "مجود" : "Mujawwad";
  if (normalized === "muallim") return language === "ar" ? "معلم" : "Teaching";
  return language === "ar" ? "مرتل" : "Murattal";
}

export function ReciterPicker(props: ReciterPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [position, setPosition] = createSignal({
    left: 0,
    top: "0px",
    bottom: "auto",
    width: 0,
    available: 430,
  });
  let root!: HTMLDivElement;
  let trigger!: HTMLButtonElement;
  let menu: HTMLDivElement | undefined;
  const selected = () => props.reciters.find((item) => item.id === props.value);
  const localizedName = (item: Reciter) =>
    props.language === "ar" ? item.nameArabic : item.nameEnglish;
  const filtered = createMemo(() => {
    const value = search().trim().toLocaleLowerCase();
    return props.reciters.filter(
      (item) =>
        !value ||
        item.nameEnglish.toLocaleLowerCase().includes(value) ||
        item.nameArabic.includes(value) ||
        styleLabel(item.style, props.language)
          .toLocaleLowerCase()
          .includes(value) ||
        item.style?.toLocaleLowerCase().includes(value),
    );
  });

  const updatePosition = () => {
    const rect = trigger?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const placeAbove = below < 240 && above > below;
    setPosition({
      left: rect.left,
      top: placeAbove ? "auto" : `${rect.bottom + 8}px`,
      bottom: placeAbove ? `${window.innerHeight - rect.top + 8}px` : "auto",
      width: rect.width,
      available: Math.max(140, (placeAbove ? above : below) - 20),
    });
  };

  createEffect(() => {
    if (!open()) return;
    updatePosition();
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!root.contains(target) && !menu?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.focus();
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    onCleanup(() => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    });
  });

  return (
    <div
      ref={root}
      class="reciter-picker relative"
      onFocusOut={(event) => {
        const target = event.relatedTarget as Node | null;
        if (!root.contains(target) && !menu?.contains(target)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={props.tr("chooseReciter")}
        aria-haspopup="listbox"
        aria-expanded={open()}
        disabled={props.disabled}
        onClick={() => setOpen((value) => !value)}
        class={`reciter-trigger grid w-full grid-cols-[38px_minmax(0,1fr)_auto_18px] items-center gap-2.5 rounded-[14px] border border-white/15 bg-black/20 px-3 text-start transition hover:border-gold/50 active:scale-[.99] disabled:cursor-wait disabled:opacity-55 ${props.compact ? "min-h-[52px]" : "min-h-[60px]"}`}
      >
        <span class="reciter-disc grid size-9 place-items-center rounded-[10px] bg-gold/10 text-gold">
          <Icon name="disc" class="size-[17px]" />
        </span>
        <span class="min-w-0">
          <b class="block truncate text-sm font-semibold text-ink">
            {selected()
              ? localizedName(selected()!)
              : props.tr("chooseReciter")}
          </b>
        </span>
        <Show when={selected()}>
          {(item) => (
            <span class="reciter-style rounded-full border border-gold/25 bg-gold/[.07] px-2.5 py-1 text-[0.5625rem] font-bold whitespace-nowrap text-gold">
              {styleLabel(item().style, props.language)}
            </span>
          )}
        </Show>
        <Icon
          name="down"
          class={`size-4 text-muted transition ${open() ? "rotate-180" : ""}`}
        />
      </button>
      <Show when={open()}>
        <Portal>
          <div
            class="select-sheet-backdrop"
            aria-hidden="true"
            onPointerDown={() => setOpen(false)}
          />
          <div
            ref={menu}
            class="app-select-popover reciter-popover animate-rise rounded-[17px] border border-white/15 bg-panel p-3 shadow-2xl"
            style={`--select-left:${position().left}px;--select-top:${position().top};--select-bottom:${position().bottom};--select-width:${position().width}px;--select-available:${position().available}px`}
          >
            <div class="mb-2 flex items-center justify-between px-1">
              <b class="text-[0.6875rem]">{props.tr("chooseReciter")}</b>
              <span class="text-[0.5625rem] text-muted">
                {props.tr("reciterStyleShown")}
              </span>
            </div>
            <label class="relative block">
              <Icon
                name="search"
                class="absolute start-3 top-3 size-3.5 text-muted"
              />
              <input
                class={`${styles.field} mb-2 py-2.5 ps-9 text-xs`}
                type="search"
                value={search()}
                placeholder={props.tr("searchReciters")}
                onInput={(event) => setSearch(event.currentTarget.value)}
              />
            </label>
            <div
              role="listbox"
              class="memo-scrollbar select-sheet-scroll grid max-h-[330px] gap-1 overflow-auto pe-1"
            >
              <For each={filtered()}>
                {(item) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.id === props.value}
                    onClick={() => {
                      props.onChange(item.id);
                      setOpen(false);
                    }}
                    class={`grid min-h-[52px] grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition ${item.id === props.value ? "border-gold/30 bg-gold/10" : "border-transparent hover:bg-white/5"}`}
                  >
                    <span
                      class={`grid size-7 place-items-center rounded-full border ${item.id === props.value ? "border-gold bg-gold text-[#132019]" : "border-white/15 text-transparent"}`}
                    >
                      <Icon name="check" class="size-3.5" />
                    </span>
                    <b class="min-w-0 truncate text-sm font-semibold">
                      {localizedName(item)}
                    </b>
                    <small class="rounded-full border border-gold/25 bg-gold/5 px-2.5 py-1 text-[0.5625rem] font-bold whitespace-nowrap text-gold">
                      {styleLabel(item.style, props.language)}
                    </small>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
}
