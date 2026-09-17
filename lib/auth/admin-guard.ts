import { NextResponse } from 'next/server';
import { getCurrentSession, UserSessionPayload } from '@/lib/auth/jwt';
import { isAdmin, isSuperAdmin } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/auth/audit';

export interface AdminAuthResult {
  session: UserSessionPayload;
  errorResponse?: null;
}

export interface AdminAuthFailure {
  session?: null;
  errorResponse: NextResponse;
}

/**
 * Validates that the current request has an active session with administrative
 * capabilities. Uses modular RBAC — checks permissions, not hardcoded role names
 * (except SUPER_ADMIN which is the only reserved system role).
 */
export async function verifyAdminSession(req?: Request): Promise<AdminAuthResult | AdminAuthFailure> {
  const session = await getCurrentSession(req);

  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Authentication required. No active session detected.' },
        { status: 401 }
      ),
    };
  }

  if (!isAdmin(session)) {
    // Log unauthorized access attempt
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
      actorId: session.userId,
      resourceType: 'ADMIN_CONSOLE',
      result: 'DENIED',
      failureReason: 'User lacks administrative permissions',
      metadata: {
        userId: session.userId,
        email: session.email,
        roles: session.roles,
        permissions: session.permissions,
      },
    });

    return {
      errorResponse: NextResponse.json(
        { error: 'Access Denied: Administrative clearance level required.' },
        { status: 403 }
      ),
    };
  }

  return { session, errorResponse: null };
}
