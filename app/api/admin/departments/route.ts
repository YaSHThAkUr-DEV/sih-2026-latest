import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const departments = await query(
      `SELECT 
         d.id,
         d.name,
         d.code,
         d.status,
         d.parent_department_id,
         pd.name as parent_department_name,
         d.created_at,
         d.updated_at,
         COUNT(DISTINCT u.id) as member_count,
         COUNT(DISTINCT t.id) as team_count,
         COUNT(DISTINCT dtp.id) as policy_count,
         COALESCE(ds.doc_count, 0) as doc_count,
         COALESCE(ds.storage_bytes, 0) as storage_bytes,
         (
           SELECT full_name 
           FROM users 
           WHERE department_id = d.id AND status != 'DISABLED' 
           ORDER BY CASE 
             WHEN designation ILIKE '%Director%' OR designation ILIKE '%Head%' OR designation ILIKE '%Chief%' THEN 1 
             ELSE 2 
           END, created_at ASC 
           LIMIT 1
         ) as head_name,
         (
           SELECT designation 
           FROM users 
           WHERE department_id = d.id AND status != 'DISABLED' 
           ORDER BY CASE 
             WHEN designation ILIKE '%Director%' OR designation ILIKE '%Head%' OR designation ILIKE '%Chief%' THEN 1 
             ELSE 2 
           END, created_at ASC 
           LIMIT 1
         ) as head_title
       FROM departments d
       LEFT JOIN departments pd ON d.parent_department_id = pd.id
       LEFT JOIN users u ON d.id = u.department_id AND u.status != 'DISABLED'
       LEFT JOIN teams t ON d.id = t.department_id AND t.status = 'ACTIVE'
       LEFT JOIN document_type_policies dtp ON d.id = dtp.department_id AND dtp.active = true
       LEFT JOIN (
         SELECT 
           doc.department_id,
           COUNT(DISTINCT doc.id) as doc_count,
           COALESCE(SUM(dv.file_size), 0) as storage_bytes
         FROM documents doc
         LEFT JOIN document_versions dv ON doc.current_version_id = dv.id
         WHERE doc.organization_id = $1 AND doc.status != 'DELETED'
         GROUP BY doc.department_id
       ) ds ON d.id = ds.department_id
       WHERE d.organization_id = $1
       GROUP BY d.id, pd.name, ds.doc_count, ds.storage_bytes
       ORDER BY d.name ASC`,
      [session.organizationId]
    );

    return NextResponse.json({ departments });
  } catch (err: any) {
    console.error('[ADMIN_GET_DEPARTMENTS_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve department directory.', details: err.message },
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
    const { name, code, parentDepartmentId, status = 'ACTIVE' } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Department name and unique code are required.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // Check duplicate code
    const existing = await query(
      `SELECT id FROM departments WHERE code = $1 AND organization_id = $2`,
      [cleanCode, session.organizationId]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Department code "${cleanCode}" is already in use.` },
        { status: 409 }
      );
    }

    const newDept = await query<{ id: string }>(
      `INSERT INTO departments (organization_id, name, code, parent_department_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id;`,
      [session.organizationId, name.trim(), cleanCode, parentDepartmentId || null, status]
    );

    const deptId = newDept[0].id;

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_DEPARTMENT_CREATED',
      actorId: session.userId,
      resourceType: 'DEPARTMENT',
      resourceId: deptId,
      result: 'SUCCESS',
      metadata: {
        departmentId: deptId,
        name,
        code: cleanCode,
        parentDepartmentId,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Department division created.', departmentId: deptId },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[ADMIN_CREATE_DEPARTMENT_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to create department.', details: err.message },
      { status: 500 }
    );
  }
}
