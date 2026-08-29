import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { REQUEST_CACHE_TTL_MS, type JsonCache } from "./json-cache.ts";

export { REQUEST_CACHE_TTL_MS } from "./json-cache.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface CacheEnvelope<T> {
  cachedAt: number;
  data: T;
}

export function defaultCacheDirectory(): string {
  const base = process.env.XDG_CACHE_HOME
    || (process.env.HOME ? join(process.env.HOME, ".cache") : join(process.cwd(), ".cache"));
  return join(base, "quran-memo");
}

function cacheKey(value: string): string {
  return Bun.hash(value).toString(16);
}

export class DiskCache implements JsonCache {
  private readonly pendingAudio = new Map<string, Promise<string>>();

  constructor(readonly root = defaultCacheDirectory()) {}

  private async atomicWrite(path: string, content: string | ArrayBuffer): Promise<void> {
    await mkdir(join(this.root, "requests"), { recursive: true });
    await mkdir(join(this.root, "audio"), { recursive: true });
    const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await Bun.write(temporary, content);
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
  }

  async getJson<T>(key: string, maxAgeMs = REQUEST_CACHE_TTL_MS): Promise<T | null> {
    const path = join(this.root, "requests", `${cacheKey(key)}.json`);
    try {
      const envelope = JSON.parse(await readFile(path, "utf8")) as CacheEnvelope<T>;
      if (
        typeof envelope.cachedAt !== "number"
        || Date.now() - envelope.cachedAt > maxAgeMs
        || !("data" in envelope)
      ) return null;
      return envelope.data;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, data: T): Promise<void> {
    const path = join(this.root, "requests", `${cacheKey(key)}.json`);
    await this.atomicWrite(path, JSON.stringify({ cachedAt: Date.now(), data } satisfies CacheEnvelope<T>));
  }

  audioPath(url: string): string {
    const extension = extname(new URL(url).pathname).toLowerCase();
    const safeExtension = /^\.[a-z0-9]{2,5}$/.test(extension) ? extension : ".audio";
    return join(this.root, "audio", `${cacheKey(url)}${safeExtension}`);
  }

  async getCachedAudio(url: string): Promise<string | null> {
    const path = this.audioPath(url);
    try {
      return (await stat(path)).size > 0 ? path : null;
    } catch {
      return null;
    }
  }

  async cacheAudio(url: string, fetchFn: FetchLike = fetch, signal?: AbortSignal): Promise<string> {
    const cached = await this.getCachedAudio(url);
    if (cached) return cached;

    const existing = this.pendingAudio.get(url);
    if (existing) return existing;

    const download = (async () => {
      let response: Response;
      try {
        response = await fetchFn(url, { signal });
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        throw new Error(`Could not download audio: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!response.ok) throw new Error(`Audio server returned HTTP ${response.status} for ${url}.`);
      const content = await response.arrayBuffer();
      if (content.byteLength === 0) throw new Error(`Audio server returned an empty file for ${url}.`);
      const path = this.audioPath(url);
      await this.atomicWrite(path, content);
      return path;
    })();

    this.pendingAudio.set(url, download);
    try {
      return await download;
    } finally {
      this.pendingAudio.delete(url);
    }
  }
}
