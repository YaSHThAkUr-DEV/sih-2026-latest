import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  designation?: string;
  status: string;
  created_at: string;
  last_login_at?: string;
  organization_id: string;
  department_name?: string;
  department_code?: string;
  roles_list?: string[];
  role_codes?: string[];
}

interface AuditEventRow {
  id: string;
  event_type: string;
  result: string;
  ip_address?: string;
  user_agent?: string;
  failure_reason?: string;
  event_metadata?: Record<string, unknown>;
  event_hash: string;
  created_at: string;
  document_id?: string;
  document_number?: string;
  document_title?: string;
  file_name?: string;
  file_size?: number;
}

interface UserDocRow {
  id: string;
  document_number: string;
  title: string;
  status: string;
  created_at: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
    }

    const isAuditor = session.roles.includes('AUDITOR') || session.roles.includes('SUPER_ADMIN') || session.roles.includes('ORG_ADMIN');
    if (!isAuditor) {
      return NextResponse.json({ error: 'Forbidden: Auditor clearance required' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const eventType = searchParams.get('eventType') || 'all';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const search = searchParams.get('search')?.trim() || '';

    // 1. Fetch User Identity and Organization Isolation
    const userRows = await query<UserRow>(
      `SELECT 
         u.id, u.full_name, u.email, u.employee_code, u.designation,
         u.status, u.created_at, u.last_login_at,
         u.organization_id,
         dep.name as department_name, dep.code as department_code,
         array_agg(r.name) FILTER (WHERE r.name IS NOT NULL) as roles_list,
         array_agg(r.code) FILTER (WHERE r.code IS NOT NULL) as role_codes
       FROM users u
       LEFT JOIN departments dep ON u.department_id = dep.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1 AND u.organization_id = $2
       GROUP BY u.id, dep.name, dep.code;`,
      [id, session.organizationId]
    );

    if (!userRows || userRows.length === 0) {
      return NextResponse.json(
        { error: 'Personnel profile not found or does not belong to your organization.' },
        { status: 404 }
      );
    }

    const user = userRows[0];

    // 2. Aggregate Lifetime Action Metrics for this User
    const [
      totalRes,
      uploadsRes,
      downloadsRes,
      approvalsRes,
      rejectionsRes,
      loginsRes,
      violationsRes,
    ] = await Promise.all([
      query<{ count: string }>(
        `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND organization_id = $2;`,
        [id, session.organizationId]
      ),
      query<{ count: string }>(
        `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND organization_id = $2 AND event_type LIKE '%UPLOAD%';`,
        [id, session.organizationId]
      ),
      query<{ count: string }>(
        `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND organization_id = $2 AND (event_type LIKE '%DEK%' OR event_type LIKE '%DOWNLOAD%' OR event_type LIKE '%READ%');`,
        [id, session.organizationId]
      ),
      query<{ count: string }>(
        `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND organization_id = $2 AND event_type LIKE '%APPROV%';`,
        [id, session.organizationId]
      ),
      query<{ count: string }>(
        `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND organization_id = $2 AND event_type LIKE '%REJECT%';`,
        [id, session.organizationId]
      ),
      query<{ count: string }>(
        `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND organization_id = $2 AND event_type LIKE '%LOGIN%';`,
        [id, session.organizationId]
      ),
      query<{ count: string }>(
        `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND organization_id = $2 AND (result = 'FAILURE' OR result = 'DENIED' OR event_type LIKE '%FAIL%');`,
        [id, session.organizationId]
      ),
    ]);

    // 3. Query Detailed Paginated Activity Ledger with Filters
    const filterClauses: string[] = [`ae.actor_id = $1`, `ae.organization_id = $2`];
    const queryParams: (string | number)[] = [id, session.organizationId];

    if (eventType !== 'all') {
      queryParams.push(`%${eventType}%`);
      filterClauses.push(`ae.event_type ILIKE $${queryParams.length}`);
    }

    if (startDate) {
      queryParams.push(startDate);
      filterClauses.push(`ae.created_at >= $${queryParams.length}`);
    }

    if (endDate) {
      queryParams.push(endDate);
      filterClauses.push(`ae.created_at <= $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      filterClauses.push(
        `(ae.event_type ILIKE $${pIdx} OR d.title ILIKE $${pIdx} OR d.document_number ILIKE $${pIdx} OR ae.event_hash ILIKE $${pIdx} OR ae.ip_address ILIKE $${pIdx})`
      );
    }

    const whereSql = filterClauses.join(' AND ');

    // Total filtered count
    const countRes = await query<{ count: string }>(
      `SELECT count(*) as count 
       FROM audit_events ae
       LEFT JOIN documents d ON ae.document_id = d.id
       WHERE ${whereSql};`,
      queryParams
    );
    const filteredTotal = parseInt(countRes[0]?.count || '0', 10);

    // Paginated events
    const eventParams = [...queryParams, limit, offset];
    const eventsRows = await query<AuditEventRow>(
      `SELECT 
         ae.id,
         ae.event_type,
         ae.result,
         ae.ip_address,
         ae.user_agent,
         ae.failure_reason,
         ae.event_metadata,
         ae.event_hash,
         ae.created_at,
         d.id as document_id,
         d.document_number,
         d.title as document_title,
         dv.file_name,
         dv.file_size
       FROM audit_events ae
       LEFT JOIN documents d ON ae.document_id = d.id
       LEFT JOIN document_versions dv ON ae.document_version_id = dv.id
       WHERE ${whereSql}
       ORDER BY ae.created_at DESC
       LIMIT $${eventParams.length - 1} OFFSET $${eventParams.length};`,
      eventParams
    );

    // 4. Documents Authored / Managed by this User
    const docRows = await query<UserDocRow>(
      `SELECT id, document_number, title, status, created_at
       FROM documents 
       WHERE created_by = $1 AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT 5;`,
      [id, session.organizationId]
    );

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        employeeCode: user.employee_code,
        designation: user.designation || 'Institutional Officer',
        department: user.department_name || 'Central Administration',
        departmentCode: user.department_code || 'ADMIN',
        status: user.status,
        roles: user.roles_list || ['OFFICER'],
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
      stats: {
        totalEvents: parseInt(totalRes[0]?.count || '0', 10),
        uploadsCount: parseInt(uploadsRes[0]?.count || '0', 10),
        downloadsCount: parseInt(downloadsRes[0]?.count || '0', 10),
        approvalsCount: parseInt(approvalsRes[0]?.count || '0', 10),
        rejectionsCount: parseInt(rejectionsRes[0]?.count || '0', 10),
        loginsCount: parseInt(loginsRes[0]?.count || '0', 10),
        violationsCount: parseInt(violationsRes[0]?.count || '0', 10),
      },
      recentDocuments: docRows,
      pagination: {
        page,
        limit,
        totalRecords: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit) || 1,
      },
      events: eventsRows.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        result: e.result,
        ipAddress: e.ip_address || '127.0.0.1',
        userAgent: e.user_agent,
        failureReason: e.failure_reason,
        metadata: e.event_metadata,
        eventHash: e.event_hash,
        createdAt: e.created_at,
        timeUtc: new Date(e.created_at).toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        documentId: e.document_id,
        documentNumber: e.document_number,
        documentTitle: e.document_title,
        fileName: e.file_name,
        fileSize: e.file_size,
      })),
    });
  } catch (err: unknown) {
    console.error('Failed to get user activity profile:', err);
    const message = err instanceof Error ? err.message : 'Failed to retrieve user activity profile.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
