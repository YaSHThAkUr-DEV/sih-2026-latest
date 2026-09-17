import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { all, notificationId, notificationIds } = body;

    if (all) {
      const result = await query(
        'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id',
        [session.userId]
      );
      return NextResponse.json({
        success: true,
        updatedCount: result.length,
        message: 'All notifications marked as read.',
      });
    }

    if (notificationId) {
      await query(
        'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2',
        [notificationId, session.userId]
      );
      return NextResponse.json({
        success: true,
        message: 'Notification marked as read.',
      });
    }

    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      await query(
        'UPDATE notifications SET read_at = now() WHERE id = ANY($1) AND user_id = $2',
        [notificationIds, session.userId]
      );
      return NextResponse.json({
        success: true,
        updatedCount: notificationIds.length,
        message: `${notificationIds.length} notifications marked as read.`,
      });
    }

    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  } catch (error: any) {
    console.error('Error marking notifications read:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
