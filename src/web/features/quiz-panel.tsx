import { For } from "solid-js";
import type { Translator } from "../components/ui.tsx";
import type { QuizChoice } from "../quiz.ts";

interface QuizPanelProps {
  tr: Translator;
  choices: QuizChoice[];
  answer?: string;
  expectedVerseKey?: string;
  correct: number;
  total: number;
  onAnswer(choice: QuizChoice): void;
}

export function QuizPanel(props: QuizPanelProps) {
  return (
    <div class="mt-8 border-t border-hairline pt-6">
      <div class="mb-3 flex justify-between">
        <b class="font-serif text-lg">{props.tr("whichNext")}</b>
        <span class="text-xs text-gold">
          {props.correct} / {props.total}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
        <For each={props.choices}>
          {(choice) => (
            <button
              type="button"
              dir="rtl"
              lang="ar"
              translate="no"
              disabled={Boolean(props.answer)}
              onClick={() => props.onAnswer(choice)}
              class={`quiz-choice min-h-[108px] rounded-xl border px-5 py-4 transition ${props.answer && choice.verseKey === props.expectedVerseKey ? "border-[#78b692] bg-[#78b692]/10" : props.answer === choice.verseKey ? "border-danger bg-danger/10" : "border-white/15 bg-white/[.025] hover:border-gold/40"}`}
            >
              {choice.arabic}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
