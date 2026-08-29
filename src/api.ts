import type { Chapter, Reciter, TafsirResource, Verse } from "./types.ts";
import { REQUEST_CACHE_TTL_MS, type JsonCache } from "./json-cache.ts";

const API_BASE = "https://api.quran.com/api/v4";
const AUDIO_BASE = "https://verses.quran.foundation/";
export const ENGLISH_TRANSLATION_ID = 85;
export const DEFAULT_RECITER_ID = 6;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface ChaptersResponse {
  chapters?: Array<{
    id?: number;
    name_simple?: string;
    name_arabic?: string;
    verses_count?: number;
  }>;
}

interface RecitationsResponse {
  recitations?: Array<{
    id?: number;
    reciter_name?: string;
    style?: string | null;
    translated_name?: { name?: string };
  }>;
}

interface VersesResponse {
  verses?: Array<{
    verse_key?: string;
    text_uthmani?: string;
    audio?: { url?: string; segments?: number[][] };
    translations?: Array<{ text?: string }> | null;
    words?: Array<{
      position?: number;
      text_uthmani?: string;
      char_type_name?: string;
    }>;
  }>;
  pagination?: {
    current_page?: number;
    next_page?: number | null;
    total_pages?: number;
  };
}

interface RandomVerseResponse {
  verse?: { verse_key?: string; text_uthmani?: string };
}

interface TafsirsResponse {
  tafsirs?: Array<{
    id?: number;
    name?: string;
    language_name?: string;
    translated_name?: { name?: string };
  }>;
}

interface VerseTafsirResponse {
  tafsir?: { text?: string };
}

export class QuranApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "QuranApiError";
  }
}

