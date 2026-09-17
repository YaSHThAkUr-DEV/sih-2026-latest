import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const roles = await query(
      `SELECT 
         r.id,
         r.name,
         r.code,
         r.description,
         r.is_system_role,
         COUNT(DISTINCT ur.user_id) as user_count,
         COALESCE(
           json_agg(
             json_build_object('id', p.id, 'code', p.code, 'description', p.description)
           ) FILTER (WHERE p.id IS NOT NULL),
           '[]'
         ) as permissions
       FROM roles r
       LEFT JOIN user_roles ur ON r.id = ur.role_id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE r.organization_id = $1
       GROUP BY r.id
       ORDER BY r.is_system_role DESC, r.name ASC`,
      [session.organizationId]
    );

    return NextResponse.json({ roles });
  } catch (err: any) {
    console.error('[ADMIN_GET_ROLES_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve role matrix.', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const body = await req.json();
    const { name, code, description, permissionIds } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Role title and role code are required.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // Check duplicate
    const existing = await query(
      `SELECT id FROM roles WHERE code = $1 AND organization_id = $2`,
      [cleanCode, session.organizationId]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Role code "${cleanCode}" already exists.` },
        { status: 409 }
      );
    }

    const newRole = await query<{ id: string }>(
      `INSERT INTO roles (organization_id, name, code, description, is_system_role)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id;`,
      [session.organizationId, name.trim(), cleanCode, description?.trim() || null]
    );

    const roleId = newRole[0].id;

    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      for (const permId of permissionIds) {
        await query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [roleId, permId]
        );
      }
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_ROLE_CREATED',
      actorId: session.userId,
      resourceType: 'ROLE',
      resourceId: roleId,
      result: 'SUCCESS',
      metadata: {
        roleId,
        name,
        code: cleanCode,
        permissionsCount: (permissionIds || []).length,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Institutional role created successfully.', roleId },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[ADMIN_CREATE_ROLE_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to create role.', details: err.message },
      { status: 500 }
    );
  }
}
