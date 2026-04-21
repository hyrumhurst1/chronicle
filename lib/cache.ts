import type { TimelineResult } from "./types";

type CacheEntry = {
  key: string;
  value: TimelineResult;
  storedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __chronicle_cache: Map<string, CacheEntry> | undefined;
}

const TTL_MS = 1000 * 60 * 60 * 24; // 24h

function store(): Map<string, CacheEntry> {
  if (!globalThis.__chronicle_cache) {
    globalThis.__chronicle_cache = new Map();
  }
  return globalThis.__chronicle_cache;
}

export function cacheKey(
  owner: string,
  repo: string,
  headSha: string
): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}:${headSha}`;
}

export function cacheGet(key: string): TimelineResult | null {
  const entry = store().get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > TTL_MS) {
    store().delete(key);
    return null;
  }
  return entry.value;
}

export function cachePut(key: string, value: TimelineResult): void {
  store().set(key, { key, value, storedAt: Date.now() });
}

export function cacheFindByRepo(
  owner: string,
  repo: string
): TimelineResult | null {
  const prefix = `${owner.toLowerCase()}/${repo.toLowerCase()}:`;
  let latest: CacheEntry | null = null;
  for (const entry of store().values()) {
    if (entry.key.startsWith(prefix)) {
      if (!latest || entry.storedAt > latest.storedAt) latest = entry;
    }
  }
  if (!latest) return null;
  if (Date.now() - latest.storedAt > TTL_MS) return null;
  return latest.value;
}
