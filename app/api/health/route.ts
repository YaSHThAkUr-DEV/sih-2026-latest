import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { RedisClientManager } from '@/lib/cache/redis';
import { ensureBucketExists, BUCKET_NAME } from '@/lib/storage/minio';
import { BlockchainService } from '@/lib/blockchain/service';

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';

  // 1. PostgreSQL Database Probe
  try {
    const dbStart = Date.now();
    const dbRes = await query<{ version: string }>('SELECT version()');
    const dbLatency = Date.now() - dbStart;

    checks.database = {
      ok: true,
      latencyMs: dbLatency,
      version: dbRes[0]?.version?.split(' on ')[0] || 'PostgreSQL 18',
      pool: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      },
    };
  } catch (err: any) {
    overallStatus = 'UNHEALTHY';
    checks.database = {
      ok: false,
      error: err.message,
    };
  }

  // 2. MinIO S3 Object Storage Probe
  try {
    const minioStart = Date.now();
    const bucketOk = await ensureBucketExists();
    const minioLatency = Date.now() - minioStart;

    checks.storage = {
      ok: bucketOk,
      bucket: BUCKET_NAME,
      latencyMs: minioLatency,
      driver: 'MinIO S3 AWS-SDK v3',
    };

    if (!bucketOk) {
      if (overallStatus !== 'UNHEALTHY') overallStatus = 'DEGRADED';
    }
  } catch (err: any) {
    if (overallStatus !== 'UNHEALTHY') overallStatus = 'DEGRADED';
    checks.storage = {
      ok: false,
      error: err.message,
    };
  }

  // 3. Redis Cache & Job Queues Probe
  try {
    const redisPing = await RedisClientManager.ping();
    checks.redis = {
      ok: redisPing.ok,
      latencyMs: redisPing.latencyMs,
      error: redisPing.error,
    };

    if (!redisPing.ok && overallStatus !== 'UNHEALTHY') {
      overallStatus = 'DEGRADED';
    }
  } catch (err: any) {
    if (overallStatus !== 'UNHEALTHY') overallStatus = 'DEGRADED';
    checks.redis = {
      ok: false,
      error: err.message,
    };
  }

  // 4. Blockchain Integrity Anchor Probe
  try {
    const blockchainStatus = await BlockchainService.getNetworkStatus();
    checks.blockchain = {
      ok: blockchainStatus.healthy,
      mode: blockchainStatus.mode,
      network: blockchainStatus.networkName,
      channel: blockchainStatus.channelName,
      anchoredRecords: blockchainStatus.totalAnchored,
    };
  } catch (err: any) {
    checks.blockchain = {
      ok: false,
      mode: 'simulated',
      error: err.message,
    };
  }

  // 5. System Runtime Telemetry
  const memory = process.memoryUsage();
  const telemetry = {
    nodeId: 'DMS-SEC-NODE-01',
    environment: process.env.NODE_ENV || 'production',
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memory: {
      rssMb: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
    },
    totalDiagnosticTimeMs: Date.now() - startTime,
  };

  const statusCode = overallStatus === 'HEALTHY' ? 200 : overallStatus === 'DEGRADED' ? 200 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: checks,
      telemetry,
    },
    { status: statusCode }
  );
}
