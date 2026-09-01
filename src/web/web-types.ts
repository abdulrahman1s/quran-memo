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

export interface ArabicWordMeaningPayload {
  text: string;
  matchedWord?: string;
  sourceName: string;
  sourceAuthor: string;
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

export interface SessionGroup { chapter: Chapter; verses: Verse[] }
export interface SessionPayload { groups: SessionGroup[]; quizPool: Array<{ verseKey: string; arabic: string }> }
export interface ReadingPayload {
  chapter: Chapter;
  verses: Array<{
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
    }>;
    wordTimings: Array<{
      position: number;
      startMs: number;
      endMs: number;
    }>;
  }>;
}
export interface CatalogPayload {
  chapters: Chapter[];
  reciters: Reciter[];
  tafsirs: TafsirResource[];
  defaultReciterId: number;
}
