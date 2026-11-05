
import { redis } from "./redis.js";

// Cache-aside: Redis first, then the loader (your DB query), then store the result.
export async function cached(key, ttlSeconds, loader,{ skipNull = false } = {}) {
  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) return JSON.parse(hit);
    } catch { /* Redis is down: fall through to the database */ }
  }

  const value = await loader();
  
  if (skipNull && value === null) return value;

  if (redis && value !== undefined) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch { /* never fail a request because the cache failed */ }
  }
  return value;
}

export async function invalidate(...keys) {
  if (!redis || !keys.length) return;
  try { await redis.del(...keys); } catch { /* ignore */ }
}

// Delete every key matching a pattern, e.g. "access:<projectId>:*"
export async function invalidatePattern(pattern) {
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch { /* ignore */ }
}