import { Show, type JSX } from "solid-js";
import type { MessageKey } from "../i18n.ts";
import { Icon, styles, type Translator } from "./ui.tsx";

export function Skeleton(props: { class?: string }): JSX.Element {
  return <div class={`skeleton ${props.class ?? ""}`} aria-hidden="true" />;
}

export function SkeletonLines(props: {
  count: number;
  class?: string;
}): JSX.Element {
  return (
    <div class={`grid gap-2.5 ${props.class ?? ""}`} aria-hidden="true">
      {Array.from({ length: props.count }, (_, index) => (
        <div
          class="skeleton h-3.5"
          style={{ width: index === props.count - 1 ? "62%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function ErrorState(props: {
  tr: Translator;
  message: MessageKey;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      class="grid justify-items-center gap-4 rounded-2xl border border-danger/25 bg-danger/[.04] px-6 py-12 text-center"
    >
      <span class="grid size-11 place-items-center rounded-full border border-danger/30 text-danger">
        <Icon name="close" class="size-5" />
      </span>
      <p class="max-w-[380px] text-sm leading-6 text-ink">
        {props.tr(props.message)}
      </p>
      <Show when={props.onRetry}>
        <button type="button" class={styles.primary} onClick={props.onRetry}>
          <Icon name="reset" class="size-4" />
          {props.tr("retry")}
        </button>
      </Show>
    </div>
  );
}

export function EmptyState(props: {
  tr: Translator;
  icon: string;
  title: MessageKey;
  hint?: MessageKey;
  compact?: boolean;
}): JSX.Element {
  return (
    <div
      class={`grid justify-items-center gap-3 rounded-2xl border border-dashed border-hairline bg-paper/60 text-center ${props.compact ? "px-4 py-6" : "px-6 py-12"}`}
    >
      <span class="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={props.icon} class="size-5" />
      </span>
      <b class="text-sm text-ink">{props.tr(props.title)}</b>
      <Show when={props.hint}>
        <p class="max-w-[340px] text-xs leading-5 text-muted">
          {props.tr(props.hint!)}
        </p>
      </Show>
    </div>
  );
}
