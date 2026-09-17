import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, clearSessionCookie } from '@/lib/auth/jwt';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown';

  const session = await getCurrentSession();

  if (session) {
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'USER_LOGOUT',
      actorId: session.userId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { username: session.username },
    });
  }

  await clearSessionCookie();

  return NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
}
