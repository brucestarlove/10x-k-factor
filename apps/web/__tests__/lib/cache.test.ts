import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCached,
  setCache,
  getCache,
  invalidateCache,
  cacheExists,
  CacheTTL,
} from '@/lib/cache';

describe('Cache Module', () => {
  describe('CacheTTL Constants', () => {
    it('should export TTL constants', () => {
      expect(CacheTTL.LEADERBOARD).toBe(300);
      expect(CacheTTL.USER_XP).toBe(60);
      expect(CacheTTL.BUDDY_STATUS).toBe(120);
      expect(CacheTTL.CHALLENGE_LIST).toBe(180);
      expect(CacheTTL.TUTOR_STATS).toBe(300);
    });
  });

  describe('getCached', () => {
    it('should call fetchFn when cache misses', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
      const key = `test:${Date.now()}`;

      const result = await getCached(key, fetchFn, 10);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'test' });
    });

    it('should handle fetch function errors', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      const key = `test:error:${Date.now()}`;

      await expect(getCached(key, fetchFn, 10)).rejects.toThrow('Fetch failed');
    });

    it('should return data from fetch function', async () => {
      const testData = { id: 1, name: 'Test User' };
      const fetchFn = vi.fn().mockResolvedValue(testData);
      const key = `test:user:${Date.now()}`;

      const result = await getCached(key, fetchFn, 10);

      expect(result).toEqual(testData);
    });
  });

  describe('setCache', () => {
    it('should not throw when caching data', async () => {
      const key = `test:set:${Date.now()}`;
      const data = { value: 'test' };

      await expect(setCache(key, data, 10)).resolves.toBeUndefined();
    });

    it('should handle complex objects', async () => {
      const key = `test:complex:${Date.now()}`;
      const data = {
        nested: {
          array: [1, 2, 3],
          string: 'test',
          boolean: true,
        },
      };

      await expect(setCache(key, data, 10)).resolves.toBeUndefined();
    });
  });

  describe('getCache', () => {
    it('should return null for non-existent key', async () => {
      const key = `test:nonexistent:${Date.now()}`;

      const result = await getCache(key);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const key = 'test:error';

      const result = await getCache(key);

      // Should return null on error instead of throwing
      expect(result).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('should not throw when invalidating non-existent key', async () => {
      const key = `test:invalid:${Date.now()}`;

      const result = await invalidateCache(key);

      expect(typeof result).toBe('boolean');
    });

    it('should return boolean', async () => {
      const key = `test:bool:${Date.now()}`;

      const result = await invalidateCache(key);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('cacheExists', () => {
    it('should return false for non-existent key', async () => {
      const key = `test:exists:${Date.now()}`;

      const exists = await cacheExists(key);

      expect(exists).toBe(false);
    });

    it('should return boolean', async () => {
      const key = `test:bool:${Date.now()}`;

      const result = await cacheExists(key);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('Integration with Redis', () => {
    it('should work without Redis configured', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'no-redis' });
      const key = `test:no-redis:${Date.now()}`;

      // Should fall through to fetchFn when Redis not available
      const result = await getCached(key, fetchFn, 10);

      expect(result).toEqual({ data: 'no-redis' });
    });
  });
});
