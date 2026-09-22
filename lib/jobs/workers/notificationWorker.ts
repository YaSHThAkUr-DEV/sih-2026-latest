import { JobQueueManager } from '@/lib/jobs/queue';
import { sendNotification, sendRoleNotification, sendBroadcastNotification, CreateNotificationParams } from '@/lib/notifications/service';

export interface NotificationJobPayload {
  mode?: 'user' | 'role' | 'broadcast';
  targetRole?: string;
  userId?: string;
  type: CreateNotificationParams['type'];
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  severity?: CreateNotificationParams['severity'];
  metadata?: Record<string, any>;
}

export class NotificationWorker {
  public static async processNext(): Promise<{ processed: boolean; jobId?: string; error?: string }> {
    const job = await JobQueueManager.getNextJob<NotificationJobPayload>('notification-queue');
    if (!job) {
      return { processed: false };
    }

    try {
      if (job.type === 'TEST_JOB') {
        console.log(`[NOTIFICATION_WORKER] Processing TEST_JOB (${job.id})...`);
        await JobQueueManager.completeJob('notification-queue', job.id, {
          deliveredAt: new Date().toISOString(),
          synthetic: true,
          mode: 'test',
        });
        return { processed: true, jobId: job.id };
      }

      const p = job.payload || {};
      const mode = p.mode || (p.targetRole ? 'role' : p.userId ? 'user' : 'broadcast');

      if (mode === 'role' && p.targetRole) {
        await sendRoleNotification(p.targetRole, {
          type: p.type,
          title: p.title,
          message: p.message,
          resourceType: p.resourceType,
          resourceId: p.resourceId,
          severity: p.severity,
          metadata: p.metadata,
        });
      } else if (mode === 'user' && p.userId) {
        await sendNotification({
          userId: p.userId,
          type: p.type,
          title: p.title,
          message: p.message,
          resourceType: p.resourceType,
          resourceId: p.resourceId,
          severity: p.severity,
          metadata: p.metadata,
        });
      } else {
        await sendBroadcastNotification({
          type: p.type,
          title: p.title,
          message: p.message,
          resourceType: p.resourceType,
          resourceId: p.resourceId,
          severity: p.severity,
          metadata: p.metadata,
        });
      }

      await JobQueueManager.completeJob('notification-queue', job.id, {
        deliveredAt: new Date().toISOString(),
        mode,
      });

      return { processed: true, jobId: job.id };
    } catch (err: any) {
      console.error(`[NOTIFICATION_WORKER_ERROR] Job ${job.id} failed:`, err.message);
      await JobQueueManager.failJob('notification-queue', job.id, err.message, 'NOTIF_DISPATCH_FAILURE');
      return { processed: true, jobId: job.id, error: err.message };
    }
  }
}
