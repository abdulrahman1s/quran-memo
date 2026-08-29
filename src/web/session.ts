export type QuizAudioStep =
  | { action: "question"; surahIndex: number; verseIndex: number }
  | { action: "next-surah"; surahIndex: number; verseIndex: 0 }
  | { action: "finish"; surahIndex: number; verseIndex: number };

export function quizStepAfterAudio(
  surahIndex: number,
  verseIndex: number,
  verseCount: number,
  surahCount: number,
): QuizAudioStep {
  if (verseIndex + 1 < verseCount) {
    return { action: "question", surahIndex, verseIndex };
  }
  if (surahIndex + 1 < surahCount) {
    return { action: "next-surah", surahIndex: surahIndex + 1, verseIndex: 0 };
  }
  return { action: "finish", surahIndex, verseIndex };
}
