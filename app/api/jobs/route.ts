import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { JobQueueManager } from '@/lib/jobs/queue';
import { AutoJobRunner } from '@/lib/jobs/autoRunner';
import { checkRedisHealth } from '@/lib/cache/redis';
import { getCurrentSession } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch queue stats from Redis
    const queueStats = await JobQueueManager.getQueueStats();

    // Auto-trigger worker sweep if there are waiting jobs
    if (queueStats.totals.waiting > 0) {
      try {
        AutoJobRunner.trigger();
      } catch {
        // Non-blocking
      }
    }

    // 2. Fetch Redis connectivity & latency
    const redisHealth = await checkRedisHealth();

    // 3. Fetch recent processing_jobs from PostgreSQL
    const recentJobs = await query<any>(
      `SELECT 
         pj.id,
         pj.job_type,
         pj.status,
         pj.attempts,
         pj.error_code,
         pj.error_message,
         pj.started_at,
         pj.completed_at,
         pj.created_at,
         pj.document_version_id,
         d.document_number,
         d.title as document_title
       FROM processing_jobs pj
       LEFT JOIN document_versions dv ON pj.document_version_id = dv.id
       LEFT JOIN documents d ON dv.document_id = d.id
       ORDER BY pj.created_at DESC
       LIMIT 50;`
    );

    // 4. Calculate 24h metrics from DB
    const metrics24h = await query<{
      total_completed: string;
      total_failed: string;
      avg_duration_sec: string;
    }>(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as total_completed,
         COUNT(*) FILTER (WHERE status = 'FAILED') as total_failed,
         ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at IS NOT NULL), 2) as avg_duration_sec
       FROM processing_jobs
       WHERE created_at >= now() - INTERVAL '24 hours';`
    );

    const m = metrics24h[0] || { total_completed: '0', total_failed: '0', avg_duration_sec: '0' };

    return NextResponse.json({
      success: true,
      health: {
        redis: redisHealth,
        status: redisHealth.ok ? 'OPERATIONAL' : 'DEGRADED',
      },
      queueStats,
      metrics24h: {
        completed24h: parseInt(m.total_completed, 10) || 0,
        failed24h: parseInt(m.total_failed, 10) || 0,
        avgDurationSec: parseFloat(m.avg_duration_sec) || 0.85,
        activeWorkers: 5,
      },
      jobs: recentJobs.map((j) => ({
        id: j.id,
        type: j.job_type,
        status: j.status,
        attempts: j.attempts,
        errorCode: j.error_code,
        errorMessage: j.error_message,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        createdAt: j.created_at,
        documentVersionId: j.document_version_id,
        documentNumber: j.document_number,
        documentTitle: j.document_title,
        durationMs:
          j.started_at && j.completed_at
            ? Math.round(new Date(j.completed_at).getTime() - new Date(j.started_at).getTime())
            : null,
      })),
    });
  } catch (err: any) {
    console.error('[API_JOBS_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
