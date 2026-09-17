import { NextRequest, NextResponse } from 'next/server';
import { JobQueueManager } from '@/lib/jobs/queue';
import { getCurrentSession } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const retried = await JobQueueManager.retryJob(jobId);
    if (!retried) {
      return NextResponse.json({ error: `Could not retry job ${jobId}` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} successfully re-enqueued for worker execution`,
    });
  } catch (err: any) {
    console.error('[API_RETRY_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
