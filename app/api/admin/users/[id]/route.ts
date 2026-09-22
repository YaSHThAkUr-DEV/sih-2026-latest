import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';
import bcrypt from 'bcryptjs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: targetUserId } = await params;

  try {
    const userRes = await query(
      `SELECT 
         u.id,
         u.username,
         u.full_name,
         u.email,
         u.phone,
         u.designation,
         u.employee_code,
         u.status,
         u.max_security_level,
         u.department_id,
         d.name as department_name,
         u.team_id,
         t.name as team_name,
         u.last_login_at,
         u.created_at,
         u.updated_at
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE u.id = $1 AND u.organization_id = $2`,
      [targetUserId, session.organizationId]
    );

    if (userRes.length === 0) {
      return NextResponse.json({ error: 'User record not found.' }, { status: 404 });
    }

    const rolesRes = await query(
      `SELECT r.id, r.name, r.code, r.description, r.is_system_role
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [targetUserId]
    );

    const permissionsRes = await query(
      `SELECT DISTINCT p.id, p.code, p.description
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [targetUserId]
    );

    return NextResponse.json({
      user: userRes[0],
      roles: rolesRes,
      permissions: permissionsRes,
    });
  } catch (err: any) {
    console.error('[ADMIN_GET_USER_BY_ID_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve user details.', details: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: targetUserId } = await params;

  try {
    const body = await req.json();
    const {
      fullName,
      email,
      phone,
      designation,
      employeeCode,
      departmentId,
      teamId,
      status,
      roleIds,
      password,
      maxSecurityLevel,
    } = body;

    // Fetch existing user to verify existence & current roles
    const existing = await query(
      `SELECT u.id, u.status, u.username, u.email,
              COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') as current_role_codes
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1 AND u.organization_id = $2
       GROUP BY u.id`,
      [targetUserId, session.organizationId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User record not found.' }, { status: 404 });
    }

    const currentUserRecord = existing[0];
    const isTargetSuperAdmin = (currentUserRecord.current_role_codes || []).includes('SUPER_ADMIN');

    // 1. Self-Lockout Prevention: Admin cannot deactivate or suspend themselves
    if (targetUserId === session.userId && status && status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Action Blocked: Self-lockout prevention prevents deactivating your own active session.' },
        { status: 400 }
      );
    }

    // 2. Sole Super Administrator Protection: Cannot suspend or demote the last Super Admin
    if (isTargetSuperAdmin) {
      const activeSuperAdmins = await query<{ count: string }>(
        `SELECT count(DISTINCT u.id) as count
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE r.code = 'SUPER_ADMIN' AND u.status = 'ACTIVE'`
      );

      const superAdminCount = parseInt(activeSuperAdmins[0]?.count || '0', 10);

      if (superAdminCount <= 1) {
        if (status && status !== 'ACTIVE') {
          return NextResponse.json(
            { error: 'Action Blocked: Cannot deactivate or suspend the sole active Super Administrator.' },
            { status: 400 }
          );
        }

        if (Array.isArray(roleIds)) {
          // Check if SUPER_ADMIN role ID is in roleIds
          const superAdminRole = await query<{ id: string }>(
            `SELECT id FROM roles WHERE code = 'SUPER_ADMIN' LIMIT 1`
          );
          if (superAdminRole.length && !roleIds.includes(superAdminRole[0].id)) {
            return NextResponse.json(
              { error: 'Action Blocked: Cannot revoke Super Administrator privilege from the sole active Super Admin.' },
              { status: 400 }
            );
          }
        }
      }
    }

    // Update user columns
    const setClauses: string[] = ['updated_at = NOW()'];
    const queryParams: any[] = [targetUserId, session.organizationId];

    if (fullName !== undefined) {
      queryParams.push(fullName);
      setClauses.push(`full_name = $${queryParams.length}`);
    }
    if (email !== undefined) {
      queryParams.push(email);
      setClauses.push(`email = $${queryParams.length}`);
    }
    if (phone !== undefined) {
      queryParams.push(phone || null);
      setClauses.push(`phone = $${queryParams.length}`);
    }
    if (designation !== undefined) {
      queryParams.push(designation || null);
      setClauses.push(`designation = $${queryParams.length}`);
    }
    if (employeeCode !== undefined) {
      queryParams.push(employeeCode || null);
      setClauses.push(`employee_code = $${queryParams.length}`);
    }
    if (departmentId !== undefined) {
      queryParams.push(departmentId || null);
      setClauses.push(`department_id = $${queryParams.length}`);
    }
    if (teamId !== undefined) {
      queryParams.push(teamId || null);
      setClauses.push(`team_id = $${queryParams.length}`);
    }
    if (status !== undefined) {
      queryParams.push(status);
      setClauses.push(`status = $${queryParams.length}`);
    }
    if (maxSecurityLevel !== undefined) {
      const level = Math.min(5, Math.max(1, Number(maxSecurityLevel) || 3));
      queryParams.push(level);
      setClauses.push(`max_security_level = $${queryParams.length}`);
    }
    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      queryParams.push(hash);
      setClauses.push(`password_hash = $${queryParams.length}`);
    }

    await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
      queryParams
    );

    // Update Roles if provided
    if (Array.isArray(roleIds)) {
      // Remove current roles
      await query(`DELETE FROM user_roles WHERE user_id = $1`, [targetUserId]);

      // Insert new roles
      for (const roleId of roleIds) {
        await query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [targetUserId, roleId, session.userId]
        );
      }
    }

    // Audit log
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_USER_UPDATED',
      actorId: session.userId,
      resourceType: 'USER',
      resourceId: targetUserId,
      result: 'SUCCESS',
      metadata: {
        updatedUserId: targetUserId,
        changedFields: { fullName, email, designation, departmentId, teamId, status, roleIdsUpdated: !!roleIds },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Institutional user credentials and privileges updated successfully.',
    });
  } catch (err: any) {
    console.error('[ADMIN_UPDATE_USER_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to update user record.', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: targetUserId } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get('permanent') === 'true';

  try {
    if (targetUserId === session.userId) {
      return NextResponse.json(
        { error: 'Action Blocked: You cannot delete or suspend your own active administrator account.' },
        { status: 400 }
      );
    }

    // Verify user existence and role
    const existing = await query(
      `SELECT u.id, u.username, u.full_name, u.email,
              COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') as current_role_codes
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1 AND u.organization_id = $2
       GROUP BY u.id`,
      [targetUserId, session.organizationId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User record not found.' }, { status: 404 });
    }

    const isSuperAdmin = (existing[0].current_role_codes || []).includes('SUPER_ADMIN');
    if (isSuperAdmin) {
      const activeSuperAdmins = await query<{ count: string }>(
        `SELECT count(DISTINCT u.id) as count
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE r.code = 'SUPER_ADMIN' AND u.status = 'ACTIVE'`
      );

      if (parseInt(activeSuperAdmins[0]?.count || '0', 10) <= 1) {
        return NextResponse.json(
          { error: 'Action Blocked: Cannot delete or disable the sole active Super Administrator.' },
          { status: 400 }
        );
      }
    }

    if (permanent) {
      // 1. Remove assigned user roles & permissions
      await query(`DELETE FROM user_roles WHERE user_id = $1`, [targetUserId]);
      await query(`DELETE FROM document_permissions WHERE user_id = $1`, [targetUserId]);
      await query(`DELETE FROM notifications WHERE user_id = $1`, [targetUserId]);

      // 2. Safely reassign/nullify historical activity references so foreign key constraints pass
      await query(`UPDATE audit_events SET actor_id = NULL WHERE actor_id = $1`, [targetUserId]);
      await query(`UPDATE documents SET owner_id = $2 WHERE owner_id = $1`, [targetUserId, session.userId]);
      await query(`UPDATE documents SET created_by = $2 WHERE created_by = $1`, [targetUserId, session.userId]);
      await query(`UPDATE documents SET updated_by = $2 WHERE updated_by = $1`, [targetUserId, session.userId]);
      await query(`UPDATE document_versions SET created_by = $2 WHERE created_by = $1`, [targetUserId, session.userId]);
      await query(`UPDATE change_requests SET requested_by = $2 WHERE requested_by = $1`, [targetUserId, session.userId]);
      await query(`UPDATE change_requests SET assigned_approver_id = NULL WHERE assigned_approver_id = $1`, [targetUserId]);
      await query(`UPDATE approval_actions SET approver_id = $2 WHERE approver_id = $1`, [targetUserId, session.userId]);
      await query(`UPDATE deletion_requests SET requested_by = $2 WHERE requested_by = $1`, [targetUserId, session.userId]);
      await query(`UPDATE deletion_requests SET approved_by = NULL WHERE approved_by = $1`, [targetUserId]);
      await query(`UPDATE retention_records SET legal_hold_by = NULL WHERE legal_hold_by = $1`, [targetUserId]);
      await query(`UPDATE system_settings SET updated_by = $2 WHERE updated_by = $1`, [targetUserId, session.userId]);

      // 3. Delete user row permanently
      await query(`DELETE FROM users WHERE id = $1 AND organization_id = $2`, [targetUserId, session.organizationId]);

      await logAuditEvent({
        organizationId: session.organizationId,
        eventType: 'ADMIN_USER_DELETED',
        actorId: session.userId,
        resourceType: 'USER',
        resourceId: targetUserId,
        result: 'SUCCESS',
        metadata: {
          targetUserId,
          username: existing[0].username,
          fullName: existing[0].full_name,
          email: existing[0].email,
          action: 'User permanently deleted from database',
        },
      });

      return NextResponse.json({
        success: true,
        message: `User ${existing[0].full_name} (${existing[0].username}) has been permanently deleted.`,
      });
    } else {
      // Soft disable
      await query(
        `UPDATE users SET status = 'DISABLED', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
        [targetUserId, session.organizationId]
      );

      await logAuditEvent({
        organizationId: session.organizationId,
        eventType: 'ADMIN_USER_DISABLED',
        actorId: session.userId,
        resourceType: 'USER',
        resourceId: targetUserId,
        result: 'SUCCESS',
        metadata: {
          targetUserId,
          username: existing[0].username,
          action: 'Account set to DISABLED status',
        },
      });

      return NextResponse.json({
        success: true,
        message: `User ${existing[0].full_name} (${existing[0].username}) has been deactivated.`,
      });
    }
  } catch (err: any) {
    console.error('[ADMIN_DELETE_USER_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to process user deletion.', details: err.message },
      { status: 500 }
    );
  }
}
