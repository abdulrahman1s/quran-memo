#!/usr/bin/env bun

import { HELP, parseCliArgs } from "./args.ts";
import { DEFAULT_RECITER_ID, QuranClient } from "./api.ts";
import { DiskCache } from "./cache.ts";
import { MpvPlayer, playSession, type PlaybackProgress } from "./playback.ts";
import {
  SelectionCancelledError,
  completeSessionConfig,
  selectChapters,
  selectReciter,
} from "./select.ts";
import type { Chapter, Reciter } from "./types.ts";
import { startWebServer } from "./web/server.ts";

const colorsEnabled = !process.env.NO_COLOR && Boolean(process.stdout.isTTY);
const color = (code: number, text: string) => colorsEnabled ? `\x1b[${code}m${text}\x1b[0m` : text;

function showProgress(progress: PlaybackProgress, chapterById: Map<number, Chapter>): void {
  const chapter = chapterById.get(progress.verse.chapterId);
  const cycleTotal = progress.cycles === "forever" ? "∞" : progress.cycles;
  console.log("");
  console.log(color(36, `${chapter?.nameArabic ?? ""} — ${chapter?.nameSimple ?? ""} · ${progress.verse.verseKey}`));
  console.log(color(90, `Surah ${progress.surahIndex + 1}/${progress.surahCount} · surah repeat ${progress.surahRepeat}/${progress.surahRepeats} · ayah ${progress.verseIndex + 1}/${progress.verseCount} · ayah repeat ${progress.ayahRepeat}/${progress.ayahRepeats} · session ${progress.cycle}/${cycleTotal}`));
  console.log(color(97, progress.verse.arabic));
  console.log(progress.verse.translation);
}

function showSummary(chapters: Chapter[], reciter: Reciter, config: import("./types.ts").SessionConfig): void {
  const names = chapters.map((chapter) => `${chapter.id}. ${chapter.nameArabic} (${chapter.nameSimple})`).join(", ");
  console.log(`\n${color(1, "Quran memorization session")}`);
  console.log(`Reciter: ${reciter.nameArabic} — ${reciter.nameEnglish}${reciter.style ? ` (${reciter.style})` : ""}`);
  console.log(`Surahs:  ${names}`);
  console.log(`Loop:    each ayah ×${config.ayahRepeats}; each complete surah ×${config.surahRepeats}; full selection ×${config.cycles === "forever" ? "∞" : config.cycles}`);
  console.log(`Pauses:  after ayah ${config.ayahDelaySeconds}s; between surah repeats ${config.delaySeconds}s`);
  console.log(color(90, "Press Ctrl+C to stop."));
}

async function main(): Promise<void> {
  const options = parseCliArgs(Bun.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }

  const cache = new DiskCache();
  if (options.web) {
    startWebServer({ port: options.port ?? 3_000, cache });
    return;
  }

  if (!process.stdin.isTTY && !options.surahIds) {
    throw new Error("Non-interactive use requires --surahs. Run with --help for usage.");
  }

  const api = new QuranClient(fetch, 15_000, cache);
  console.log(color(90, "Loading Quran.com catalog…"));
  const [allChapters, allReciters] = await Promise.all([api.chapters(), api.reciters()]);

  const reciter = options.reciterId === undefined
    ? process.stdin.isTTY
      ? await selectReciter(allReciters, DEFAULT_RECITER_ID)
      : allReciters.find((item) => item.id === DEFAULT_RECITER_ID)
    : allReciters.find((item) => item.id === options.reciterId);
  if (!reciter) throw new Error(`Reciter ID ${options.reciterId} is not available.`);

  const chapters = options.surahIds === undefined
    ? await selectChapters(allChapters)
    : allChapters.filter((chapter) => options.surahIds!.includes(chapter.id));
  if (chapters.length === 0) throw new Error("Choose at least one surah.");
  if (options.surahIds && chapters.length !== options.surahIds.length) {
    throw new Error("One or more requested surahs are unavailable.");
  }

  const config = process.stdin.isTTY
    ? await completeSessionConfig(options)
    : {
        surahRepeats: options.surahRepeats ?? 3,
        ayahRepeats: options.ayahRepeats ?? 1,
        cycles: options.cycles ?? "forever",
        delaySeconds: options.delaySeconds ?? 0,
        ayahDelaySeconds: options.ayahDelaySeconds ?? 0,
      };

  showSummary(chapters, reciter, config);
  console.log(color(90, "\nLoading ayahs and audio URLs…"));
  const chapterVerses = await Promise.all(chapters.map((chapter) => api.versesForChapter(chapter, reciter.id)));
  const player = new MpvPlayer(fetch, [], cache);
  const controller = new AbortController();
  const onSigint = () => controller.abort(new SelectionCancelledError());
  process.once("SIGINT", onSigint);

  try {
    const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    await playSession(chapterVerses, config, player, (progress) => showProgress(progress, chaptersById), controller.signal);
    console.log(color(32, "\nSession complete."));
  } finally {
    process.off("SIGINT", onSigint);
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof SelectionCancelledError) {
    console.error("\nStopped.");
    process.exitCode = 130;
  } else {
    console.error(color(31, `Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exitCode = 1;
  }
}
