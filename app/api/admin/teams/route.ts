import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  const url = new URL(req.url);
  const departmentId = url.searchParams.get('department_id')?.trim();

  try {
    let whereClauses = [`d.organization_id = $1`];
    let params: any[] = [session.organizationId];

    if (departmentId) {
      params.push(departmentId);
      whereClauses.push(`t.department_id = $${params.length}`);
    }

    const teams = await query(
      `SELECT 
         t.id,
         t.name,
         t.code,
         t.status,
         t.department_id,
         d.name as department_name,
         d.code as department_code,
         t.created_at,
         COUNT(u.id) as member_count
       FROM teams t
       JOIN departments d ON t.department_id = d.id
       LEFT JOIN users u ON t.id = u.team_id AND u.status != 'DISABLED'
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY t.id, d.name, d.code
       ORDER BY d.name ASC, t.name ASC`,
      params
    );

    return NextResponse.json({ teams });
  } catch (err: any) {
    console.error('[ADMIN_GET_TEAMS_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve investigation teams.', details: err.message },
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
    const { departmentId, name, code, status = 'ACTIVE' } = body;

    if (!departmentId || !name || !code) {
      return NextResponse.json(
        { error: 'Department ID, team name, and team code are required.' },
        { status: 400 }
      );
    }

    // Verify department belongs to this org
    const dept = await query(
      `SELECT id, name FROM departments WHERE id = $1 AND organization_id = $2`,
      [departmentId, session.organizationId]
    );
    if (dept.length === 0) {
      return NextResponse.json({ error: 'Target department does not exist.' }, { status: 404 });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check code uniqueness within department
    const existing = await query(
      `SELECT id FROM teams WHERE department_id = $1 AND code = $2`,
      [departmentId, cleanCode]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Team code "${cleanCode}" already exists in ${dept[0].name}.` },
        { status: 409 }
      );
    }

    const newTeam = await query<{ id: string }>(
      `INSERT INTO teams (department_id, name, code, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id;`,
      [departmentId, name.trim(), cleanCode, status]
    );

    const teamId = newTeam[0].id;

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_TEAM_CREATED',
      actorId: session.userId,
      resourceType: 'TEAM',
      resourceId: teamId,
      result: 'SUCCESS',
      metadata: {
        teamId,
        departmentId,
        name,
        code: cleanCode,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Tactical team formed successfully.', teamId },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[ADMIN_CREATE_TEAM_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to create team.', details: err.message },
      { status: 500 }
    );
  }
}
