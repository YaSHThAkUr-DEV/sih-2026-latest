import { RedisClientManager } from '@/lib/cache/redis';
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { AutoJobRunner } from './autoRunner';

export type QueueName = 'ocr-queue' | 'notification-queue' | 'retention-queue' | 'cleanup-queue' | 'blockchain-queue';

export type JobType =
  | 'OCR_EXTRACTION'
  | 'NOTIFICATION_DISPATCH'
  | 'RETENTION_AUDIT'
  | 'CRYPTO_SHRED_CLEANUP'
  | 'BLOCKCHAIN_ANCHOR'
  | 'TEST_JOB';

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface JobData<T = any> {
  id: string;
  queue: QueueName;
  type: JobType;
  payload: T;
  documentVersionId?: string | null;
  attempts: number;
  maxRetries: number;
  status: JobStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface EnqueueOptions {
  documentVersionId?: string | null;
  maxRetries?: number;
}

export class JobQueueManager {
  private static prefix = 'dms:queue';

  /**
   * Enqueue a new job into Redis and record in PostgreSQL processing_jobs
   */
  public static async enqueue<T = any>(
    queueName: QueueName,
    jobType: JobType,
    payload: T,
    options: EnqueueOptions = {}
  ): Promise<JobData<T>> {
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const maxRetries = options.maxRetries ?? 3;

    // 1. Insert into PostgreSQL processing_jobs
    try {
      await query(
        `INSERT INTO processing_jobs (
           id, document_version_id, job_type, status, attempts, created_at
         )
         VALUES ($1, $2, $3, 'QUEUED', 0, now());`,
        [jobId, options.documentVersionId || null, jobType]
      );
    } catch (dbErr: any) {
      console.warn('[QUEUE_DB_WARNING] Could not persist job to processing_jobs table:', dbErr.message);
    }

    const jobData: JobData<T> = {
      id: jobId,
      queue: queueName,
      type: jobType,
      payload,
      documentVersionId: options.documentVersionId || null,
      attempts: 0,
      maxRetries,
      status: 'QUEUED',
      createdAt: now,
    };

    // 2. Persist job metadata in Redis
    try {
      const r = await RedisClientManager.connect();
      await r.set(`dms:job:${jobId}`, JSON.stringify(jobData));
      // Push to waiting list (FIFO: LPUSH then RPOP)
      await r.lpush(`${this.prefix}:${queueName}:waiting`, jobId);
    } catch (redisErr: any) {
      console.error('[QUEUE_REDIS_ERROR] Failed pushing job to Redis:', redisErr.message);
    }

    // 3. Trigger immediate non-blocking auto-runner sweep
    try {
      AutoJobRunner.trigger();
    } catch {
      // Non-blocking
    }

    return jobData;
  }

  /**
   * Fetch the next available waiting job for a queue (FIFO)
   */
  public static async getNextJob<T = any>(queueName: QueueName): Promise<JobData<T> | null> {
    try {
      const r = await RedisClientManager.connect();

      // RPOP from waiting queue
      const jobId = await r.rpop(`${this.prefix}:${queueName}:waiting`);
      if (!jobId) {
        return null;
      }

      // Add to active set
      await r.sadd(`${this.prefix}:${queueName}:active`, jobId);

      // Fetch job metadata
      const raw = await r.get(`dms:job:${jobId}`);
      let job: JobData<T>;

      if (raw) {
        job = JSON.parse(raw);
      } else {
        // Fallback from DB
        const rows = await query<any>('SELECT * FROM processing_jobs WHERE id = $1', [jobId]);
        if (!rows.length) return null;
        const row = rows[0];
        job = {
          id: row.id,
          queue: queueName,
          type: row.job_type as JobType,
          payload: {} as T,
          documentVersionId: row.document_version_id,
          attempts: row.attempts || 0,
          maxRetries: 3,
          status: 'RUNNING',
          createdAt: row.created_at,
        };
      }

      job.attempts = (job.attempts || 0) + 1;
      job.status = 'RUNNING';
      job.startedAt = new Date().toISOString();

      // Update Redis metadata
      await r.set(`dms:job:${jobId}`, JSON.stringify(job));

      // Update PostgreSQL processing_jobs
      await query(
        `UPDATE processing_jobs
         SET status = 'RUNNING', attempts = $1, started_at = now()
         WHERE id = $2;`,
        [job.attempts, jobId]
      );

      return job;
    } catch (err: any) {
      console.error(`[QUEUE_GET_JOB_ERROR] Queue ${queueName}:`, err.message);
      return null;
    }
  }

  /**
   * Mark a job as completed
   */
  public static async completeJob(queueName: QueueName, jobId: string, resultMeta?: any): Promise<void> {
    try {
      const r = await RedisClientManager.connect();

      // Remove from active, add to completed list (trim to last 100)
      await r.srem(`${this.prefix}:${queueName}:active`, jobId);
      await r.lpush(`${this.prefix}:${queueName}:completed`, jobId);
      await r.ltrim(`${this.prefix}:${queueName}:completed`, 0, 99);

      // Update Redis job record
      const raw = await r.get(`dms:job:${jobId}`);
      if (raw) {
        const job = JSON.parse(raw);
        job.status = 'COMPLETED';
        job.completedAt = new Date().toISOString();
        job.result = resultMeta;
        await r.setex(`dms:job:${jobId}`, 86400, JSON.stringify(job)); // 24h retention
      }

      // Update PostgreSQL processing_jobs
      await query(
        `UPDATE processing_jobs
         SET status = 'COMPLETED', completed_at = now()
         WHERE id = $1;`,
        [jobId]
      );
    } catch (err: any) {
      console.error(`[QUEUE_COMPLETE_JOB_ERROR] Job ${jobId}:`, err.message);
    }
  }

  /**
   * Mark a job as failed and handle retry scheduling
   */
  public static async failJob(
    queueName: QueueName,
    jobId: string,
    error: Error | string,
    errorCode: string = 'EXECUTION_ERROR'
  ): Promise<{ retrying: boolean; attempts: number }> {
    const errorMsg = typeof error === 'string' ? error : error.message || 'Unknown failure';
    try {
      const r = await RedisClientManager.connect();

      // Remove from active
      await r.srem(`${this.prefix}:${queueName}:active`, jobId);

      const raw = await r.get(`dms:job:${jobId}`);
      let job: JobData | null = raw ? JSON.parse(raw) : null;
      const currentAttempts = job ? job.attempts : 1;
      const maxRetries = job ? job.maxRetries : 3;

      if (currentAttempts < maxRetries) {
        // Retry: put back into waiting queue
        if (job) {
          job.status = 'QUEUED';
          job.errorMessage = `Attempt ${currentAttempts} failed: ${errorMsg}`;
          job.errorCode = errorCode;
          await r.set(`dms:job:${jobId}`, JSON.stringify(job));
        }

        await r.lpush(`${this.prefix}:${queueName}:waiting`, jobId);

        await query(
          `UPDATE processing_jobs
           SET status = 'QUEUED', error_code = $1, error_message = $2
           WHERE id = $3;`,
          [errorCode, `[RETRY_PENDING] ${errorMsg}`, jobId]
        );

        return { retrying: true, attempts: currentAttempts };
      } else {
        // Max retries exceeded: move to failed list
        await r.lpush(`${this.prefix}:${queueName}:failed`, jobId);
        await r.ltrim(`${this.prefix}:${queueName}:failed`, 0, 99);

        if (job) {
          job.status = 'FAILED';
          job.errorMessage = errorMsg;
          job.errorCode = errorCode;
          job.completedAt = new Date().toISOString();
          await r.setex(`dms:job:${jobId}`, 86400 * 3, JSON.stringify(job));
        }

        await query(
          `UPDATE processing_jobs
           SET status = 'FAILED', error_code = $1, error_message = $2, completed_at = now()
           WHERE id = $3;`,
          [errorCode, errorMsg, jobId]
        );

        return { retrying: false, attempts: currentAttempts };
      }
    } catch (err: any) {
      console.error(`[QUEUE_FAIL_JOB_ERROR] Job ${jobId}:`, err.message);
      return { retrying: false, attempts: 1 };
    }
  }

  /**
   * Retry a failed job manually
   */
  public static async retryJob(jobId: string): Promise<boolean> {
    try {
      const r = await RedisClientManager.connect();

      const raw = await r.get(`dms:job:${jobId}`);
      let queueName: QueueName = 'ocr-queue';

      if (raw) {
        const job: JobData = JSON.parse(raw);
        queueName = job.queue;
        job.status = 'QUEUED';
        job.attempts = 0;
        job.errorMessage = null;
        job.errorCode = null;
        await r.set(`dms:job:${jobId}`, JSON.stringify(job));
        await r.lrem(`${this.prefix}:${queueName}:failed`, 0, jobId);
        await r.lpush(`${this.prefix}:${queueName}:waiting`, jobId);
      } else {
        // Fallback to DB
        const rows = await query<any>('SELECT * FROM processing_jobs WHERE id = $1', [jobId]);
        if (!rows.length) return false;
        const row = rows[0];
        if (row.job_type === 'NOTIFICATION_DISPATCH') queueName = 'notification-queue';
        else if (row.job_type === 'RETENTION_AUDIT') queueName = 'retention-queue';
        else if (row.job_type === 'CRYPTO_SHRED_CLEANUP') queueName = 'cleanup-queue';
        else if (row.job_type === 'BLOCKCHAIN_ANCHOR') queueName = 'blockchain-queue';

        await r.lpush(`${this.prefix}:${queueName}:waiting`, jobId);
      }

      await query(
        `UPDATE processing_jobs
         SET status = 'QUEUED', attempts = 0, error_message = NULL, error_code = NULL
         WHERE id = $1;`,
        [jobId]
      );

      try {
        AutoJobRunner.trigger();
      } catch {
        // Non-blocking
      }

      return true;
    } catch (err: any) {
      console.error(`[QUEUE_RETRY_ERROR] Job ${jobId}:`, err.message);
      return false;
    }
  }

  /**
   * Get real-time queue depths and statistics
   */
  public static async getQueueStats(): Promise<{
    queues: Record<QueueName, { waiting: number; active: number; completed: number; failed: number }>;
    totals: { waiting: number; active: number; completed: number; failed: number };
  }> {
    const queueNames: QueueName[] = ['ocr-queue', 'notification-queue', 'retention-queue', 'cleanup-queue', 'blockchain-queue'];
    const result: Record<QueueName, { waiting: number; active: number; completed: number; failed: number }> = {
      'ocr-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
      'notification-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
      'retention-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
      'cleanup-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
      'blockchain-queue': { waiting: 0, active: 0, completed: 0, failed: 0 },
    };

    let totalWaiting = 0;
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;

    try {
      const r = await RedisClientManager.connect();

      for (const q of queueNames) {
        const waiting   = await r.llen(`${this.prefix}:${q}:waiting`);
        const active    = await r.scard(`${this.prefix}:${q}:active`);
        const completed = await r.llen(`${this.prefix}:${q}:completed`);
        const failed    = await r.llen(`${this.prefix}:${q}:failed`);

        result[q] = { waiting, active, completed, failed };
        totalWaiting   += waiting;
        totalActive    += active;
        totalCompleted += completed;
        totalFailed    += failed;
      }
    } catch (err: any) {
      console.warn('[QUEUE_STATS_WARN] Redis unreachable, pulling from DB:', err.message);
      // Fallback stats from PostgreSQL processing_jobs
      const counts = await query<{ status: string; count: string }>(
        `SELECT status, count(*) as count FROM processing_jobs GROUP BY status;`
      );
      for (const row of counts) {
        const c = parseInt(row.count, 10);
        if (row.status === 'QUEUED')    totalWaiting   = c;
        if (row.status === 'RUNNING')   totalActive    = c;
        if (row.status === 'COMPLETED') totalCompleted = c;
        if (row.status === 'FAILED')    totalFailed    = c;
      }
    }

    return {
      queues: result,
      totals: {
        waiting:   totalWaiting,
        active:    totalActive,
        completed: totalCompleted,
        failed:    totalFailed,
      },
    };
  }
}
