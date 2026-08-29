export const REQUEST_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

export interface JsonCache {
  getJson<T>(key: string, maxAgeMs?: number): Promise<T | null>;
  setJson<T>(key: string, data: T): Promise<void>;
}
