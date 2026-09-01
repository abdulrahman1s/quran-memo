import { describe, expect, test } from "bun:test";
import {
  QuranApiError,
  QuranClient,
  resolveAudioUrl,
  selectArabicWordMeaning,
  stripTranslationHtml,
} from "../src/api.ts";
import type { Chapter } from "../src/types.ts";

describe("Quran API helpers", () => {
  test("turns translation HTML into terminal-safe text", () => {
    expect(
      stripTranslationHtml(
        "God &amp; mankind<sup foot_note=1>1</sup><br>Next&nbsp;line",
      ),
    ).toBe("God & mankind\nNext line");
  });

  test("resolves relative audio paths and preserves absolute URLs", () => {
    expect(resolveAudioUrl("Alafasy/mp3/001001.mp3")).toBe(
      "https://verses.quran.foundation/Alafasy/mp3/001001.mp3",
    );
    expect(resolveAudioUrl("https://cdn.example/ayah.mp3")).toBe(
      "https://cdn.example/ayah.mp3",
    );
  });

  test("selects an Arabic Quran word meaning despite Uthmani marks", () => {
    expect(
      selectArabicWordMeaning(
        "رَبِّ: الرَّبُّ المُرَبِّي لِخَلْقِهِ.<br>الْعَالَمِينَ: كُلِّ مَنْ سِوَى اللهِ تَعَالَى.",
        "ٱلْعَـٰلَمِينَ",
      ),
    ).toEqual({
      word: "الْعَالَمِينَ",
      meaning: "كُلِّ مَنْ سِوَى اللهِ تَعَالَى.",
    });
  });

  test("resolves protocol-relative Quranicaudio mirror URLs", () => {
    expect(
      resolveAudioUrl(
        "//mirrors.quranicaudio.com/everyayah/Husary_64kbps/005001.mp3",
      ),
    ).toBe(
      "https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/005001.mp3",
    );
  });
});

describe("QuranClient.versesForChapter", () => {
  const chapter: Chapter = {
    id: 1,
    nameSimple: "Al-Fatihah",
    nameArabic: "الفاتحة",
    versesCount: 2,
  };

  test("follows pagination and maps verse content", async () => {
    const pages: number[] = [];
    const fetchMock = async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page"));
      expect(url.searchParams.get("fields")).toContain("juz_number");
      expect(url.searchParams.get("fields")).toContain("hizb_number");
      pages.push(page);
      const verse =
        page === 1
          ? {
              verse_key: "1:1",
              juz_number: 1,
              hizb_number: 1,
              text_uthmani: "الأولى",
              audio: { url: "r/1.mp3", segments: [[0, 1, 100, 500]] },
              translations: [{ text: "First" }],
              words: [
                { position: 1, text_uthmani: "الأولى", char_type_name: "word" },
              ],
            }
          : {
              verse_key: "1:2",
              text_uthmani: "الثانية",
              audio: { url: "r/2.mp3" },
              translations: [{ text: "Second" }],
            };
      return Response.json({
        verses: [verse],
        pagination: {
          current_page: page,
          next_page: page === 1 ? 2 : null,
          total_pages: 2,
        },
      });
    };

    const client = new QuranClient(fetchMock);
    const verses = await client.versesForChapter(chapter, 7);

    expect(pages).toEqual([1, 2]);
    expect(verses.map((verse) => verse.verseKey)).toEqual(["1:1", "1:2"]);
    expect(verses[0]?.audioUrl).toBe("https://verses.quran.foundation/r/1.mp3");
    expect(verses[0]?.juzNumber).toBe(1);
    expect(verses[0]?.hizbNumber).toBe(1);
    expect(verses[0]?.words).toEqual([{ position: 1, text: "الأولى" }]);
    expect(verses[0]?.wordTimings).toEqual([
      { position: 1, startMs: 100, endMs: 500 },
    ]);
  });

  test("rejects missing audio or translation data", async () => {
    const client = new QuranClient(async () =>
      Response.json({
        verses: [
          {
            verse_key: "1:1",
            text_uthmani: "text",
            audio: null,
            translations: [],
          },
        ],
        pagination: { next_page: null },
      }),
    );
    await expect(
      client.versesForChapter({ ...chapter, versesCount: 1 }, 7),
    ).rejects.toBeInstanceOf(QuranApiError);
  });

  test("rejects incomplete chapter results", async () => {
    const client = new QuranClient(async () =>
      Response.json({
        verses: [
          {
            verse_key: "1:1",
            text_uthmani: "text",
            audio: { url: "r/1.mp3" },
            translations: [{ text: "First" }],
          },
        ],
        pagination: { next_page: null },
      }),
    );
    await expect(client.versesForChapter(chapter, 7)).rejects.toThrow(
      "Expected 2 ayahs",
    );
  });
});

