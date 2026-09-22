import { NextRequest, NextResponse } from 'next/server';
import { JobQueueManager, QueueName, JobType } from '@/lib/jobs/queue';
import { getCurrentSession } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let { queue, type = 'TEST_JOB', payload = {}, documentVersionId = null } = body;

    // Smart default queue resolution based on job type
    if (!queue) {
      if (type === 'RETENTION_AUDIT') queue = 'retention-queue';
      else if (type === 'BLOCKCHAIN_ANCHOR') queue = 'blockchain-queue';
      else if (type === 'NOTIFICATION_DISPATCH') queue = 'notification-queue';
      else if (type === 'CRYPTO_SHRED_CLEANUP') queue = 'cleanup-queue';
      else queue = 'ocr-queue';
    }

    const validQueues: QueueName[] = [
      'ocr-queue',
      'notification-queue',
      'retention-queue',
      'cleanup-queue',
      'blockchain-queue',
    ];
    if (!validQueues.includes(queue)) {
      return NextResponse.json(
        { error: `Invalid queue name. Must be one of: ${validQueues.join(', ')}` },
        { status: 400 }
      );
    }

    const job = await JobQueueManager.enqueue(
      queue as QueueName,
      type as JobType,
      { ...payload, enqueuedBy: session.userId },
      { documentVersionId }
    );

    return NextResponse.json({
      success: true,
      message: `Job ${job.id} queued successfully in ${queue}`,
      job,
    });
  } catch (err: any) {
    console.error('[API_ENQUEUE_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
