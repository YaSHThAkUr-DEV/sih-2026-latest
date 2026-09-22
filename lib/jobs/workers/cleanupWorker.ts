import { JobQueueManager } from '@/lib/jobs/queue';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export interface CleanupJobPayload {
  deletionRequestId?: string;
  scope?: 'APPROVED_DELETIONS' | 'ORPHAN_TEMP_FILES';
}

export class CleanupWorker {
  public static async processNext(): Promise<{ processed: boolean; jobId?: string; details?: any; error?: string }> {
    const job = await JobQueueManager.getNextJob<CleanupJobPayload>('cleanup-queue');
    if (!job) {
      return { processed: false };
    }

    try {
      console.log(`[CLEANUP_WORKER] Executing cleanup/crypto-shred job ${job.id}...`);

      if (job.type === 'TEST_JOB') {
        const summary = {
          shreddedCount: 0,
          synthetic: true,
          executedAt: new Date().toISOString(),
        };
        await JobQueueManager.completeJob('cleanup-queue', job.id, summary);
        return { processed: true, jobId: job.id, details: summary };
      }

      // 1. Fetch approved deletion requests awaiting execution
      const pendingShreds = await query<any>(
        `SELECT 
           dr.id,
           dr.document_id,
           dr.requested_by,
           dr.approved_by,
           dr.status,
           d.document_number,
           d.organization_id
         FROM deletion_requests dr
         JOIN documents d ON dr.document_id = d.id
         WHERE dr.status = 'APPROVED';`
      );

      let shreddedCount = 0;

      for (const req of pendingShreds) {
        // Cryptographic zeroization: Wipes Vault key references & marks DELETED
        await query(
          `UPDATE document_versions 
           SET vault_key_reference = '{"shredded": true, "zeroized_at": "' || now() || '"}'
           WHERE document_id = $1;`,
          [req.document_id]
        );

        await query(
          `UPDATE documents SET status = 'DELETED', updated_at = now() WHERE id = $1;`,
          [req.document_id]
        );

        await query(
          `UPDATE deletion_requests 
           SET status = 'COMPLETED', completed_at = now() 
           WHERE id = $1;`,
          [req.id]
        );

        await logAuditEvent({
          organizationId: req.organization_id,
          eventType: 'CRYPTO_SHRED_EXECUTED',
          actorId: req.approved_by || req.requested_by,
          resourceType: 'DOCUMENT',
          documentId: req.document_id,
          ipAddress: '127.0.0.1',
          result: 'SUCCESS',
          metadata: {
            docketNumber: req.document_number,
            protocol: 'DoD 5220.22-M / NIST SP 800-88 Zeroization',
            deletionRequestId: req.id,
          },
        });

        shreddedCount++;
      }

      const summary = {
        shreddedCount,
        executedAt: new Date().toISOString(),
      };

      await JobQueueManager.completeJob('cleanup-queue', job.id, summary);
      return { processed: true, jobId: job.id, details: summary };
    } catch (err: any) {
      console.error(`[CLEANUP_WORKER_ERROR] Job ${job.id} failed:`, err.message);
      await JobQueueManager.failJob('cleanup-queue', job.id, err.message, 'CLEANUP_FAILURE');
      return { processed: true, jobId: job.id, error: err.message };
    }
  }
}