describe("QuranClient.readingVersesForChapter", () => {
  const chapter: Chapter = {
    id: 2,
    nameSimple: "Al-Baqarah",
    nameArabic: "البقرة",
    versesCount: 2,
  };

  test("fetches paginated reading text with words and full-ayah audio", async () => {
    const pages: number[] = [];
    const client = new QuranClient(async (input) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page"));
      pages.push(page);
      expect(url.searchParams.get("audio")).toBe("7");
      expect(url.searchParams.has("translations")).toBe(false);
      expect(url.searchParams.get("words")).toBe("true");
      expect(url.searchParams.get("fields")).toContain("page_number");
      expect(url.searchParams.get("fields")).toContain("juz_number");
      expect(url.searchParams.get("fields")).toContain("hizb_number");
      return Response.json({
        verses: [
          {
            verse_key: `2:${page}`,
            text_uthmani: page === 1 ? "الأولى" : "الثانية",
            page_number: page + 1,
            juz_number: 1,
            hizb_number: page,
            audio: {
              url: `audio/2_${page}.mp3`,
              segments: [[1, 0, 420]],
            },
            words: [
              {
                position: 1,
                text_uthmani: page === 1 ? "الأولى" : "الثانية",
                char_type_name: "word",
                audio_url: `wbw/002_00${page}_001.mp3`,
                translation: {
                  text: page === 1 ? "the first" : "the second",
                  language_name: "english",
                },
              },
            ],
          },
        ],
        pagination: { next_page: page === 1 ? 2 : null },
      });
    });

    expect(await client.readingVersesForChapter(chapter, 7)).toEqual([
      {
        verseKey: "2:1",
        arabic: "الأولى",
        pageNumber: 2,
        juzNumber: 1,
        hizbNumber: 1,
        audioUrl: "https://verses.quran.foundation/audio/2_1.mp3",
        words: [
          {
            position: 1,
            text: "الأولى",
            audioUrl: "https://audio.qurancdn.com/wbw/002_001_001.mp3",
            meaning: "the first",
          },
        ],
        wordTimings: [{ position: 1, startMs: 0, endMs: 420 }],
      },
      {
        verseKey: "2:2",
        arabic: "الثانية",
        pageNumber: 3,
        juzNumber: 1,
        hizbNumber: 2,
        audioUrl: "https://verses.quran.foundation/audio/2_2.mp3",
        words: [
          {
            position: 1,
            text: "الثانية",
            audioUrl: "https://audio.qurancdn.com/wbw/002_002_001.mp3",
            meaning: "the second",
          },
        ],
        wordTimings: [{ position: 1, startMs: 0, endMs: 420 }],
      },
    ]);
    expect(pages).toEqual([1, 2]);
  });

  test("rejects malformed or incomplete reading text", async () => {
    const malformed = new QuranClient(async () =>
      Response.json({
        verses: [{ verse_key: "2:1" }],
        pagination: { next_page: null },
      }),
    );
    await expect(
      malformed.readingVersesForChapter({ ...chapter, versesCount: 1 }, 7),
    ).rejects.toBeInstanceOf(QuranApiError);

    const incomplete = new QuranClient(async () =>
      Response.json({
        verses: [
          {
            verse_key: "2:1",
            text_uthmani: "الأولى",
            page_number: 2,
            juz_number: 1,
            hizb_number: 1,
            audio: { url: "audio/2_1.mp3", segments: [] },
            words: [],
          },
        ],
        pagination: { next_page: null },
      }),
    );
    await expect(
      incomplete.readingVersesForChapter(chapter, 7),
    ).rejects.toThrow("Expected 2 ayahs");
  });
});

test("Al-Husary ID 6 is identified as the default Murattal recitation", async () => {
  const client = new QuranClient(async () =>
    Response.json({
      recitations: [
        {
          id: 6,
          reciter_name: "Mahmoud Khalil Al-Husary",
          style: null,
          translated_name: { name: "محمود خليل الحصري" },
        },
      ],
    }),
  );
  expect(await client.reciters()).toEqual([
    {
      id: 6,
      nameEnglish: "Mahmoud Khalil Al-Husary",
      nameArabic: "محمود خليل الحصري",
      style: "Murattal",
    },
  ]);
});

test("Tafsir resources and verse text are normalized", async () => {
  const client = new QuranClient(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname;
    return path.endsWith("/resources/tafsirs")
      ? Response.json({
          tafsirs: [
            {
              id: 169,
              name: "Tafsir",
              language_name: "english",
              translated_name: {
                name:
                  url.searchParams.get("language") === "ar"
                    ? "التفسير"
                    : "Tafsir",
              },
            },
            {
              id: 16,
              name: "Tafsir Muyassar",
              language_name: "arabic",
              translated_name: { name: "Tafsir Muyassar" },
            },
          ],
        })
      : Response.json({
          tafsir: { text: "Meaning <sup>1</sup>&amp; context" },
        });
  });
  expect(await client.tafsirs()).toEqual([
    {
      id: 169,
      nameEnglish: "Tafsir",
      nameArabic: "التفسير",
      languageName: "english",
    },
    {
      id: 16,
      nameEnglish: "Tafsir Muyassar",
      nameArabic: "التفسير الميسر",
      languageName: "arabic",
    },
  ]);
  expect(await client.tafsirForVerse(169, "1:1")).toBe("Meaning & context");
});
