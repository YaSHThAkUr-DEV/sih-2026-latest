import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { isSuperAdmin, getMaxSecurityLevel } from '@/lib/auth/rbac';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const tier = (searchParams.get('tier') || 'ALL').trim().toUpperCase();
    const docType = (searchParams.get('docType') || 'ALL').trim().toUpperCase();
    const dept = (searchParams.get('dept') || 'ALL').trim().toUpperCase();

    const userMaxLevel = isSuperAdmin(session) ? 5 : (session.maxSecurityLevel ?? 3);

    const conditions: string[] = [
      'd.organization_id = $1',
      "d.status != 'DELETED'",
      'sl.rank <= $2',
    ];
    const params: any[] = [session.organizationId, userMaxLevel];
    let paramIndex = 3;

    let hasQuery = q.length > 0;

    if (hasQuery) {
      params.push(q);
      const qIdx = `$${paramIndex++}`;
      conditions.push(`(
        (ocr.search_vector IS NOT NULL AND (
          ocr.search_vector @@ plainto_tsquery('english', ${qIdx})
          OR ocr.search_vector @@ plainto_tsquery('simple', ${qIdx})
        ))
        OR (ocr.extracted_text IS NOT NULL AND ocr.extracted_text ILIKE ('%' || ${qIdx} || '%'))
        OR d.title ILIKE ('%' || ${qIdx} || '%')
        OR dv.file_name ILIKE ('%' || ${qIdx} || '%')
        OR d.document_number ILIKE ('%' || ${qIdx} || '%')
        OR (d.description IS NOT NULL AND d.description ILIKE ('%' || ${qIdx} || '%'))
        OR u.full_name ILIKE ('%' || ${qIdx} || '%')
      )`);
    }

    if (tier !== 'ALL') {
      params.push(tier);
      conditions.push(`sl.code = $${paramIndex++}`);
    }

    if (docType !== 'ALL') {
      params.push(docType);
      conditions.push(`dt.code = $${paramIndex++}`);
    }

    if (dept !== 'ALL') {
      params.push(dept);
      conditions.push(`(dep.code = $${paramIndex} OR dep.name ILIKE ('%' || $${paramIndex} || '%'))`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const headlineSelect = hasQuery
      ? `ts_headline('english', coalesce(ocr.extracted_text, d.description, d.title), 
          plainto_tsquery('english', $3), 
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
        ) as matched_snippet,
        ts_rank(coalesce(ocr.search_vector, to_tsvector('english', '')), plainto_tsquery('english', $3)) as rank_score,`
      : `coalesce(d.description, 'Case record registered in secure document vault.') as matched_snippet,
        0 as rank_score,`;

    const orderBy = hasQuery
      ? `ORDER BY rank_score DESC, d.created_at DESC`
      : `ORDER BY d.created_at DESC`;

    const sql = `
      SELECT 
        d.id,
        d.document_number,
        d.title,
        d.description,
        d.created_at,
        dv.id as version_id,
        dv.version_number,
        dv.file_name,
        dv.file_size,
        dv.sha256_hash,
        dv.encryption_algorithm,
        dv.checksum_verified,
        dt.name as document_type_name,
        dt.code as document_type_code,
        sl.code as security_tier,
        sl.name as security_tier_name,
        u.full_name as owner_name,
        dep.name as department_name,
        dep.code as department_code,
        ocr.confidence as ocr_confidence,
        ocr.language as ocr_language,
        ocr.text_sha256 as ocr_text_sha256,
        CASE WHEN ocr.extracted_text IS NOT NULL THEN true ELSE false END as has_ocr_text,
        ${headlineSelect}
        length(coalesce(ocr.extracted_text, '')) as ocr_char_count
      FROM documents d
      JOIN document_versions dv ON d.id = dv.document_id
      JOIN document_types dt ON d.document_type_id = dt.id
      JOIN security_levels sl ON d.security_level_id = sl.id
      JOIN users u ON d.created_by = u.id
      JOIN departments dep ON d.department_id = dep.id
      LEFT JOIN ocr_results ocr ON dv.id = ocr.document_version_id
      ${whereClause}
      ${orderBy}
      LIMIT 30;
    `;

    const results = await query<any>(sql, params);

    return NextResponse.json({
      success: true,
      query: q,
      totalMatches: results.length,
      results: results.map((r) => ({
        id: r.id,
        versionId: r.version_id,
        documentNumber: r.document_number,
        title: r.title,
        description: r.description,
        fileName: r.file_name,
        fileSize: Number(r.file_size || 0),
        sha256Hash: r.sha256_hash,
        documentTypeCode: r.document_type_code,
        documentTypeName: r.document_type_name,
        securityTier: r.security_tier,
        securityTierName: r.security_tier_name,
        ownerName: r.owner_name,
        departmentName: r.department_name,
        hasOcrText: r.has_ocr_text,
        ocrConfidence: r.ocr_confidence ? parseFloat(r.ocr_confidence) : null,
        ocrCharCount: Number(r.ocr_char_count || 0),
        ocrTextSha256: r.ocr_text_sha256,
        matchedSnippet: r.matched_snippet,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    console.error('[SEARCH_API_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Search execution failed' }, { status: 500 });
  }
}
