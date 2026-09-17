// =============================================================================
// Module 21 — Blockchain Anchoring Worker
// =============================================================================
// Redis queue worker that processes BLOCKCHAIN_ANCHOR jobs asynchronously.
// Follows the same pattern as ocrWorker.ts, notificationWorker.ts, etc.
// =============================================================================

import { JobQueueManager, JobData } from '@/lib/jobs/queue';
import { BlockchainService } from '@/lib/blockchain/service';
import type { BlockchainAnchorPayload } from '@/lib/blockchain/types';

export class BlockchainWorker {
  /**
   * Process the next available blockchain anchoring job from the queue.
   * Dequeues from `blockchain-queue`, calls BlockchainService.anchorHash(),
   * and marks the job as completed or failed.
   */
  public static async processNext(): Promise<{
    processed: boolean;
    jobId?: string;
    transactionId?: string;
    error?: string;
  }> {
    const job = await JobQueueManager.getNextJob<BlockchainAnchorPayload>('blockchain-queue');
    if (!job) {
      return { processed: false };
    }

    try {
      const {
        auditEventId,
        payloadHash,
        documentId,
        eventType,
        actorId,
        organizationId,
        metadata,
      } = job.payload;

      if (!auditEventId || !payloadHash) {
        throw new Error('Missing auditEventId or payloadHash in blockchain anchor job payload');
      }

      console.log(
        `[BLOCKCHAIN_WORKER] Anchoring hash ${payloadHash.substring(0, 16)}... ` +
        `for event ${eventType} (Job ${job.id})...`
      );

      // 1. Execute the blockchain anchoring
      const receipt = await BlockchainService.anchorHash({
        auditEventId,
        payloadHash,
        documentId,
        eventType: eventType as any,
        actorId,
        organizationId,
        metadata,
      });

      // 2. Mark job as completed with receipt metadata
      await JobQueueManager.completeJob('blockchain-queue', job.id, {
        transactionId: receipt.transactionId,
        blockNumber: receipt.blockNumber,
        ledgerStatus: receipt.ledgerStatus,
        channelName: receipt.channelName,
      });

      // 3. Enqueue an evidentiary notification about the anchoring
      if (actorId || organizationId) {
        try {
          await JobQueueManager.enqueue(
            'notification-queue',
            'NOTIFICATION_DISPATCH',
            {
              userId: actorId,
              type: 'BLOCKCHAIN_ANCHOR',
              title: `Evidence Hash Anchored to Hyperledger Fabric Ledger`,
              message:
                `SHA-256 payload hash ${payloadHash.substring(0, 16)}... successfully committed ` +
                `to ${receipt.channelName} (Block #${receipt.blockNumber}). ` +
                `Transaction ID: ${receipt.transactionId.substring(0, 16)}... ` +
                `Endorsed by ${receipt.endorsingPeers.length} peer nodes.`,
              resourceType: 'BLOCKCHAIN',
              resourceId: receipt.recordId,
              severity: 'SUCCESS',
              metadata: {
                transactionId: receipt.transactionId,
                blockNumber: receipt.blockNumber,
                eventType,
                actionTarget: 'blockchain',
              },
            }
          );
        } catch {
          // Notification failure should not break the anchoring flow
        }
      }

      console.log(
        `[BLOCKCHAIN_WORKER] Successfully anchored Job ${job.id} → ` +
        `TX ${receipt.transactionId.substring(0, 16)}... Block #${receipt.blockNumber}`
      );

      return {
        processed: true,
        jobId: job.id,
        transactionId: receipt.transactionId,
      };
    } catch (err: any) {
      console.error(`[BLOCKCHAIN_WORKER_ERROR] Job ${job.id} failed:`, err.message);
      await JobQueueManager.failJob('blockchain-queue', job.id, err.message, 'BLOCKCHAIN_ANCHOR_FAILURE');
      return { processed: true, jobId: job.id, error: err.message };
    }
  }
}
