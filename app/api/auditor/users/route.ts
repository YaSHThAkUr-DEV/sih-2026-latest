import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface PersonnelRow {
  id: string;
  full_name: string;
  employee_code: string;
  email: string;
  designation?: string;
  status: string;
  last_login_at?: string;
  department_name?: string;
  department_code?: string;
  total_activity_count?: string;
  authored_documents_count?: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAuditor = session.roles.includes('AUDITOR') || session.roles.includes('SUPER_ADMIN') || session.roles.includes('ORG_ADMIN');
    if (!isAuditor) {
      return NextResponse.json({ error: 'Forbidden: Auditor access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';

    let sql = `
      SELECT 
        u.id,
        u.full_name,
        u.employee_code,
        u.email,
        u.designation,
        u.status,
        u.last_login_at,
        coalesce(dep.name, 'Administration') as department_name,
        coalesce(dep.code, 'ADMIN') as department_code,
        (SELECT count(*) FROM audit_events ae WHERE ae.actor_id = u.id) as total_activity_count,
        (SELECT count(*) FROM documents d WHERE d.created_by = u.id) as authored_documents_count
      FROM users u
      LEFT JOIN departments dep ON u.department_id = dep.id
      WHERE u.organization_id = $1
    `;

    const params: (string | number)[] = [session.organizationId];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (
        u.full_name ILIKE $${params.length} OR 
        u.employee_code ILIKE $${params.length} OR 
        u.email ILIKE $${params.length} OR
        dep.name ILIKE $${params.length}
      )`;
    }

    sql += ` ORDER BY total_activity_count DESC, u.full_name ASC LIMIT 50;`;

    const rows = await query<PersonnelRow>(sql, params);

    return NextResponse.json({
      success: true,
      users: rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        employeeCode: r.employee_code,
        email: r.email,
        designation: r.designation || 'Institutional Officer',
        status: r.status,
        lastLoginAt: r.last_login_at,
        department: r.department_name,
        departmentCode: r.department_code,
        totalActivityCount: parseInt(r.total_activity_count || '0', 10),
        authoredDocumentsCount: parseInt(r.authored_documents_count || '0', 10),
      })),
    });
  } catch (err: unknown) {
    console.error('Failed to list organization users for auditor:', err);
    const message = err instanceof Error ? err.message : 'Failed to list personnel';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
