import * as FileSystem from 'expo-file-system/legacy';

const CACHE_FILE = `${FileSystem.cacheDirectory}clipart_cache.json`;
const MAX_ENTRIES = 30;

interface CacheEntry {
  url: string;
  ts: number; // timestamp for eviction
}

type CacheMap = Record<string, CacheEntry>;

// Simple djb2-style hash — fast, no deps
function hashKey(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(36);
}

export function makeCacheKey(
  base64: string,
  styleId: string,
  strengthRatio: number,
  promptSuffix: string
): string {
  // Use first 300 chars of base64 as image fingerprint — fast + unique enough
  const fingerprint = `${base64.slice(0, 300)}|${styleId}|${strengthRatio}|${promptSuffix.trim()}`;
  return hashKey(fingerprint);
}

async function readCache(): Promise<CacheMap> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(CACHE_FILE);
    return JSON.parse(raw) as CacheMap;
  } catch {
    return {};
  }
}

async function writeCache(map: CacheMap): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(map));
  } catch {
    // Non-fatal — app works fine without caching
  }
}

export async function getCached(key: string): Promise<string | null> {
  const map = await readCache();
  return map[key]?.url ?? null;
}

export async function setCached(key: string, url: string): Promise<void> {
  const map = await readCache();
  map[key] = { url, ts: Date.now() };

  // Evict oldest entries if over limit
  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => map[a].ts - map[b].ts);
    sorted.slice(0, keys.length - MAX_ENTRIES).forEach(k => delete map[k]);
  }

  await writeCache(map);
}
