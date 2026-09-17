import { RedisClientManager } from '@/lib/cache/redis';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
  totalLimit: number;
}

// In-memory fallback map if Redis is not available
interface MemoryRecord {
  timestamps: number[];
}
const memoryStore = new Map<string, MemoryRecord>();

/**
 * Institutional Rate Limiter supporting sliding-window request counting.
 * Uses Redis with fallback to high-resolution memory store.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const threshold = now - windowMs;

  try {
    const redis = RedisClientManager.getClient();
    if (redis && redis.status === 'ready') {
      const redisKey = `dms:ratelimit:${key}`;

      // Redis pipeline: remove old, add current, count elements in window, set expiry
      const multi = redis.multi();
      multi.zremrangebyscore(redisKey, 0, threshold);
      multi.zadd(redisKey, now, `${now}:${Math.random().toString(36).substring(2, 7)}`);
      multi.zcard(redisKey);
      multi.expire(redisKey, config.windowSeconds * 2);

      const results = await multi.exec();
      const currentCount = (results && results[2] && typeof results[2][1] === 'number')
        ? results[2][1]
        : 1;

      const allowed = currentCount <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - currentCount);

      return {
        allowed,
        remaining,
        resetSeconds: config.windowSeconds,
        totalLimit: config.maxRequests,
      };
    }
  } catch (err: any) {
    console.warn('[RATELIMIT_WARN] Redis unavailable for rate limiting, falling back to memory store:', err.message);
  }

  // Memory fallback implementation
  let record = memoryStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    memoryStore.set(key, record);
  }

  // Filter timestamps within window
  record.timestamps = record.timestamps.filter((ts) => ts > threshold);
  record.timestamps.push(now);

  const currentCount = record.timestamps.length;
  const allowed = currentCount <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - currentCount);

  // Periodically clean up stale keys in memory
  if (memoryStore.size > 2000) {
    const cutoff = now - windowMs * 2;
    for (const [k, rec] of memoryStore.entries()) {
      if (rec.timestamps.length === 0 || rec.timestamps[rec.timestamps.length - 1] < cutoff) {
        memoryStore.delete(k);
      }
    }
  }

  return {
    allowed,
    remaining,
    resetSeconds: config.windowSeconds,
    totalLimit: config.maxRequests,
  };
}

/**
 * Standard Institutional Rate Limit Configurations
 */
export const RATE_LIMIT_PRESETS = {
  // Authentication: 5 login attempts per 60 seconds per IP
  AUTH_LOGIN: { maxRequests: 5, windowSeconds: 60 },
  // Evidentiary Upload: 20 uploads per 60 seconds per user
  EVIDENCE_UPLOAD: { maxRequests: 20, windowSeconds: 60 },
  // Administration: 60 admin requests per 60 seconds per admin
  ADMIN_API: { maxRequests: 60, windowSeconds: 60 },
  // General Public/Search: 100 queries per 60 seconds
  GENERAL_API: { maxRequests: 100, windowSeconds: 60 },
};
