import type { SessionConfig, Verse } from "./types.ts";
import { DiskCache } from "./cache.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface AudioPlayer {
  play(url: string, signal: AbortSignal): Promise<void>;
}

export interface PlaybackProgress {
  verse: Verse;
  verseIndex: number;
  verseCount: number;
  surahIndex: number;
  surahCount: number;
  surahRepeat: number;
  surahRepeats: number;
  ayahRepeat: number;
  ayahRepeats: number;
  cycle: number;
  cycles: number | "forever";
}

export class MpvPlayer implements AudioPlayer {
  readonly executable: string;

  constructor(
    private readonly fetchFn: FetchLike = fetch,
    private readonly extraArgs: string[] = [],
    private readonly cache?: DiskCache,
  ) {
    const executable = Bun.which("mpv");
    if (!executable) {
      throw new Error("mpv is required for audio playback. Install mpv and ensure it is on PATH.");
    }
    this.executable = executable;
  }

  async play(url: string, signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw signal.reason;
    const cachedPath = this.cache ? await this.cache.cacheAudio(url, this.fetchFn, signal) : null;
    let response: Response;
    if (!cachedPath) {
      try {
        response = await this.fetchFn(url, { signal });
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        throw new Error(`Could not stream audio: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!response.ok) throw new Error(`Audio server returned HTTP ${response.status} for ${url}.`);
      if (!response.body) throw new Error("Audio server returned an empty stream.");
    }

    const process = Bun.spawn([
      this.executable,
      "--no-video",
      "--audio-display=no",
      "--no-terminal",
      "--really-quiet",
      ...this.extraArgs,
      cachedPath ?? "-",
    ], {
      stdin: cachedPath ? "ignore" : "pipe",
      stdout: "ignore",
      stderr: "pipe",
    });

    const stop = () => process.kill();
    signal.addEventListener("abort", stop, { once: true });
    try {
      const stderrPromise = new Response(process.stderr).text();
      const streamPromise = cachedPath ? Promise.resolve() : (async () => {
        const stdin = process.stdin;
        if (!stdin) throw new Error("mpv standard input is unavailable.");
        const reader = response!.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            stdin.write(value);
            await stdin.flush();
          }
        } finally {
          stdin.end();
          reader.releaseLock();
        }
      })();
      const [exitCode, stderr] = await Promise.all([process.exited, stderrPromise, streamPromise]);
      if (signal.aborted) throw signal.reason;
      if (exitCode !== 0) {
        throw new Error(`mpv failed with status ${exitCode}${stderr.trim() ? `: ${stderr.trim()}` : "."}`);
      }
    } catch (error) {
      process.kill();
      if (signal.aborted) throw signal.reason;
      throw error;
    } finally {
      signal.removeEventListener("abort", stop);
    }
  }
}

type Sleep = (milliseconds: number) => Promise<unknown>;

async function waitForDelay(milliseconds: number, sleep: Sleep, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw signal.reason;
  let removeAbortListener = () => {};
  const aborted = new Promise<never>((_, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", onAbort);
  });
  try {
    await Promise.race([sleep(milliseconds), aborted]);
  } finally {
    removeAbortListener();
  }
}

export async function playSession(
  surahs: Verse[][],
  config: SessionConfig,
  player: AudioPlayer,
  onProgress: (progress: PlaybackProgress) => void,
  signal: AbortSignal,
  sleep: Sleep = Bun.sleep,
): Promise<void> {
  if (surahs.length === 0 || surahs.some((verses) => verses.length === 0)) {
    throw new Error("Every selected surah must contain at least one ayah.");
  }
  const totalCycles = config.cycles === "forever" ? Number.POSITIVE_INFINITY : config.cycles;

  for (let cycle = 1; cycle <= totalCycles; cycle += 1) {
    for (let surahIndex = 0; surahIndex < surahs.length; surahIndex += 1) {
      const verses = surahs[surahIndex]!;
      for (let surahRepeat = 1; surahRepeat <= config.surahRepeats; surahRepeat += 1) {
        for (let verseIndex = 0; verseIndex < verses.length; verseIndex += 1) {
          for (let ayahRepeat = 1; ayahRepeat <= config.ayahRepeats; ayahRepeat += 1) {
            if (signal.aborted) throw signal.reason;
            const verse = verses[verseIndex]!;
            onProgress({
              verse,
              verseIndex,
              verseCount: verses.length,
              surahIndex,
              surahCount: surahs.length,
              surahRepeat,
              surahRepeats: config.surahRepeats,
              ayahRepeat,
              ayahRepeats: config.ayahRepeats,
              cycle,
              cycles: config.cycles,
            });
            await player.play(verse.audioUrl, signal);
            const anotherAyahPlayback = ayahRepeat < config.ayahRepeats || verseIndex + 1 < verses.length;
            if (config.ayahDelaySeconds > 0 && anotherAyahPlayback) {
              await waitForDelay(config.ayahDelaySeconds * 1_000, sleep, signal);
            }
          }
        }
        if (config.delaySeconds > 0 && surahRepeat < config.surahRepeats) {
          await waitForDelay(config.delaySeconds * 1_000, sleep, signal);
        }
      }
    }
  }
}
