export interface QuizChoice {
  verseKey: string;
  arabic: string;
}

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function buildQuizChoices(
  correct: QuizChoice,
  pool: readonly QuizChoice[],
  random: () => number = Math.random,
): QuizChoice[] {
  const unique = new Map(pool.map((choice) => [choice.verseKey, choice]));
  unique.delete(correct.verseKey);
  const distractors = shuffled([...unique.values()], random).slice(0, 3);
  if (distractors.length < 3) throw new Error("At least four unique ayahs are required for a quiz question.");
  return shuffled([correct, ...distractors], random);
}

export function accuracy(correct: number, total: number): number {
  return total === 0 ? 100 : Math.round((correct / total) * 100);
}
