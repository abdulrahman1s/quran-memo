export interface TransitionScore {
  correct: number;
  wrong: number;
}

export type TransitionScores = Record<string, TransitionScore>;

export function transitionKey(currentVerseKey: string, nextVerseKey: string): string {
  return `${currentVerseKey}>${nextVerseKey}`;
}

export function recordTransition(scores: TransitionScores, key: string, correct: boolean): TransitionScores {
  const previous = scores[key] ?? { correct: 0, wrong: 0 };
  return {
    ...scores,
    [key]: {
      correct: previous.correct + (correct ? 1 : 0),
      wrong: previous.wrong + (correct ? 0 : 1),
    },
  };
}

export function weakness(score: TransitionScore | undefined): number {
  if (!score) return 0;
  return (score.wrong * 2) - score.correct;
}

export function weakestTransitions<T extends { key: string }>(
  transitions: readonly T[],
  scores: TransitionScores,
  maximum = 8,
): T[] {
  return transitions
    .map((transition, index) => ({ transition, index, weight: weakness(scores[transition.key]) }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, maximum)
    .map((entry) => entry.transition);
}
