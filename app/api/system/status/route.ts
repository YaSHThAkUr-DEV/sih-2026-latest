import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkRedisHealth } from '@/lib/cache/redis';
import { VaultService } from '@/lib/crypto/vault';
import { ensureBucketExists, BUCKET_NAME } from '@/lib/storage/minio';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();

  // 1. Check PostgreSQL
  const dbStart = Date.now();
  let dbStatus = { ok: false, latencyMs: 0, error: undefined as string | undefined };
  try {
    const res = await query('SELECT count(*) as count FROM documents');
    dbStatus = {
      ok: true,
      latencyMs: Date.now() - dbStart,
      error: undefined,
    };
  } catch (err: any) {
    dbStatus = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: err.message,
    };
  }

  // 2. Check MinIO Object Storage
  const minioStart = Date.now();
  let minioStatus = { ok: false, bucket: BUCKET_NAME, latencyMs: 0, error: undefined as string | undefined };
  try {
    const ok = await ensureBucketExists();
    minioStatus = {
      ok,
      bucket: BUCKET_NAME,
      latencyMs: Date.now() - minioStart,
      error: ok ? undefined : 'Bucket verification failed',
    };
  } catch (err: any) {
    minioStatus = {
      ok: false,
      bucket: BUCKET_NAME,
      latencyMs: Date.now() - minioStart,
      error: err.message,
    };
  }

  // 3. Check Redis
  const redisStatus = await checkRedisHealth();

  // 4. Check HashiCorp Vault
  const vaultStatus = await VaultService.checkHealth();

  const allOperational = dbStatus.ok && minioStatus.ok && redisStatus.ok && vaultStatus.ok;

  return NextResponse.json({
    status: allOperational ? 'HEALTHY' : 'DEGRADED',
    timestamp,
    services: {
      database: {
        name: 'PostgreSQL 18 (Relational & Audit Ledger)',
        ...dbStatus,
      },
      storage: {
        name: 'MinIO S3 (Encrypted Document Blobs)',
        ...minioStatus,
      },
      cacheQueue: {
        name: 'Redis 7 (Metadata Cache & Task Queue)',
        ...redisStatus,
      },
      kms: {
        name: 'HashiCorp Vault (Transit Secrets Engine)',
        ...vaultStatus,
      },
    },
  });
}
