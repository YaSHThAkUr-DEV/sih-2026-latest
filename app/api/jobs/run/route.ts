import { NextRequest, NextResponse } from 'next/server';
import { JobRunner } from '@/lib/jobs/jobRunner';
import { getCurrentSession } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const drain = searchParams.get('drain') === 'true';

    if (drain) {
      const summary = await JobRunner.drainQueues(10);
      return NextResponse.json({
        success: true,
        message: `Drained ${summary.processedTotal} jobs across all queues`,
        summary,
      });
    }

    const tick = await JobRunner.tick();
    const count =
      (tick.ocr.processed ? 1 : 0) +
      (tick.notification.processed ? 1 : 0) +
      (tick.retention.processed ? 1 : 0) +
      (tick.cleanup.processed ? 1 : 0);

    return NextResponse.json({
      success: true,
      message: `Worker tick processed ${count} jobs`,
      tick,
    });
  } catch (err: any) {
    console.error('[API_RUN_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
