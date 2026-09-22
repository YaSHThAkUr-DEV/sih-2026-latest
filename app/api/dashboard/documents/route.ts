import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { isSuperAdmin, getMaxSecurityLevel } from '@/lib/auth/rbac';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type') || 'ALL';
    const tierFilter = searchParams.get('tier') || 'ALL';
    const deptFilter = searchParams.get('dept') || 'ALL';
    const searchQuery = (searchParams.get('search') || '').trim();

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const userMaxLevel = isSuperAdmin(session) ? 5 : (session.maxSecurityLevel ?? 3);

    // Build WHERE clauses
    const whereConditions: string[] = [
      `d.organization_id = $1`,
      `d.status != 'DELETED'`,
      `sl.rank <= $2`, // Enforce security clearance
    ];
    const params: any[] = [session.organizationId, userMaxLevel];

    if (typeFilter && typeFilter !== 'ALL') {
      params.push(typeFilter);
      whereConditions.push(`dt.code = $${params.length}`);
    }

    if (tierFilter && tierFilter !== 'ALL') {
      params.push(tierFilter);
      whereConditions.push(`sl.code = $${params.length}`);
    }

    if (deptFilter && deptFilter !== 'ALL') {
      params.push(deptFilter);
      whereConditions.push(`dep.code = $${params.length}`);
    }

    if (searchQuery) {
      params.push(`%${searchQuery}%`);
      whereConditions.push(
        `(d.document_number ILIKE $${params.length} OR d.title ILIKE $${params.length} OR d.description ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR dep.name ILIKE $${params.length} OR ocr.extracted_text ILIKE $${params.length})`
      );
    }

    const whereSql = whereConditions.join(' AND ');

    // 1. Get total count
    const countSql = `
      SELECT COUNT(DISTINCT d.id) as count
      FROM documents d
      JOIN document_types dt ON d.document_type_id = dt.id
      JOIN security_levels sl ON d.security_level_id = sl.id
      JOIN departments dep ON d.department_id = dep.id
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_versions dv ON d.current_version_id = dv.id
      LEFT JOIN ocr_results ocr ON dv.id = ocr.document_version_id
      WHERE ${whereSql}
    `;

    const countRes = await query<{ count: string }>(countSql, params);
    const totalCount = parseInt(countRes[0]?.count || '0', 10);
    const totalPages = Math.ceil(totalCount / limit);

    // 2. Fetch paginated documents
    const docParams = [...params, limit, offset];
    const limitPlaceholder = `$${docParams.length - 1}`;
    const offsetPlaceholder = `$${docParams.length}`;

    const dataSql = `
      SELECT DISTINCT
        d.id,
        d.document_number,
        d.title,
        d.description,
        d.status,
        d.created_at,
        dt.name as document_type_name,
        dt.code as document_type_code,
        sl.code as security_tier,
        sl.name as security_tier_name,
        sl.rank as security_rank,
        dep.name as department_name,
        dep.code as department_code,
        u.full_name as owner_name,
        u.designation as owner_designation,
        dv.version_number,
        dv.file_name,
        dv.file_size,
        dv.sha256_hash,
        dv.encryption_algorithm,
        dv.checksum_verified,
        rr.id as retention_record_id,
        rp.id as retention_policy_id,
        rp.name as retention_policy_name,
        rp.schedule_code as retention_schedule_code,
        COALESCE(rr.legal_hold, false) as is_legal_hold,
        rr.retention_end_at
      FROM documents d
      JOIN document_types dt ON d.document_type_id = dt.id
      JOIN security_levels sl ON d.security_level_id = sl.id
      JOIN departments dep ON d.department_id = dep.id
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_versions dv ON d.current_version_id = dv.id
      LEFT JOIN ocr_results ocr ON dv.id = ocr.document_version_id
      LEFT JOIN retention_records rr ON d.id = rr.document_id
      LEFT JOIN retention_policies rp ON rr.retention_policy_id = rp.id
      WHERE ${whereSql}
      ORDER BY d.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const documents = await query(dataSql, docParams);

    return NextResponse.json({
      success: true,
      documents,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      userClearance: {
        maxSecurityLevel: userMaxLevel,
        isSuperAdmin: isSuperAdmin(session),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch dashboard documents:', error);
    return NextResponse.json(
      { error: 'Internal Server Error while retrieving documents', details: error.message },
      { status: 500 }
    );
  }
}
