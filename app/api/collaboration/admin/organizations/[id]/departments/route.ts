import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
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
    const body = await req.json();
    const { name, code, parentDepartmentId } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Department name and code are required' }, { status: 400 });
    }

    const deptCode = code.trim().toUpperCase();
    const deptName = name.trim();

    // Check duplicate code in org
    const existing = await query(
      `SELECT id FROM departments WHERE organization_id = $1 AND UPPER(code) = $2`,
      [orgId, deptCode]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Department with code "${deptCode}" already exists in this organization` },
        { status: 409 }
      );
    }

    const insertRes = await query(
      `
      INSERT INTO departments (organization_id, name, code, parent_department_id, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING id, name, code, status, created_at;
      `,
      [orgId, deptName, deptCode, parentDepartmentId || null]
    );

    await logAuditEvent({
      organizationId: orgId,
      eventType: 'DEPARTMENT_CREATED',
      actorId: session.userId,
      resourceType: 'DEPARTMENT',
      resourceId: insertRes[0].id,
      result: 'SUCCESS',
      metadata: { departmentName: deptName, departmentCode: deptCode },
    });

    return NextResponse.json({
      success: true,
      message: `Department "${deptName}" (${deptCode}) created successfully`,
      department: insertRes[0],
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ADMIN_CREATE_DEPT_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create department', details: error.message },
      { status: 500 }
    );
  }
}
