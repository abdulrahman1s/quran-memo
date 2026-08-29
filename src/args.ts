import { parseArgs } from "node:util";
import type { CliOptions, SessionCycles } from "./types.ts";
export { parseSurahSpec } from "./surah-spec.ts";
import { parseSurahSpec } from "./surah-spec.ts";

export const HELP = `Quran memorization player

Usage:
  quran-memo
  quran-memo --surahs 1,36,108-114 --reciter 7 --repeat 3 --cycles forever
  quran-memo --web --port 3000

Options:
  -s, --surahs <list>       Surah numbers, comma lists, or ranges
  -r, --reciter <id>        Quran.com recitation ID (default: Al-Husary Murattal)
  -n, --repeat <count>      Repetitions for each complete surah (default: 3)
  -c, --cycles <value>      Full-session cycles or "forever" (default)
  -d, --delay <seconds>     Pause between repeats of the same surah (default: 0)
  -w, --web                 Start the browser interface
  -p, --port <number>       Web server port (default: 3000)
  -h, --help                Show this help

Run without --surahs or --reciter in a terminal to choose them interactively.`;

function positiveInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a positive integer.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return number;
}

export function parseCycles(value: string): SessionCycles {
  if (value.toLowerCase() === "forever") return "forever";
  return positiveInteger(value, "Cycles");
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      surahs: { type: "string", short: "s" },
      reciter: { type: "string", short: "r" },
      repeat: { type: "string", short: "n" },
      cycles: { type: "string", short: "c" },
      delay: { type: "string", short: "d" },
      web: { type: "boolean", short: "w", default: false },
      port: { type: "string", short: "p" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  let delaySeconds: number | undefined;
  if (values.delay !== undefined) {
    delaySeconds = Number(values.delay);
    if (!Number.isFinite(delaySeconds) || delaySeconds < 0) {
      throw new Error("Delay must be a non-negative number of seconds.");
    }
  }

  let port: number | undefined;
  if (values.port !== undefined) {
    port = positiveInteger(values.port, "Port");
    if (port > 65_535) throw new Error("Port must be between 1 and 65535.");
  }

  return {
    help: values.help,
    web: values.web,
    port,
    surahIds: values.surahs === undefined ? undefined : parseSurahSpec(values.surahs),
    reciterId: values.reciter === undefined ? undefined : positiveInteger(values.reciter, "Reciter ID"),
    surahRepeats: values.repeat === undefined ? undefined : positiveInteger(values.repeat, "Repeat count"),
    cycles: values.cycles === undefined ? undefined : parseCycles(values.cycles),
    delaySeconds,
  };
}
