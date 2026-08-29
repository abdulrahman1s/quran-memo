import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseCycles, parseSurahSpec } from "./args.ts";
import type { Chapter, Reciter, SessionConfig, SessionCycles } from "./types.ts";

export class SelectionCancelledError extends Error {
  constructor() {
    super("Selection cancelled.");
    this.name = "SelectionCancelledError";
  }
}

interface FzfItem {
  id: number;
  label: string;
}

export function formatFzfItems(items: FzfItem[]): string {
  return `${items.map((item) => `${item.id}\t${item.label}`).join("\n")}\n`;
}

export function parseFzfIds(output: string): number[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number.parseInt(line.split("\t", 1)[0]!, 10))
    .filter(Number.isInteger);
}

async function runFzf(items: FzfItem[], options: {
  prompt: string;
  header: string;
  multi: boolean;
}): Promise<number[]> {
  const fzf = Bun.which("fzf");
  if (!fzf) return [];

  const args = [
    fzf,
    "--height=80%",
    "--layout=reverse",
    "--border=rounded",
    "--cycle",
    "--scroll-off=3",
    "--delimiter=\\t",
    "--with-nth=2..",
    `--prompt=${options.prompt}`,
    `--header=${options.header}`,
  ];
  if (options.multi) {
    args.push(
      "--multi",
      "--no-mouse",
      "--marker=✓",
      "--pointer=›",
      "--info=inline-right",
      "--footer=Tab selects · Shift+Tab deselects · Enter confirms · Alt+A selects all",
      "--footer-border=line",
      "--bind=alt-a:select-all",
    );
  }

  const process = Bun.spawn(args, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
    env: { ...globalThis.process.env, FZF_DEFAULT_OPTS: "" },
  });
  process.stdin.write(formatFzfItems(items));
  process.stdin.end();
  const outputPromise = new Response(process.stdout).text();
  const [exitCode, output] = await Promise.all([process.exited, outputPromise]);
  if (exitCode === 130) throw new SelectionCancelledError();
  if (exitCode !== 0) throw new Error(`fzf exited with status ${exitCode}.`);
  const ids = parseFzfIds(output);
  if (ids.length === 0) throw new SelectionCancelledError();
  return ids;
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function askUntil<T>(question: string, parser: (value: string) => T): Promise<T> {
  while (true) {
    const answer = await ask(question);
    try {
      return parser(answer);
    } catch (error) {
      console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function selectReciter(reciters: Reciter[], defaultId?: number): Promise<Reciter> {
  const orderedReciters = defaultId === undefined
    ? reciters
    : [...reciters].sort((a, b) => Number(b.id === defaultId) - Number(a.id === defaultId));
  const fzf = Bun.which("fzf");
  let id: number;
  if (fzf) {
    const ids = await runFzf(
      orderedReciters.map((reciter) => ({
        id: reciter.id,
        label: `${reciter.id === defaultId ? "✓" : " "}  ${reciter.nameArabic} — ${reciter.nameEnglish}${reciter.style ? ` (${reciter.style})` : ""}`,
      })),
      { prompt: "Reciter › ", header: "Search • ↑/↓ or j/k move • Enter selects", multi: false },
    );
    id = ids[0]!;
  } else {
    console.log("\nfzf was not found; using the numbered reciter selector.\n");
    for (const reciter of orderedReciters) {
      console.log(`${reciter.id === defaultId ? "✓" : " "} ${String(reciter.id).padStart(3)}  ${reciter.nameArabic} — ${reciter.nameEnglish}${reciter.style ? ` (${reciter.style})` : ""}`);
    }
    id = await askUntil(`\nReciter ID [${defaultId ?? ""}]: `, (value) => {
      const parsed = value === "" && defaultId !== undefined ? defaultId : Number(value);
      if (!Number.isInteger(parsed) || !reciters.some((reciter) => reciter.id === parsed)) {
        throw new Error("Enter one of the listed reciter IDs.");
      }
      return parsed;
    });
  }
  return reciters.find((reciter) => reciter.id === id)!;
}

export async function selectChapters(chapters: Chapter[]): Promise<Chapter[]> {
  const fzf = Bun.which("fzf");
  let ids: number[];
  if (fzf) {
    ids = await runFzf(
      chapters.map((chapter) => ({
        id: chapter.id,
        label: `${String(chapter.id).padStart(3)}  ${chapter.nameArabic} — ${chapter.nameSimple}  ·  ${chapter.versesCount} ayahs`,
      })),
      {
        prompt: "Surahs › ",
        header: "Type to search • Tab/Shift+Tab toggles • selected rows show ✓",
        multi: true,
      },
    );
  } else {
    console.log("\nfzf was not found; enter surahs as numbers, lists, or ranges (for example 1,36,108-114).\n");
    for (const chapter of chapters) {
      console.log(`${String(chapter.id).padStart(3)}  ${chapter.nameArabic} — ${chapter.nameSimple}`);
    }
    ids = await askUntil("\nSurahs: ", parseSurahSpec);
  }

  const selected = new Set(ids);
  return chapters.filter((chapter) => selected.has(chapter.id));
}

function positiveIntegerWithDefault(value: string, fallback: number, label: string): number {
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function cyclesWithDefault(value: string, fallback: SessionCycles): SessionCycles {
  if (value === "") return fallback;
  return parseCycles(value);
}

function delayWithDefault(value: string, fallback: number): number {
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Delay must be a non-negative number.");
  return parsed;
}

export async function completeSessionConfig(partial: Partial<SessionConfig>): Promise<SessionConfig> {
  const ayahRepeats = partial.ayahRepeats ?? await askUntil(
    "Repeat each ayah [1]: ",
    (value) => positiveIntegerWithDefault(value, 1, "Ayah repeat count"),
  );
  const surahRepeats = partial.surahRepeats ?? await askUntil(
    "Repeat each complete surah [3]: ",
    (value) => positiveIntegerWithDefault(value, 3, "Repeat count"),
  );
  const cycles = partial.cycles ?? await askUntil(
    "Full-session cycles [forever]: ",
    (value) => cyclesWithDefault(value, "forever"),
  );
  const delaySeconds = partial.delaySeconds ?? await askUntil(
    "Delay between surah repeats in seconds [0]: ",
    (value) => delayWithDefault(value, 0),
  );
  const ayahDelaySeconds = partial.ayahDelaySeconds ?? await askUntil(
    "Delay after each ayah in seconds [0]: ",
    (value) => delayWithDefault(value, 0),
  );
  return { ayahRepeats, surahRepeats, cycles, ayahDelaySeconds, delaySeconds };
}
