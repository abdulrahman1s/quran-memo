import { describe, expect, test } from "bun:test";
import { createWorker } from "../src/worker.ts";

class MemoryCache {
  private readonly entries = new Map<string, Response>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries
      .get(String(request instanceof Request ? request.url : request))
      ?.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(
      String(request instanceof Request ? request.url : request),
      response.clone(),
    );
  }
}

function context() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
  };
}

describe("Cloudflare Worker", () => {
  test("serves and edge-caches the Quran catalog", async () => {
    let upstreamCalls = 0;
    const fetchMock = async (input: string | URL | Request) => {
      upstreamCalls += 1;
      const pathname = new URL(String(input)).pathname;
      if (pathname === "/api/v4/chapters") {
        return Response.json({
          chapters: Array.from({ length: 114 }, (_, index) => ({
            id: index + 1,
            name_simple: `Surah ${index + 1}`,
            name_arabic: `سورة ${index + 1}`,
            verses_count: 1,
          })),
        });
      }
      if (pathname === "/api/v4/resources/tafsirs") {
        return Response.json({
          tafsirs: [{ id: 169, name: "Ibn Kathir", language_name: "english" }],
        });
      }
      return Response.json({
        recitations: [
          {
            id: 6,
            reciter_name: "Mahmoud Khalil Al-Husary",
            translated_name: { name: "محمود خليل الحصري" },
          },
        ],
      });
    };
    const memoryCache = new MemoryCache();
    const worker = createWorker(
      fetchMock,
      () => memoryCache as unknown as Cache,
    );
    const request = new Request("https://quran.example/api/catalog");
    await memoryCache.put(
      request,
      Response.json({ chapters: [], legacy: true }),
    );

    const firstContext = context();
    const first = await worker.fetch(request, {} as never, firstContext);
    expect(first.status).toBe(200);
    expect(
      ((await first.json()) as { chapters: unknown[] }).chapters,
    ).toHaveLength(114);
    await Promise.all(firstContext.pending);

    const second = await worker.fetch(request, {} as never, context());
    expect(second.status).toBe(200);
    expect(upstreamCalls).toBe(4);
  });

  test("serves and edge-caches word-enabled Mushaf audio", async () => {
    let upstreamCalls = 0;
    const memoryCache = new MemoryCache();
    const worker = createWorker(
      async (input) => {
        upstreamCalls += 1;
        const url = new URL(String(input));
        if (url.pathname === "/api/v4/chapters") {
          return Response.json({
            chapters: Array.from({ length: 114 }, (_, index) => ({
              id: index + 1,
              name_simple: `Surah ${index + 1}`,
              name_arabic: `سورة ${index + 1}`,
              verses_count: index === 0 ? 2 : 1,
            })),
          });
        }
        expect(url.pathname).toBe("/api/v4/verses/by_chapter/1");
        expect(url.searchParams.get("audio")).toBe("6");
        return Response.json({
          verses: [
            {
              verse_key: "1:1",
              text_uthmani: "الأولى",
              page_number: 1,
              juz_number: 1,
              hizb_number: 1,
              audio: {
                url: "https://verses.quran.foundation/audio/1_1.mp3",
                segments: [[1, 0, 400]],
              },
              words: [
                {
                  position: 1,
                  text_uthmani: "الأولى",
                  char_type_name: "word",
                  audio_url: "wbw/001_001_001.mp3",
                  translation: { text: "the first" },
                },
              ],
            },
            {
              verse_key: "1:2",
              text_uthmani: "الثانية",
              page_number: 1,
              juz_number: 1,
              hizb_number: 1,
              audio: {
                url: "https://verses.quran.foundation/audio/1_2.mp3",
                segments: [[1, 0, 450]],
              },
              words: [
                {
                  position: 1,
                  text_uthmani: "الثانية",
                  char_type_name: "word",
                  audio_url: "wbw/001_002_001.mp3",
                  translation: { text: "the second" },
                },
              ],
            },
          ],
          pagination: { next_page: null },
        });
      },
      () => memoryCache as unknown as Cache,
    );
    const request = new Request(
      "https://quran.example/api/reading?chapter=1&reciter=6",
    );
    const firstContext = context();

    const first = await worker.fetch(request, {} as never, firstContext);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      chapter: {
        id: 1,
        nameSimple: "Surah 1",
        nameArabic: "سورة 1",
        versesCount: 2,
      },
      verses: [
        {
          verseKey: "1:1",
          arabic: "الأولى",
          pageNumber: 1,
          juzNumber: 1,
          hizbNumber: 1,
          audioUrl:
            "/api/audio?source=https%3A%2F%2Fverses.quran.foundation%2Faudio%2F1_1.mp3",
          words: [
            {
              position: 1,
              text: "الأولى",
              audioUrl: "https://audio.qurancdn.com/wbw/001_001_001.mp3",
              meaning: "the first",
            },
          ],
          wordTimings: [{ position: 1, startMs: 0, endMs: 400 }],
        },
        {
          verseKey: "1:2",
          arabic: "الثانية",
          pageNumber: 1,
          juzNumber: 1,
          hizbNumber: 1,
          audioUrl:
            "/api/audio?source=https%3A%2F%2Fverses.quran.foundation%2Faudio%2F1_2.mp3",
          words: [
            {
              position: 1,
              text: "الثانية",
              audioUrl: "https://audio.qurancdn.com/wbw/001_002_001.mp3",
              meaning: "the second",
            },
          ],
          wordTimings: [{ position: 1, startMs: 0, endMs: 450 }],
        },
      ],
    });
    await Promise.all(firstContext.pending);

    const second = await worker.fetch(request, {} as never, context());
    expect(second.status).toBe(200);
    expect(upstreamCalls).toBe(2);
  });

  test("rejects an out-of-range reading Surah", async () => {
    const worker = createWorker(
      async () => new Response("unused"),
      () => new MemoryCache() as unknown as Cache,
    );
    const response = await worker.fetch(
      new Request("https://quran.example/api/reading?chapter=115"),
      {} as never,
      context(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Surah is invalid." });
  });

  test("rejects an untrusted audio proxy source", async () => {
    const worker = createWorker(
      async () => new Response("unused"),
      () => new MemoryCache() as unknown as Cache,
    );
    const response = await worker.fetch(
      new Request(
        "https://quran.example/api/audio?source=https%3A%2F%2Fevil.example%2Fa.mp3",
      ),
      {} as never,
      context(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Audio source is unavailable.",
    });
  });

  test("forwards audio range requests without caching partial responses", async () => {
    const memoryCache = new MemoryCache();
    const receivedRanges: Array<string | null> = [];
    const worker = createWorker(
      async (_input, init) => {
        receivedRanges.push(new Headers(init?.headers).get("range"));
        return new Response("audio", {
          status: 206,
          headers: {
            "content-type": "audio/mpeg",
            "content-range": "bytes 10-14/100",
          },
        });
      },
      () => memoryCache as unknown as Cache,
    );
    const request = new Request(
      "https://quran.example/api/audio?source=https%3A%2F%2Fverses.quran.foundation%2Fa.mp3",
      { headers: { range: "bytes=10-14" } },
    );

    const response = await worker.fetch(request, {} as never, context());

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 10-14/100");
    expect(receivedRanges).toEqual(["bytes=10-14"]);
    expect(await memoryCache.match(request)).toBeUndefined();
  });

  test("serves and caches a single-Ayah Tafsir", async () => {
    let calls = 0;
    const worker = createWorker(
      async (input) => {
        calls += 1;
        expect(new URL(String(input)).pathname).toBe(
          "/api/v4/tafsirs/169/by_ayah/1%3A1",
        );
        return Response.json({ tafsir: { text: "<p>An explanation.</p>" } });
      },
      () => new MemoryCache() as unknown as Cache,
    );
    const response = await worker.fetch(
      new Request("https://quran.example/api/tafsir?tafsir=169&verse=1%3A1"),
      {} as never,
      context(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "An explanation." });
    expect(calls).toBe(1);
  });

  test("serves a distinct Arabic meaning for the selected Quran word", async () => {
    const worker = createWorker(
      async (input) => {
        expect(new URL(String(input)).pathname).toBe("/v1/ayah/1/2/book/2013");
        return Response.json({
          book: {
            name: "معاني الكلمات من كتاب السراج",
            author: { ar_name: "محمد الخضيري" },
          },
          content: [
            {
              text: "رَبِّ: الرَّبُّ المُرَبِّي لِخَلْقِهِ.<br>الْعَالَمِينَ: كُلِّ مَنْ سِوَى اللهِ تَعَالَى.",
            },
          ],
        });
      },
      () => new MemoryCache() as unknown as Cache,
    );
    const response = await worker.fetch(
      new Request(
        "https://quran.example/api/word-meaning?verse=1%3A2&word=%D9%B1%D9%84%D9%92%D8%B9%D9%8E%D9%80%D9%B0%D9%84%D9%8E%D9%85%D9%90%D9%8A%D9%86%D9%8E",
      ),
      {} as never,
      context(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      matchedWord: "الْعَالَمِينَ",
      text: "كُلِّ مَنْ سِوَى اللهِ تَعَالَى.",
      sourceAuthor: "محمد الخضيري",
    });
  });
});
