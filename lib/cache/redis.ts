import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export class RedisClientManager {
  private static instance: Redis | null = null;
  private static isConnected: boolean = false;

  public static getClient(): Redis {
    if (!RedisClientManager.instance) {
      RedisClientManager.instance = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 4000,
        retryStrategy(times) {
          if (times > 3) {
            return null; // Stop retrying after 3 attempts
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
      });

      RedisClientManager.instance.on('connect', () => {
        RedisClientManager.isConnected = true;
        console.log('[REDIS] Connected successfully to Redis server at', redisUrl);
      });

      RedisClientManager.instance.on('error', (err) => {
        RedisClientManager.isConnected = false;
        console.warn('[REDIS_WARN] Redis connection error:', err.message);
      });
    }

    return RedisClientManager.instance;
  }

  public static async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const client = RedisClientManager.getClient();
      if (client.status === 'wait') {
        await client.connect();
      }
      const response = await client.ping();
      const latency = Date.now() - start;
      return { ok: response === 'PONG', latencyMs: latency };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
}

export const redis = RedisClientManager.getClient();
export const checkRedisHealth = RedisClientManager.ping;

/**
 * Cached getter with automatic fallback to fetcher function
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  try {
    const client = RedisClientManager.getClient();
    if (client.status === 'wait') {
      await client.connect();
    }
    const cached = await client.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    // Gracefully degrade if Redis is offline
  }

  const freshData = await fetcher();

  try {
    const client = RedisClientManager.getClient();
    if (client.status === 'ready') {
      await client.setex(key, ttlSeconds, JSON.stringify(freshData));
    }
  } catch (err) {
    // Ignore cache set failures
  }

  return freshData;
}

/**
 * Invalidate cache key or pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const client = RedisClientManager.getClient();
    if (client.status === 'wait') {
      await client.connect();
    }
    if (pattern.includes('*')) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } else {
      await client.del(pattern);
    }
  } catch (err) {
    // Non-blocking
  }
}
