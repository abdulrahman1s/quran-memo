import { describe, expect, test } from "bun:test";
import { createWorker } from "../src/worker.ts";

class MemoryCache {
  private readonly entries = new Map<string, Response>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(String(request instanceof Request ? request.url : request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(String(request instanceof Request ? request.url : request), response.clone());
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
        recitations: [{
          id: 6,
          reciter_name: "Mahmoud Khalil Al-Husary",
          translated_name: { name: "محمود خليل الحصري" },
        }],
      });
    };
    const memoryCache = new MemoryCache();
    const worker = createWorker(fetchMock, () => memoryCache as unknown as Cache);
    const request = new Request("https://quran.example/api/catalog");
    await memoryCache.put(request, Response.json({ chapters: [], legacy: true }));

    const firstContext = context();
    const first = await worker.fetch(request, {} as never, firstContext);
    expect(first.status).toBe(200);
    expect((await first.json() as { chapters: unknown[] }).chapters).toHaveLength(114);
    await Promise.all(firstContext.pending);

    const second = await worker.fetch(request, {} as never, context());
    expect(second.status).toBe(200);
    expect(upstreamCalls).toBe(4);
  });

  test("rejects an untrusted audio proxy source", async () => {
    const worker = createWorker(async () => new Response("unused"), () => new MemoryCache() as unknown as Cache);
    const response = await worker.fetch(
      new Request("https://quran.example/api/audio?source=https%3A%2F%2Fevil.example%2Fa.mp3"),
      {} as never,
      context(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Audio source is unavailable." });
  });

  test("serves and caches a single-Ayah Tafsir", async () => {
    let calls = 0;
    const worker = createWorker(async (input) => {
      calls += 1;
      expect(new URL(String(input)).pathname).toBe("/api/v4/tafsirs/169/by_ayah/1%3A1");
      return Response.json({ tafsir: { text: "<p>An explanation.</p>" } });
    }, () => new MemoryCache() as unknown as Cache);
    const response = await worker.fetch(
      new Request("https://quran.example/api/tafsir?tafsir=169&verse=1%3A1"),
      {} as never,
      context(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "An explanation." });
    expect(calls).toBe(1);
  });
});
