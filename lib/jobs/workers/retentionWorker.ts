import { JobQueueManager } from '@/lib/jobs/queue';
import { query } from '@/lib/db';

export interface RetentionJobPayload {
  organizationId?: string;
  auditScope?: 'SCHEDULE_ALL' | 'CRITICAL_ONLY';
}

export class RetentionWorker {
  public static async processNext(): Promise<{ processed: boolean; jobId?: string; details?: any; error?: string }> {
    const job = await JobQueueManager.getNextJob<RetentionJobPayload>('retention-queue');
    if (!job) {
      return { processed: false };
    }

    try {
      console.log(`[RETENTION_WORKER] Executing statutory BNSS audit (Job ${job.id})...`);

      if (job.type === 'TEST_JOB') {
        const summary = {
          auditedCount: 1,
          legalHoldsPreserved: 0,
          expiryAlertsRaised: 0,
          synthetic: true,
          evaluatedAt: new Date().toISOString(),
        };
        await JobQueueManager.completeJob('retention-queue', job.id, summary);
        return { processed: true, jobId: job.id, details: summary };
      }

      // 1. Fetch active retention records joining policies & documents
      const records = await query<any>(
        `SELECT 
           rr.id,
           rr.document_id,
           rr.legal_hold as is_legal_hold,
           rr.legal_hold_reason,
           rr.retention_end_at as expiry_date,
           rr.retention_start_at as retention_start_date,
           d.document_number,
           d.title,
           d.created_by,
           rp.name as policy_name,
           rp.retention_days as retention_period_days,
           CURRENT_DATE as today
         FROM retention_records rr
         JOIN documents d ON rr.document_id = d.id
         JOIN retention_policies rp ON rr.retention_policy_id = rp.id
         WHERE d.status = 'ACTIVE';`
      );

      let auditedCount = records.length;
      let legalHoldsPreserved = 0;
      let expiryAlertsRaised = 0;

      for (const rec of records) {
        if (rec.is_legal_hold) {
          legalHoldsPreserved++;
          continue; // Protected by judicial legal hold immunity
        }

        if (rec.expiry_date) {
          const expiry = new Date(rec.expiry_date).getTime();
          const now = Date.now();
          const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

          if (daysRemaining <= 180 && daysRemaining > 0) {
            expiryAlertsRaised++;
            // Enqueue notification via notification queue
            await JobQueueManager.enqueue(
              'notification-queue',
              'NOTIFICATION_DISPATCH',
              {
                userId: rec.created_by,
                type: 'RETENTION_EXPIRY',
                title: `Statutory Retention Notice: ${daysRemaining} Days Remaining for ${rec.document_number}`,
                message: `Docket ${rec.document_number} reaches statutory BNSS lifecycle limit on ${new Date(rec.expiry_date).toLocaleDateString()}. Subject to automatic Key-1 disposal staging.`,
                resourceType: 'DOCUMENT',
                resourceId: rec.document_id,
                severity: daysRemaining <= 30 ? 'CRITICAL' : 'WARNING',
                metadata: {
                  docketNumber: rec.document_number,
                  daysRemaining,
                  actionTarget: 'retention',
                },
              }
            );
          }
        }
      }

      const summary = {
        auditedCount,
        legalHoldsPreserved,
        expiryAlertsRaised,
        evaluatedAt: new Date().toISOString(),
      };

      await JobQueueManager.completeJob('retention-queue', job.id, summary);
      console.log(`[RETENTION_WORKER] Successfully completed BNSS audit. Audited: ${auditedCount}, Alerts: ${expiryAlertsRaised}`);

      return { processed: true, jobId: job.id, details: summary };
    } catch (err: any) {
      console.error(`[RETENTION_WORKER_ERROR] Job ${job.id} failed:`, err.message);
      await JobQueueManager.failJob('retention-queue', job.id, err.message, 'RETENTION_AUDIT_FAILURE');
      return { processed: true, jobId: job.id, error: err.message };
    }
  }
}
