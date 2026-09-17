import { OcrWorker } from './workers/ocrWorker';
import { NotificationWorker } from './workers/notificationWorker';
import { RetentionWorker } from './workers/retentionWorker';
import { CleanupWorker } from './workers/cleanupWorker';
import { JobQueueManager } from './queue';

export interface TickSummary {
  ocr: { processed: boolean; jobId?: string; error?: string };
  notification: { processed: boolean; jobId?: string; error?: string };
  retention: { processed: boolean; jobId?: string; error?: string };
  cleanup: { processed: boolean; jobId?: string; error?: string };
  timestamp: string;
}

export class JobRunner {
  /**
   * Run one iteration across all 4 queues
   */
  public static async tick(): Promise<TickSummary> {
    const [ocr, notification, retention, cleanup] = await Promise.all([
      OcrWorker.processNext(),
      NotificationWorker.processNext(),
      RetentionWorker.processNext(),
      CleanupWorker.processNext(),
    ]);

    return {
      ocr,
      notification,
      retention,
      cleanup,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Drain all pending jobs across all queues until empty or maxIterations reached
   */
  public static async drainQueues(maxPerQueue = 10): Promise<{
    processedTotal: number;
    details: TickSummary[];
  }> {
    const details: TickSummary[] = [];
    let processedTotal = 0;

    for (let i = 0; i < maxPerQueue; i++) {
      const step = await this.tick();
      const anyProcessed =
        step.ocr.processed ||
        step.notification.processed ||
        step.retention.processed ||
        step.cleanup.processed;

      if (!anyProcessed) {
        break; // All queues empty
      }

      if (step.ocr.processed) processedTotal++;
      if (step.notification.processed) processedTotal++;
      if (step.retention.processed) processedTotal++;
      if (step.cleanup.processed) processedTotal++;

      details.push(step);
    }

    return { processedTotal, details };
  }
}
