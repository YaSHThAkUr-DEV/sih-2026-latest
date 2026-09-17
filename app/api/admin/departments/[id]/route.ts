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
  const { id: departmentId } = await params;

  try {
    const dept = await query(
      `SELECT d.*, pd.name as parent_department_name
       FROM departments d
       LEFT JOIN departments pd ON d.parent_department_id = pd.id
       WHERE d.id = $1 AND d.organization_id = $2`,
      [departmentId, session.organizationId]
    );

    if (dept.length === 0) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    const teams = await query(
      `SELECT t.id, t.name, t.code, t.status, COUNT(u.id) as member_count
       FROM teams t
       LEFT JOIN users u ON t.id = u.team_id AND u.status != 'DISABLED'
       WHERE t.department_id = $1
       GROUP BY t.id
       ORDER BY t.name ASC`,
      [departmentId]
    );

    const members = await query(
      `SELECT u.id, u.username, u.full_name, u.email, u.designation, u.status, t.name as team_name
       FROM users u
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE u.department_id = $1 AND u.organization_id = $2
       ORDER BY u.full_name ASC`,
      [departmentId, session.organizationId]
    );

    const policies = await query(
      `SELECT dtp.id, dtp.active, dtp.approval_required, dtp.ocr_required, dtp.download_allowed,
              dt.name as document_type_name, dt.code as document_type_code,
              sl.name as security_level_name, sl.code as security_level_code,
              rp.name as retention_policy_name
       FROM document_type_policies dtp
       JOIN document_types dt ON dtp.document_type_id = dt.id
       JOIN security_levels sl ON dtp.security_level_id = sl.id
       JOIN retention_policies rp ON dtp.retention_policy_id = rp.id
       WHERE dtp.department_id = $1`,
      [departmentId]
    );

    return NextResponse.json({
      department: dept[0],
      teams,
      members,
      policies,
    });
  } catch (err: any) {
    console.error('[ADMIN_GET_DEPARTMENT_BY_ID_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve department details.', details: err.message },
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
  const { id: departmentId } = await params;

  try {
    const body = await req.json();
    const { name, code, parentDepartmentId, status } = body;

    const existing = await query(
      `SELECT id, name, code FROM departments WHERE id = $1 AND organization_id = $2`,
      [departmentId, session.organizationId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const queryParams: any[] = [departmentId, session.organizationId];

    if (name !== undefined) {
      queryParams.push(name.trim());
      setClauses.push(`name = $${queryParams.length}`);
    }
    if (code !== undefined) {
      const cleanCode = code.trim().toUpperCase();
      // Check duplicate
      const dup = await query(
        `SELECT id FROM departments WHERE code = $1 AND organization_id = $2 AND id != $3`,
        [cleanCode, session.organizationId, departmentId]
      );
      if (dup.length > 0) {
        return NextResponse.json(
          { error: `Department code "${cleanCode}" is already taken.` },
          { status: 409 }
        );
      }
      queryParams.push(cleanCode);
      setClauses.push(`code = $${queryParams.length}`);
    }
    if (parentDepartmentId !== undefined) {
      queryParams.push(parentDepartmentId || null);
      setClauses.push(`parent_department_id = $${queryParams.length}`);
    }
    if (status !== undefined) {
      queryParams.push(status);
      setClauses.push(`status = $${queryParams.length}`);
    }

    await query(
      `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
      queryParams
    );

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_DEPARTMENT_UPDATED',
      actorId: session.userId,
      resourceType: 'DEPARTMENT',
      resourceId: departmentId,
      result: 'SUCCESS',
      metadata: {
        departmentId,
        updates: { name, code, parentDepartmentId, status },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Department division updated successfully.',
    });
  } catch (err: any) {
    console.error('[ADMIN_UPDATE_DEPARTMENT_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to update department.', details: err.message },
      { status: 500 }
    );
  }
}
