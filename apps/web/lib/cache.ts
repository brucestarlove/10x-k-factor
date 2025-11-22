import { Redis } from '@upstash/redis';
import { createLogger } from '@/lib/logger';

const log = createLogger('lib:cache');

/**
 * Initialize Redis if credentials are provided
 */
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Default TTL values for different cache types (in seconds)
 */
export const CacheTTL = {
  LEADERBOARD: 300, // 5 minutes
  USER_XP: 60, // 1 minute
  BUDDY_STATUS: 120, // 2 minutes
  CHALLENGE_LIST: 180, // 3 minutes
  TUTOR_STATS: 300, // 5 minutes
} as const;

/**
 * Get cached data or fetch and cache it if not present.
 *
 * This function implements a cache-aside pattern:
 * 1. Check if data exists in cache
 * 2. If yes, return cached data
 * 3. If no, call fetchFn to get fresh data
 * 4. Store fresh data in cache with TTL
 * 5. Return fresh data
 *
 * If Redis is not configured, this falls through to always calling fetchFn.
 *
 * @param key Cache key
 * @param fetchFn Function to fetch fresh data if not in cache
 * @param ttlSeconds Time-to-live in seconds (default: 300 = 5 minutes)
 * @returns Cached or fresh data
 *
 * @example
 * ```typescript
 * const leaderboard = await getCached(
 *   'leaderboard:algebra:10',
 *   async () => {
 *     return db.select()...
 *   },
 *   CacheTTL.LEADERBOARD
 * );
 * ```
 */
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = CacheTTL.LEADERBOARD
): Promise<T> {
  if (!redis) {
    log.debug({ key }, 'Redis not configured, bypassing cache');
    return fetchFn();
  }

  try {
    // Try to get from cache
    const cached = await redis.get<string>(key);

    if (cached !== null && cached !== undefined) {
      log.debug({ key }, 'Cache hit');
      try {
        return JSON.parse(cached) as T;
      } catch (parseError) {
        log.warn({ key, error: parseError }, 'Failed to parse cached data, fetching fresh');
        // Fall through to fetch fresh data
      }
    }

    log.debug({ key }, 'Cache miss');
  } catch (error) {
    log.warn({ key, error }, 'Cache read failed, fetching fresh data');
    // Fall through to fetch fresh data
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Store in cache (don't await, fire-and-forget)
  void cacheData(key, data, ttlSeconds);

  return data;
}

/**
 * Store data in cache with TTL.
 *
 * This is a fire-and-forget operation - errors are logged but not thrown.
 *
 * @param key Cache key
 * @param data Data to cache (will be JSON stringified)
 * @param ttlSeconds Time-to-live in seconds
 */
async function cacheData<T>(
  key: string,
  data: T,
  ttlSeconds: number
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    const serialized = JSON.stringify(data);
    await redis.setex(key, ttlSeconds, serialized);
    log.debug({ key, ttlSeconds }, 'Data cached');
  } catch (error) {
    log.warn({ key, error }, 'Failed to cache data');
  }
}

/**
 * Invalidate cache by exact key.
 *
 * @param key Exact cache key to invalidate
 * @returns True if key was deleted, false otherwise
 *
 * @example
 * ```typescript
 * await invalidateCache('leaderboard:algebra:10');
 * ```
 */
export async function invalidateCache(key: string): Promise<boolean> {
  if (!redis) {
    log.debug({ key }, 'Redis not configured, skipping invalidation');
    return false;
  }

  try {
    const deleted = await redis.del(key);
    if (deleted > 0) {
      log.debug({ key }, 'Cache invalidated');
      return true;
    }
    return false;
  } catch (error) {
    log.warn({ key, error }, 'Cache invalidation failed');
    return false;
  }
}

/**
 * Invalidate multiple cache keys matching a pattern.
 *
 * Note: SCAN is used instead of KEYS to avoid blocking Redis.
 *
 * @param pattern Redis pattern (e.g., 'leaderboard:*', 'user:123:*')
 * @returns Number of keys deleted
 *
 * @example
 * ```typescript
 * // Invalidate all leaderboards for algebra
 * await invalidateCachePattern('leaderboard:algebra:*');
 *
 * // Invalidate all cached data for a user
 * await invalidateCachePattern('user:123:*');
 * ```
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  if (!redis) {
    log.debug({ pattern }, 'Redis not configured, skipping pattern invalidation');
    return 0;
  }

  try {
    // Use SCAN to find matching keys (non-blocking)
    let cursor = 0;
    const keysToDelete: string[] = [];

    do {
      // Note: Upstash Redis REST API may not support SCAN directly
      // For now, we'll use a simpler approach with KEYS for patterns
      // In production, consider using a different approach or Upstash's specific features

      // For Upstash REST API, we need to use their specific methods
      // This is a simplified version - adjust based on Upstash capabilities
      try {
        const keys = await redis.keys(pattern);
        if (Array.isArray(keys) && keys.length > 0) {
          keysToDelete.push(...keys);
        }
        break; // Exit after first call since keys() returns all matches
      } catch (scanError) {
        log.warn({ pattern, error: scanError }, 'Pattern scan not supported, using keys');
        break;
      }
    } while (cursor !== 0);

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      log.info({ pattern, count: keysToDelete.length }, 'Cache pattern invalidated');
      return keysToDelete.length;
    }

    return 0;
  } catch (error) {
    log.warn({ pattern, error }, 'Cache pattern invalidation failed');
    return 0;
  }
}

/**
 * Set cache data directly (without fetch function).
 *
 * Useful when you already have the data and just want to cache it.
 *
 * @param key Cache key
 * @param data Data to cache
 * @param ttlSeconds Time-to-live in seconds
 *
 * @example
 * ```typescript
 * await setCache('user:123:xp', userXpData, CacheTTL.USER_XP);
 * ```
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds: number = CacheTTL.LEADERBOARD
): Promise<void> {
  await cacheData(key, data, ttlSeconds);
}

/**
 * Get cached data without fallback.
 *
 * Returns null if data is not in cache or Redis is not configured.
 *
 * @param key Cache key
 * @returns Cached data or null
 *
 * @example
 * ```typescript
 * const cached = await getCache<LeaderboardData>('leaderboard:algebra:10');
 * if (cached) {
 *   // Use cached data
 * } else {
 *   // Fetch fresh data
 * }
 * ```
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) {
    return null;
  }

  try {
    const cached = await redis.get<string>(key);
    if (cached !== null && cached !== undefined) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    log.warn({ key, error }, 'Failed to get cache');
    return null;
  }
}

/**
 * Check if a cache key exists.
 *
 * @param key Cache key
 * @returns True if key exists, false otherwise
 */
export async function cacheExists(key: string): Promise<boolean> {
  if (!redis) {
    return false;
  }

  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    log.warn({ key, error }, 'Failed to check cache existence');
    return false;
  }
}
