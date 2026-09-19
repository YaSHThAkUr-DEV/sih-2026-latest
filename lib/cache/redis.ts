import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export class RedisClientManager {
  private static instance: Redis | null = null;

  /** Build a fresh ioredis client. */
  private static createClient(): Redis {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      // Retry up to 10 times with exponential back-off (max 5 s between attempts).
      // This tolerates the Next.js dev server starting before Docker is ready.
      retryStrategy(times) {
        if (times > 10) return null; // give up after 10 attempts
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
    });

    client.on('connect', () => {
      console.log('[REDIS] Connected successfully to Redis server at', redisUrl);
    });

    client.on('error', (err) => {
      console.warn('[REDIS_WARN] Redis connection error:', err.message);
    });

    return client;
  }

  /**
   * Return the shared client, re-creating it if it entered the 'end' state
   * (which happens when retryStrategy returns null after exhausing retries).
   */
  public static getClient(): Redis {
    if (
      !RedisClientManager.instance ||
      RedisClientManager.instance.status === 'end'
    ) {
      // Silently discard the dead client – ioredis won't emit more events from it.
      RedisClientManager.instance = RedisClientManager.createClient();
    }
    return RedisClientManager.instance;
  }

  /**
   * Ensure the client is connected (handles 'wait' and 'end' states).
   * Returns the ready client.
   */
  public static async connect(): Promise<Redis> {
    const client = RedisClientManager.getClient();
    if (client.status === 'wait') {
      await client.connect();
    }
    return client;
  }

  public static async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const client = await RedisClientManager.connect();
      const response = await client.ping();
      return { ok: response === 'PONG', latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
}

export const redis = {
  /** Always returns a usable client (re-creates on 'end'). */
  get client() {
    return RedisClientManager.getClient();
  },
  get status() {
    return RedisClientManager.getClient().status;
  },
};

export const checkRedisHealth = RedisClientManager.ping.bind(RedisClientManager);


/**
 * Cached getter with automatic fallback to fetcher function
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  try {
    const client = await RedisClientManager.connect();
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
    const client = await RedisClientManager.connect();
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
