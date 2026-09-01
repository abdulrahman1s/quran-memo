import { DEFAULT_RECITER_ID, QuranClient } from "./api.ts";
import { parseSurahSpec } from "./surah-spec.ts";

const CATALOG_TTL_SECONDS = 24 * 60 * 60;
const SESSION_TTL_SECONDS = 5 * 60;
const AUDIO_TTL_SECONDS = 365 * 24 * 60 * 60;
const CATALOG_CACHE_VERSION = "3";
const READING_CACHE_VERSION = "4";
const SESSION_CACHE_VERSION = "2";
const TAFSIR_CACHE_VERSION = "2";

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerEnvironment {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function errorResponse(error: unknown, status = 500): Response {
  const message = error instanceof Error ? error.message : String(error);
  return json({ error: message }, { status });
}

function positiveQuery(value: string | null, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} is invalid.`);
  return parsed;
}

function defaultEdgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

function versionedCacheRequest(request: Request, version: string): Request {
  const url = new URL(request.url);
  url.searchParams.set("__quran_memo_cache", version);
  return new Request(url, request);
}

async function cachedJson(
  cache: Cache,
  request: Request,
  context: WorkerContext,
  ttlSeconds: number,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await produce();
  if (!response.ok) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=${ttlSeconds}`);
  const cacheable = new Response(response.body, { status: response.status, headers });
  context.waitUntil(cache.put(request, cacheable.clone()));
  return cacheable;
}

function proxiedAudioUrl(source: string): string {
  return `/api/audio?source=${encodeURIComponent(source)}`;
}

function trustedAudioUrl(value: string | null): URL {
  if (!value) throw new Error("Audio source is missing.");
  const source = new URL(value);
  const hostname = source.hostname.toLowerCase();
  const trusted = source.protocol === "https:"
    && (hostname === "verses.quran.foundation"
      || hostname === "quranicaudio.com"
      || hostname.endsWith(".quranicaudio.com"));
  if (!trusted) throw new Error("Audio source is unavailable.");
  return source;
}

async function audioResponse(
  request: Request,
  context: WorkerContext,
  cache: Cache,
  fetchFn: FetchLike,
): Promise<Response> {
  const source = trustedAudioUrl(new URL(request.url).searchParams.get("source"));
  const range = request.headers.get("range");
  if (!range) {
    const cached = await cache.match(request);
    if (cached) return cached;
  }

  const upstream = await fetchFn(source, {
    headers: {
      accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.1",
      ...(range ? { range } : {}),
    },
    signal: request.signal,
  });
  if (!upstream.ok || !upstream.body) {
    throw new Error(`Audio server returned HTTP ${upstream.status}.`);
  }

  const headers = new Headers(upstream.headers);
  headers.set("cache-control", `public, max-age=${AUDIO_TTL_SECONDS}, immutable`);
  headers.set("content-type", upstream.headers.get("content-type") || "audio/mpeg");
  headers.delete("set-cookie");
  const response = new Response(upstream.body, { status: upstream.status, headers });
  if (!range && upstream.status === 200) {
    context.waitUntil(cache.put(new Request(request.url), response.clone()));
  }
  return response;
}

async function handleApi(
  request: Request,
  context: WorkerContext,
  cache: Cache,
  fetchFn: FetchLike,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const api = new QuranClient(fetchFn);

  if (url.pathname === "/api/catalog") {
    return cachedJson(cache, versionedCacheRequest(request, CATALOG_CACHE_VERSION), context, CATALOG_TTL_SECONDS, async () => {
      const [chapters, reciters, tafsirs] = await Promise.all([
        api.chapters(), api.reciters(), api.tafsirs().catch(() => []),
      ]);
      return json({ chapters, reciters, tafsirs, defaultReciterId: DEFAULT_RECITER_ID });
    });
  }

  if (url.pathname === "/api/reading") {
    return cachedJson(cache, versionedCacheRequest(request, READING_CACHE_VERSION), context, CATALOG_TTL_SECONDS, async () => {
      const chapterId = positiveQuery(url.searchParams.get("chapter"), "Surah");
      if (chapterId > 114) throw new Error("Surah is invalid.");
      const reciterId = positiveQuery(url.searchParams.get("reciter"), "Reciter");
      const chapter = (await api.chapters()).find((item) => item.id === chapterId);
      if (!chapter) throw new Error("Surah is unavailable.");
      const verses = (await api.readingVersesForChapter(chapter, reciterId)).map(
        (verse) => ({
          ...verse,
          audioUrl: proxiedAudioUrl(verse.audioUrl),
        }),
      );
      return json({ chapter, verses });
    });
  }

  if (url.pathname === "/api/session") {
    return cachedJson(cache, versionedCacheRequest(request, SESSION_CACHE_VERSION), context, SESSION_TTL_SECONDS, async () => {
      const ids = parseSurahSpec(url.searchParams.get("surahs") ?? "");
      const reciterId = positiveQuery(url.searchParams.get("reciter"), "Reciter");
      const chapters = (await api.chapters()).filter((chapter) => ids.includes(chapter.id));
      if (chapters.length !== ids.length) throw new Error("One or more surahs are unavailable.");
      const groups = await Promise.all(chapters.map(async (chapter) => ({
        chapter,
        verses: (await api.versesForChapter(chapter, reciterId)).map((verse) => ({
          ...verse,
          audioUrl: proxiedAudioUrl(verse.audioUrl),
        })),
      })));
      const quizPool = groups.flatMap((group) => group.verses.map((verse) => ({
        verseKey: verse.verseKey,
        arabic: verse.arabic,
      })));
      const seen = new Set(quizPool.map((verse) => verse.verseKey));
      for (let attempts = 0; quizPool.length < 4 && attempts < 10; attempts += 1) {
        const random = await api.randomVerseText();
        if (!seen.has(random.verseKey)) {
          seen.add(random.verseKey);
          quizPool.push(random);
        }
      }
      if (quizPool.length < 4) throw new Error("Could not prepare enough unique quiz choices.");
      return json({ groups, quizPool });
    });
  }

  if (url.pathname === "/api/audio") return audioResponse(request, context, cache, fetchFn);
  if (url.pathname === "/api/tafsir") {
    return cachedJson(cache, versionedCacheRequest(request, TAFSIR_CACHE_VERSION), context, CATALOG_TTL_SECONDS, async () => {
      const tafsirId = positiveQuery(url.searchParams.get("tafsir"), "Tafsir");
      const verseKey = url.searchParams.get("verse") ?? "";
      return json({ text: await api.tafsirForVerse(tafsirId, verseKey) });
    });
  }
  return new Response("Not found", { status: 404 });
}

export function createWorker(
  fetchFn: FetchLike = (input, init) => fetch(input, init),
  cacheFactory: () => Cache = defaultEdgeCache,
) {
  return {
    async fetch(request: Request, environment: WorkerEnvironment, context: WorkerContext): Promise<Response> {
      try {
        const url = new URL(request.url);
        return url.pathname.startsWith("/api/")
          ? await handleApi(request, context, cacheFactory(), fetchFn)
          : await environment.ASSETS.fetch(request);
      } catch (error) {
        return errorResponse(error, 400);
      }
    },
  };
}

export default createWorker();
