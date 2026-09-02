import type { TajweedRuleId } from "./tajweed.ts";

export interface Chapter {
  id: number;
  nameSimple: string;
  nameArabic: string;
  versesCount: number;
}

export interface Reciter {
  id: number;
  nameEnglish: string;
  nameArabic: string;
  style: string | null;
}

export interface TafsirResource {
  id: number;
  nameEnglish: string;
  nameArabic: string;
  languageName: string;
}

export interface Verse {
  verseKey: string;
  chapterId: number;
  juzNumber?: number;
  hizbNumber?: number;
  arabic: string;
  translation: string;
  audioUrl: string;
  words?: Array<{ position: number; text: string }>;
  wordTimings?: Array<{ position: number; startMs: number; endMs: number }>;
}

export interface ReadingVerse {
  verseKey: string;
  arabic: string;
  pageNumber: number;
  juzNumber: number;
  hizbNumber: number;
  audioUrl: string;
  words: Array<{
    position: number;
    text: string;
    audioUrl?: string;
    meaning?: string;
    tajweedRules?: TajweedRuleId[];
  }>;
  wordTimings: Array<{ position: number; startMs: number; endMs: number }>;
}

export type SessionCycles = number | "forever";

export interface SessionConfig {
  ayahRepeats: number;
  surahRepeats: number;
  cycles: SessionCycles;
  ayahDelaySeconds: number;
  delaySeconds: number;
}

export interface CliOptions extends Partial<SessionConfig> {
  surahIds?: number[];
  reciterId?: number;
  web: boolean;
  port?: number;
  help: boolean;
}
