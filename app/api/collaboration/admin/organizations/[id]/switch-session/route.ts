import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, createSessionToken, setSessionCookie } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Admin clearance required' }, { status: 403 });
    }

    const { id: orgId } = await params;
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    let targetUser: any = null;

    if (userId) {
      const users = await query(
        `
        SELECT 
          u.id, u.username, u.full_name, u.email, u.designation, u.max_security_level,
          u.organization_id, u.department_id,
          o.name as organization_name, o.code as organization_code,
          d.name as department_name
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = $1 AND u.organization_id = $2
        `,
        [userId, orgId]
      );
      if (users.length > 0) targetUser = users[0];
    }

    if (!targetUser) {
      // Find primary admin or first active user of the organization
      const users = await query(
        `
        SELECT 
          u.id, u.username, u.full_name, u.email, u.designation, u.max_security_level,
          u.organization_id, u.department_id,
          o.name as organization_name, o.code as organization_code,
          d.name as department_name
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.organization_id = $1 AND u.status = 'ACTIVE'
        ORDER BY u.created_at ASC
        LIMIT 1
        `,
        [orgId]
      );
      if (users.length > 0) targetUser = users[0];
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: 'No active user found in this organization to switch to' },
        { status: 404 }
      );
    }

    // Load roles and permissions for target user
    const rolesData = await query(
      `
      SELECT r.code, r.id
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
      `,
      [targetUser.id]
    );
    const roles = rolesData.map((r: any) => r.code);

    const permsData = await query(
      `
      SELECT DISTINCT p.code
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1
      `,
      [targetUser.id]
    );
    const permissions = permsData.map((p: any) => p.code);

    const token = await createSessionToken({
      userId: targetUser.id,
      username: targetUser.username,
      fullName: targetUser.full_name,
      email: targetUser.email,
      designation: targetUser.designation || undefined,
      organizationId: targetUser.organization_id,
      organizationCode: targetUser.organization_code,
      organizationName: targetUser.organization_name,
      departmentId: targetUser.department_id,
      departmentName: targetUser.department_name,
      roles: roles.length > 0 ? roles : ['OFFICER'],
      permissions,
      maxSecurityLevel: targetUser.max_security_level || 3,
    });

    await setSessionCookie(token);

    await logAuditEvent({
      organizationId: targetUser.organization_id,
      eventType: 'USER_LOGIN',
      actorId: targetUser.id,
      resourceType: 'SESSION_SWITCH',
      result: 'SUCCESS',
      metadata: {
        switchedBy: session.userId,
        targetUserId: targetUser.id,
        targetOrgCode: targetUser.organization_code,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Switched context to ${targetUser.full_name} (${targetUser.organization_name})`,
      switchedTo: {
        userId: targetUser.id,
        fullName: targetUser.full_name,
        email: targetUser.email,
        designation: targetUser.designation,
        organizationId: targetUser.organization_id,
        organizationCode: targetUser.organization_code,
        organizationName: targetUser.organization_name,
        roles,
      },
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ADMIN_SWITCH_SESSION_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to switch organization session', details: error.message },
      { status: 500 }
    );
  }
}
