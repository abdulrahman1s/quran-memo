import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiskCache } from "../src/cache.ts";
import { QuranClient } from "../src/api.ts";

const temporaryDirectories: string[] = [];

async function temporaryCache(): Promise<DiskCache> {
  const directory = await mkdtemp(join(tmpdir(), "quran-memo-test-"));
  temporaryDirectories.push(directory);
  return new DiskCache(directory);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("DiskCache", () => {
  test("stores JSON responses and respects expiration", async () => {
    const cache = await temporaryCache();
    await cache.setJson("catalog", { chapters: 114 });
    expect(await cache.getJson<{ chapters: number }>("catalog", 60_000)).toEqual({ chapters: 114 });
    expect(await cache.getJson("catalog", -1)).toBeNull();
  });

  test("downloads an audio URL once and reuses the file", async () => {
    const cache = await temporaryCache();
    let requests = 0;
    const fetchMock = async () => {
      requests += 1;
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };
    const url = "https://audio.example/001001.mp3";
    const [first, second] = await Promise.all([
      cache.cacheAudio(url, fetchMock),
      cache.cacheAudio(url, fetchMock),
    ]);
    expect(first).toBe(second);
    expect(requests).toBe(1);
    expect(await Bun.file(first).arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(await cache.cacheAudio(url, fetchMock)).toBe(first);
    expect(requests).toBe(1);
  });
});

test("QuranClient reuses cached API JSON", async () => {
  const cache = await temporaryCache();
  let requests = 0;
  const chapters = Array.from({ length: 114 }, (_, index) => ({
    id: index + 1,
    name_simple: `Chapter ${index + 1}`,
    name_arabic: `سورة ${index + 1}`,
    verses_count: 1,
  }));
  const fetchMock = async () => {
    requests += 1;
    return Response.json({ chapters });
  };
  const firstClient = new QuranClient(fetchMock, 1_000, cache);
  const secondClient = new QuranClient(fetchMock, 1_000, cache);
  expect((await firstClient.chapters()).length).toBe(114);
  expect((await secondClient.chapters()).length).toBe(114);
  expect(requests).toBe(1);
});
