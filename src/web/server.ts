import { DEFAULT_RECITER_ID, QuranClient } from "../api.ts";
import { DiskCache } from "../cache.ts";
import { parseSurahSpec } from "../args.ts";
import { pwaIcon, pwaManifest, serviceWorkerSource } from "./pwa-assets.ts";
import { parseByteRange } from "./range.ts";

interface WebServerOptions {
  port: number;
  cache: DiskCache;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function errorResponse(error: unknown, status = 500): Response {
  const message = error instanceof Error ? error.message : String(error);
  return json({ error: message }, { status });
}

function positiveQuery(
  value: string | null,
  label: string,
  maximum?: number,
): number {
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    (maximum !== undefined && parsed > maximum)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return parsed;
}

async function audioFileResponse(
  request: Request,
  path: string,
): Promise<Response> {
  const file = Bun.file(path);
  const size = file.size;
  const baseHeaders = {
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": file.type || "audio/mpeg",
  };
  const range = request.headers.get("range");
  if (!range)
    return new Response(file, {
      headers: { ...baseHeaders, "content-length": String(size) },
    });

  const parsed = parseByteRange(range, size);
  if (!parsed) {
    return new Response(null, {
      status: 416,
      headers: { "content-range": `bytes */${size}` },
    });
  }
  return new Response(file.slice(parsed.start, parsed.end + 1), {
    status: 206,
    headers: {
      ...baseHeaders,
      "content-length": String(parsed.end - parsed.start + 1),
      "content-range": `bytes ${parsed.start}-${parsed.end}/${size}`,
    },
  });
}

export function startWebServer({ port, cache }: WebServerOptions) {
  const api = new QuranClient(fetch, 15_000, cache);

  const server = Bun.serve({
    port,
    routes: {
      "/": new Response(Bun.file("dist/web/index.html"), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
        },
      }),
      "/app.js": new Response(Bun.file("dist/web/app.js"), {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-cache",
        },
      }),
      "/styles.css": new Response(Bun.file("dist/web/styles.css"), {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "no-cache",
        },
      }),
      "/manifest.webmanifest": new Response(pwaManifest, {
        headers: {
          "content-type": "application/manifest+json",
          "cache-control": "no-cache",
        },
      }),
      "/icon.svg": new Response(pwaIcon, {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=86400",
        },
      }),
      "/besmllah.svg": new Response(Bun.file("besmllah.svg"), {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=86400",
        },
      }),
      "/sw.js": new Response(serviceWorkerSource, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-cache",
        },
      }),
      "/api/catalog": {
        GET: async () => {
          try {
            const [chapters, reciters, tafsirs] = await Promise.all([
              api.chapters(),
              api.reciters(),
              api.tafsirs().catch(() => []),
            ]);
            return json(
              {
                chapters,
                reciters,
                tafsirs,
                defaultReciterId: DEFAULT_RECITER_ID,
              },
              {
                headers: { "cache-control": "private, max-age=300" },
              },
            );
          } catch (error) {
            return errorResponse(error);
          }
        },
      },
      "/api/reading": {
        GET: async (request) => {
          try {
            const chapterId = positiveQuery(
              new URL(request.url).searchParams.get("chapter"),
              "Surah",
              114,
            );
            const reciterId = positiveQuery(
              new URL(request.url).searchParams.get("reciter"),
              "Reciter",
            );
            const chapter = (await api.chapters()).find(
              (item) => item.id === chapterId,
            );
            if (!chapter) throw new Error("Surah is unavailable.");
            const verses = (
              await api.readingVersesForChapter(chapter, reciterId)
            ).map((verse) => ({
              ...verse,
              audioUrl: `/api/audio?reciter=${reciterId}&chapter=${chapter.id}&verse=${verse.verseKey.split(":")[1]}`,
            }));
            return json(
              { chapter, verses },
              {
                headers: { "cache-control": "public, max-age=86400" },
              },
            );
          } catch (error) {
            return errorResponse(error, 400);
          }
        },
      },
      "/api/session": {
        GET: async (request) => {
          try {
            const url = new URL(request.url);
            const ids = parseSurahSpec(url.searchParams.get("surahs") ?? "");
            const reciterId = positiveQuery(
              url.searchParams.get("reciter"),
              "Reciter",
            );
            const chapters = (await api.chapters()).filter((chapter) =>
              ids.includes(chapter.id),
            );
            if (chapters.length !== ids.length)
              throw new Error("One or more surahs are unavailable.");
            const groups = await Promise.all(
              chapters.map(async (chapter) => ({
                chapter,
                verses: (await api.versesForChapter(chapter, reciterId)).map(
                  (verse) => ({
                    ...verse,
                    audioUrl: `/api/audio?reciter=${reciterId}&chapter=${chapter.id}&verse=${verse.verseKey.split(":")[1]}`,
                  }),
                ),
              })),
            );
            const quizPool = groups.flatMap((group) =>
              group.verses.map((verse) => ({
                verseKey: verse.verseKey,
                arabic: verse.arabic,
              })),
            );
            const seen = new Set(quizPool.map((verse) => verse.verseKey));
            for (
              let attempts = 0;
              quizPool.length < 4 && attempts < 10;
              attempts += 1
            ) {
              const random = await api.randomVerseText();
              if (!seen.has(random.verseKey)) {
                seen.add(random.verseKey);
                quizPool.push(random);
              }
            }
            if (quizPool.length < 4)
              throw new Error("Could not prepare enough unique quiz choices.");
            return json(
              { groups, quizPool },
              { headers: { "cache-control": "private, max-age=300" } },
            );
          } catch (error) {
            return errorResponse(error, 400);
          }
        },
      },
      "/api/audio": {
        GET: async (request) => {
          try {
            const url = new URL(request.url);
            const reciterId = positiveQuery(
              url.searchParams.get("reciter"),
              "Reciter",
            );
            const chapterId = positiveQuery(
              url.searchParams.get("chapter"),
              "Surah",
              114,
            );
            const verseNumber = positiveQuery(
              url.searchParams.get("verse"),
              "Ayah",
            );
            const chapter = (await api.chapters()).find(
              (item) => item.id === chapterId,
            );
            if (!chapter || verseNumber > chapter.versesCount)
              throw new Error("Ayah is unavailable.");
            const verse = (await api.versesForChapter(chapter, reciterId)).find(
              (item) => item.verseKey === `${chapterId}:${verseNumber}`,
            );
            if (!verse) throw new Error("Audio is unavailable.");
            const path = await cache.cacheAudio(
              verse.audioUrl,
              fetch,
              request.signal,
            );
            return audioFileResponse(request, path);
          } catch (error) {
            return errorResponse(error, 404);
          }
        },
      },
      "/api/tafsir": {
        GET: async (request) => {
          try {
            const url = new URL(request.url);
            const tafsirId = positiveQuery(
              url.searchParams.get("tafsir"),
              "Tafsir",
            );
            const verseKey = url.searchParams.get("verse") ?? "";
            return json(
              { text: await api.tafsirForVerse(tafsirId, verseKey) },
              {
                headers: { "cache-control": "private, max-age=86400" },
              },
            );
          } catch (error) {
            return errorResponse(error, 400);
          }
        },
      },
      "/api/word-meaning": {
        GET: async (request) => {
          try {
            const url = new URL(request.url);
            const verseKey = url.searchParams.get("verse") ?? "";
            const word = url.searchParams.get("word") ?? "";
            return json(await api.arabicWordMeaning(verseKey, word), {
              headers: { "cache-control": "private, max-age=86400" },
            });
          } catch (error) {
            return errorResponse(error, 400);
          }
        },
      },
      "/api/*": new Response("Not found", { status: 404 }),
    },
  });

  console.log(`Quran Memo web app: ${server.url}`);
  return server;
}
