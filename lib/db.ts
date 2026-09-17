import { Pool } from 'pg';

declare global {
  // Prevent multiple pool instances in development due to Next.js HMR
  var _dmsPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dms_db';

export const pool =
  global._dmsPool ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  global._dmsPool = pool;
}

function sanitizeParam(val: any): any {
  if (typeof val === 'string') {
    return val
      .replace(/\0/g, '')
      .replace(/[\uFFFD\uFEFF]/g, ' ')
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ' ')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeParam);
  }
  return val;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const sanitizedParams = params ? params.map(sanitizeParam) : params;
  const start = Date.now();
  const res = await pool.query(text, sanitizedParams);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 500) {
    console.warn(`[SLOW_QUERY] (${duration}ms): ${text}`);
  }
  return res.rows;
}

export default pool;