export function stripTranslationHtml(input: string): string {
  const withoutTags = input
    .replace(/<sup\b[^>]*>.*?<\/sup>/gis, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return withoutTags
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => ({
      amp: "&",
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">",
      nbsp: " ",
    })[entity.toLowerCase()]!)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function resolveAudioUrl(path: string): string {
  const normalized = path.trim();
  if (normalized.startsWith("//")) return `https:${normalized}`;
  try {
    return new URL(normalized).toString();
  } catch {
    return new URL(normalized.replace(/^\/+/, ""), AUDIO_BASE).toString();
  }
}

export class QuranClient {
  constructor(
    private readonly fetchFn: FetchLike = fetch,
    private readonly timeoutMs = 15_000,
    private readonly cache?: JsonCache,
  ) {}

  private async getJson<T>(path: string): Promise<T> {
    const cacheKey = `quran-api:${path}`;
    const cached = await this.cache?.getJson<T>(cacheKey, REQUEST_CACHE_TTL_MS);
    if (cached !== undefined && cached !== null) return cached;
    const stale = await this.cache?.getJson<T>(cacheKey, Number.POSITIVE_INFINITY);

    let response: Response;
    try {
      response = await this.fetchFn(`${API_BASE}${path}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (stale !== undefined && stale !== null) return stale;
      const detail = error instanceof Error ? error.message : String(error);
      throw new QuranApiError(`Could not reach Quran.com: ${detail}`);
    }

    if (!response.ok) {
      if (stale !== undefined && stale !== null) return stale;
      throw new QuranApiError(`Quran.com returned HTTP ${response.status} for ${path}.`, response.status);
    }
    let data: T;
    try {
      data = await response.json() as T;
    } catch {
      if (stale !== undefined && stale !== null) return stale;
      throw new QuranApiError(`Quran.com returned invalid JSON for ${path}.`);
    }
    await this.cache?.setJson(cacheKey, data).catch(() => {});
    return data;
  }

  async chapters(): Promise<Chapter[]> {
    const data = await this.getJson<ChaptersResponse>("/chapters?language=en");
    if (!Array.isArray(data.chapters) || data.chapters.length !== 114) {
      throw new QuranApiError("Quran.com returned an incomplete chapter catalog.");
    }
    return data.chapters.map((chapter) => {
      if (
        typeof chapter.id !== "number" ||
        typeof chapter.name_simple !== "string" ||
        typeof chapter.name_arabic !== "string" ||
        typeof chapter.verses_count !== "number"
      ) throw new QuranApiError("Quran.com returned malformed chapter metadata.");
      return {
        id: chapter.id,
        nameSimple: chapter.name_simple,
        nameArabic: chapter.name_arabic,
        versesCount: chapter.verses_count,
      };
    });
  }

  async reciters(): Promise<Reciter[]> {
    const data = await this.getJson<RecitationsResponse>("/resources/recitations?language=ar");
    if (!Array.isArray(data.recitations) || data.recitations.length === 0) {
      throw new QuranApiError("Quran.com returned no ayah reciters.");
    }
    return data.recitations.map((reciter) => {
      if (typeof reciter.id !== "number" || typeof reciter.reciter_name !== "string") {
        throw new QuranApiError("Quran.com returned malformed reciter metadata.");
      }
      return {
        id: reciter.id,
        nameEnglish: reciter.reciter_name,
        nameArabic: reciter.translated_name?.name || reciter.reciter_name,
        style: reciter.style ?? (reciter.id === DEFAULT_RECITER_ID ? "Murattal" : null),
      };
    });
  }

  async tafsirs(): Promise<TafsirResource[]> {
    const [english, arabic] = await Promise.all([
      this.getJson<TafsirsResponse>("/resources/tafsirs?language=en"),
      this.getJson<TafsirsResponse>("/resources/tafsirs?language=ar"),
    ]);
    if (!Array.isArray(english.tafsirs) || english.tafsirs.length === 0) {
      throw new QuranApiError("Quran.com returned no Tafsir resources.");
    }
    const arabicNames = new Map((arabic.tafsirs ?? []).map((tafsir) => [
      tafsir.id, tafsir.translated_name?.name || tafsir.name,
    ]));
    return english.tafsirs.flatMap((tafsir) => {
      if (typeof tafsir.id !== "number" || typeof tafsir.name !== "string") return [];
      return [{
        id: tafsir.id,
        nameEnglish: tafsir.translated_name?.name || tafsir.name,
        nameArabic: arabicNames.get(tafsir.id) || tafsir.name,
        languageName: tafsir.language_name || "unknown",
      }];
    });
  }

  async tafsirForVerse(tafsirId: number, verseKey: string): Promise<string> {
    if (!Number.isInteger(tafsirId) || tafsirId < 1 || !/^\d{1,3}:\d{1,3}$/.test(verseKey)) {
      throw new QuranApiError("The requested Tafsir is invalid.");
    }
    const data = await this.getJson<VerseTafsirResponse>(
      `/tafsirs/${tafsirId}/by_ayah/${encodeURIComponent(verseKey)}`,
    );
    const text = data.tafsir?.text;
    if (typeof text !== "string") throw new QuranApiError("Tafsir is unavailable for this Ayah.");
    return stripTranslationHtml(text);
  }

  async randomVerseText(): Promise<{ verseKey: string; arabic: string }> {
    let response: Response;
    try {
      response = await this.fetchFn(`${API_BASE}/verses/random?fields=text_uthmani`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new QuranApiError(`Could not fetch a random ayah: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new QuranApiError(`Quran.com returned HTTP ${response.status} for a random ayah.`);
    const data = await response.json() as RandomVerseResponse;
    if (typeof data.verse?.verse_key !== "string" || typeof data.verse.text_uthmani !== "string") {
      throw new QuranApiError("Quran.com returned malformed random ayah data.");
    }
    return { verseKey: data.verse.verse_key, arabic: data.verse.text_uthmani };
  }

  async versesForChapter(chapter: Chapter, reciterId: number): Promise<Verse[]> {
    const verses: Verse[] = [];
    let page = 1;

    while (true) {
      const query = new URLSearchParams({
        translations: String(ENGLISH_TRANSLATION_ID),
        audio: String(reciterId),
        fields: "text_uthmani",
        words: "true",
        word_fields: "text_uthmani",
        per_page: "50",
        page: String(page),
      });
      const data = await this.getJson<VersesResponse>(`/verses/by_chapter/${chapter.id}?${query}`);
      if (!Array.isArray(data.verses)) {
        throw new QuranApiError(`Quran.com returned malformed verses for surah ${chapter.id}.`);
      }

      for (const raw of data.verses) {
        const translation = raw.translations?.[0]?.text;
        const audio = raw.audio?.url;
        if (
          typeof raw.verse_key !== "string" ||
          typeof raw.text_uthmani !== "string" ||
          typeof translation !== "string" ||
          typeof audio !== "string"
        ) {
          throw new QuranApiError(
            `Verse data for ${raw.verse_key ?? `surah ${chapter.id}`} is missing text, translation, or audio.`,
          );
        }
        verses.push({
          verseKey: raw.verse_key,
          chapterId: chapter.id,
          arabic: raw.text_uthmani,
          translation: stripTranslationHtml(translation),
          audioUrl: resolveAudioUrl(audio),
          words: (raw.words ?? [])
            .filter((word) => word.char_type_name === "word" && typeof word.position === "number" && typeof word.text_uthmani === "string")
            .map((word) => ({ position: word.position!, text: word.text_uthmani! })),
          wordTimings: (raw.audio?.segments ?? []).flatMap((segment) => {
            if (segment.length >= 4) {
              const [, position, startMs, endMs] = segment;
              return Number.isFinite(position) && Number.isFinite(startMs) && Number.isFinite(endMs)
                ? [{ position: position!, startMs: startMs!, endMs: endMs! }]
                : [];
            }
            if (segment.length === 3) {
              const [position, startMs, endMs] = segment;
              return Number.isFinite(position) && Number.isFinite(startMs) && Number.isFinite(endMs)
                ? [{ position: position!, startMs: startMs!, endMs: endMs! }]
                : [];
            }
            return [];
          }),
        });
      }

      const nextPage = data.pagination?.next_page;
      if (nextPage === null || nextPage === undefined) break;
      if (!Number.isInteger(nextPage) || nextPage <= page) {
        throw new QuranApiError(`Quran.com returned invalid pagination for surah ${chapter.id}.`);
      }
      page = nextPage;
    }

    if (verses.length !== chapter.versesCount) {
      throw new QuranApiError(
        `Expected ${chapter.versesCount} ayahs for surah ${chapter.id}, received ${verses.length}.`,
      );
    }
    return verses;
  }
}
