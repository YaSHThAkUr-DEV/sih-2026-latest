import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: roleId } = await params;

  try {
    const role = await query(
      `SELECT id, name, code, description, is_system_role FROM roles WHERE id = $1 AND organization_id = $2`,
      [roleId, session.organizationId]
    );

    if (role.length === 0) {
      return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
    }

    const permissions = await query(
      `SELECT p.id, p.code, p.description,
              CASE WHEN rp.role_id IS NOT NULL THEN true ELSE false END as assigned
       FROM permissions p
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = $1
       ORDER BY p.code ASC`,
      [roleId]
    );

    return NextResponse.json({ role: role[0], permissions });
  } catch (err: any) {
    console.error('[ADMIN_GET_ROLE_PERMISSIONS_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve role permissions.', details: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: roleId } = await params;

  try {
    const body = await req.json();
    const { permissionIds } = body;

    if (!Array.isArray(permissionIds)) {
      return NextResponse.json(
        { error: 'Invalid payload: permissionIds must be an array of UUIDs.' },
        { status: 400 }
      );
    }

    const role = await query(
      `SELECT id, name, code, is_system_role FROM roles WHERE id = $1 AND organization_id = $2`,
      [roleId, session.organizationId]
    );

    if (role.length === 0) {
      return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
    }

    const roleRecord = role[0];

    // Immutable Super Admin Role Protection: Must retain core privileges
    if (roleRecord.code === 'SUPER_ADMIN') {
      const corePermissions = await query<{ id: string; code: string }>(
        `SELECT id, code FROM permissions WHERE code IN ('PERMISSION_MANAGE', 'DOCUMENT_VIEW', 'AUDIT_VIEW')`
      );

      for (const cp of corePermissions) {
        if (!permissionIds.includes(cp.id)) {
          return NextResponse.json(
            {
              error: `Security Lock: Cannot strip critical system permission "${cp.code}" from the Super Administrator role.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Replace permissions
    await query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);

    for (const pid of permissionIds) {
      await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, pid]
      );
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_ROLE_PERMISSIONS_UPDATED',
      actorId: session.userId,
      resourceType: 'ROLE',
      resourceId: roleId,
      result: 'SUCCESS',
      metadata: {
        roleId,
        roleCode: roleRecord.code,
        assignedPermissionsCount: permissionIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Permissions updated for role "${roleRecord.name}".`,
    });
  } catch (err: any) {
    console.error('[ADMIN_UPDATE_ROLE_PERMISSIONS_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to update role permissions.', details: err.message },
      { status: 500 }
    );
  }
}
