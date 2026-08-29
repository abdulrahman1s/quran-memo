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
  return timings.find((timing) => synchronizedMs >= timing.startMs && synchronizedMs < timing.endMs)?.position ?? null;
}
