import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || 'all';
    const eventType = searchParams.get('eventType') || 'all';
    const riskLevel = searchParams.get('riskLevel') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15', 10)));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        ae.id,
        ae.event_type,
        ae.result,
        ae.ip_address,
        ae.created_at,
        ae.event_hash,
        ae.event_metadata,
        u.id as actor_id,
        coalesce(u.full_name, 'System Central') as actor_name,
        coalesce(u.employee_code, 'SYS-ROOT') as actor_badge,
        coalesce(u.designation, 'Automated Daemon') as actor_designation,
        coalesce(dep.name, 'HQ Operations') as department_name,
        coalesce(dep.code, 'HQ') as department_code,
        d.id as document_id,
        d.document_number,
        d.title as document_title,
        dv.file_name,
        dv.file_size
      FROM audit_events ae
      LEFT JOIN users u ON ae.actor_id = u.id
      LEFT JOIN departments dep ON u.department_id = dep.id
      LEFT JOIN documents d ON ae.document_id = d.id
      LEFT JOIN document_versions dv ON ae.document_version_id = dv.id
      WHERE ae.organization_id = $1
    `;

    const params: any[] = [session.organizationId];

    // Department Filter
    if (department && department !== 'all') {
      params.push(`%${department}%`);
      sql += ` AND (dep.code ILIKE $${params.length} OR dep.name ILIKE $${params.length})`;
    }

    // Event Type Filter
    if (eventType && eventType !== 'all') {
      params.push(`%${eventType}%`);
      sql += ` AND ae.event_type ILIKE $${params.length}`;
    }

    // Risk Filter
    if (riskLevel === 'FLAGGED') {
      sql += ` AND (ae.result = 'FAILURE' OR ae.event_type LIKE '%FAIL%' OR ae.event_type LIKE '%REJECT%')`;
    } else if (riskLevel === 'MEDIUM') {
      sql += ` AND (ae.event_type LIKE '%DEK%' OR ae.event_type LIKE '%DOWNLOAD%' OR ae.event_type LIKE '%VERIFY%')`;
    } else if (riskLevel === 'LOW') {
      sql += ` AND (ae.result = 'SUCCESS' AND ae.event_type NOT LIKE '%FAIL%')`;
    }

    // Search Query (Actor, Badge, Docket, IP, Hash)
    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      sql += ` AND (
        u.full_name ILIKE $${pIdx} OR
        u.employee_code ILIKE $${pIdx} OR
        d.document_number ILIKE $${pIdx} OR
        d.title ILIKE $${pIdx} OR
        ae.ip_address ILIKE $${pIdx} OR
        ae.event_hash ILIKE $${pIdx} OR
        ae.event_type ILIKE $${pIdx}
      )`;
    }

    // Total Count Query
    const countSql = `SELECT count(*) as total FROM (${sql}) sub`;
    const countRes = await query<{ total: string }>(countSql, params);
    const totalRecords = parseInt(countRes[0]?.total || '0', 10);

    // Paginated Order Query
    sql += ` ORDER BY ae.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const rows = await query<any>(sql, params);

    // Format events for Stitch UI specification
    const events = rows.map((r) => {
      // Determine normalized event class
      let eventClass = r.event_type;
      if (r.event_type.includes('UPLOAD')) eventClass = 'FILE_UPLOAD';
      else if (r.event_type.includes('DOWNLOAD') || r.event_type.includes('DEK') || r.event_type.includes('KEY')) eventClass = 'DEK_UNWRAP_STREAM';
      else if (r.event_type.includes('VERSION') || r.event_type.includes('PROMOT')) eventClass = 'VERSION_PROMOTION';
      else if (r.event_type.includes('CERT')) eventClass = 'SECTION_65B_CERT';
      else if (r.result === 'FAILURE' || r.event_type.includes('FAIL')) eventClass = 'FAILED_AUTH';

      return {
        id: r.id,
        createdAt: r.created_at,
        timeUtc: new Date(r.created_at).toISOString().substring(11, 19) + ' UTC',
        actor: {
          id: r.actor_id,
          name: r.actor_name,
          badge: r.actor_badge,
          designation: r.actor_designation,
          department: r.department_name,
          departmentCode: r.department_code,
          initials: r.actor_name
            .replace('Insp. ', '')
            .replace('Dr. ', '')
            .replace('DG ', '')
            .split(' ')
            .map((p: string) => p[0])
            .join('')
            .substring(0, 2)
            .toUpperCase(),
        },
        eventClass,
        eventType: r.event_type,
        targetDocket: r.document_number || 'SYSTEM_CORE',
        targetTitle: r.document_title || r.file_name || 'Central Service Bus Event',
        targetFile: r.file_name || 'System Metadata',
        ipAddress: r.ip_address || '127.0.0.1',
        node: 'TLS 1.3 // SEC-GW-01',
        result: r.result || 'SUCCESS',
        isFlagged: r.result === 'FAILURE' || eventClass === 'FAILED_AUTH',
        eventHash: r.event_hash || 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        metadata: r.event_metadata || {},
      };
    });

    return NextResponse.json({
      success: true,
      totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit) || 1,
      events,
    });
  } catch (error: any) {
    console.error('Failed to fetch auditor timeline:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
