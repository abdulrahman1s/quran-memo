export interface WordTiming {
  position: number;
  startMs: number;
  endMs: number;
}

export const DEFAULT_HIGHLIGHT_DELAY_MS = 250;

export function activeWordPosition(
  timings: readonly WordTiming[],
  playbackMs: number,
  delayMs = DEFAULT_HIGHLIGHT_DELAY_MS,
): number | null {
  const synchronizedMs = Math.max(0, playbackMs - delayMs);
  return (
    timings.find(
      (timing) =>
        synchronizedMs >= timing.startMs && synchronizedMs < timing.endMs,
    )?.position ?? null
  );
}

export function wordStartSeconds(
  timings: readonly WordTiming[],
  position: number,
): number | null {
  const timing = timings.find((item) => item.position === position);
  return timing ? Math.max(0, timing.startMs) / 1000 : null;
}

export interface WordPlaybackSegment {
  startSeconds: number;
  endSeconds: number;
}

export function wordPlaybackSegment(
  timings: readonly WordTiming[],
  position: number,
): WordPlaybackSegment | null {
  const timing = timings.find((item) => item.position === position);
  if (!timing || timing.endMs <= timing.startMs) return null;
  return {
    startSeconds: Math.max(0, timing.startMs) / 1000,
    endSeconds: Math.max(0, timing.endMs) / 1000,
  };
}
