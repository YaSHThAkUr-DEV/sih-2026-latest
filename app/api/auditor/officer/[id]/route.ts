import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch user profile
    const userRows = await query<any>(
      `SELECT u.id, u.full_name, u.employee_code, u.designation, u.email,
              dep.name as department_name, dep.code as department_code,
              sl.code as clearance_tier, sl.name as clearance_tier_name
       FROM users u
       LEFT JOIN departments dep ON u.department_id = dep.id
       LEFT JOIN security_levels sl ON sl.rank = 1
       WHERE u.id = $1;`,
      [id]
    );

    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: 'Officer not found' }, { status: 404 });
    }

    const officer = userRows[0];

    // 2. Aggregate statistics for this officer
    const uploadsRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND event_type LIKE '%UPLOAD%';`,
      [id]
    );
    const unwrapsRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND (event_type LIKE '%DEK%' OR event_type LIKE '%DOWNLOAD%');`,
      [id]
    );
    const approvalsRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND event_type LIKE '%APPROV%';`,
      [id]
    );
    const violationsRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM audit_events WHERE actor_id = $1 AND (result = 'FAILURE' OR event_type LIKE '%FAIL%');`,
      [id]
    );

    // 3. Officer's recent chronological provenance nodes
    const timelineRows = await query<any>(
      `SELECT ae.id, ae.event_type, ae.result, ae.created_at, ae.event_hash,
              d.document_number, d.title as document_title, dv.file_name, dv.file_size
       FROM audit_events ae
       LEFT JOIN documents d ON ae.document_id = d.id
       LEFT JOIN document_versions dv ON ae.document_version_id = dv.id
       WHERE ae.actor_id = $1
       ORDER BY ae.created_at DESC
       LIMIT 6;`,
      [id]
    );

    const timeline = timelineRows.map((r) => ({
      id: r.id,
      timeUtc: new Date(r.created_at).toISOString().substring(11, 16) + ' UTC',
      eventType: r.event_type,
      title: r.document_title || r.event_type.replace(/_/g, ' '),
      target: r.document_number ? `Target: ${r.document_number}` : 'System Session',
      eventHash: r.event_hash,
    }));

    return NextResponse.json({
      success: true,
      officer: {
        id: officer.id,
        name: officer.full_name,
        badge: `${officer.employee_code} // ${officer.department_name || 'Central Operations'}`,
        department: officer.department_name,
        clearance: officer.clearance_tier ? `Active Clearance ${officer.clearance_tier}` : 'Active Clearance Tier-1',
        initials: officer.full_name
          .replace('Insp. ', '')
          .replace('Dr. ', '')
          .replace('DG ', '')
          .split(' ')
          .map((p: string) => p[0])
          .join('')
          .substring(0, 2)
          .toUpperCase(),
        stats: {
          ingestedFiles: parseInt(uploadsRes[0]?.count || '0', 10),
          dekUnwraps: parseInt(unwrapsRes[0]?.count || '0', 10),
          approvalsGiven: parseInt(approvalsRes[0]?.count || '0', 10),
          violations: parseInt(violationsRes[0]?.count || '0', 10),
        },
        timeline,
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch officer dossier:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
