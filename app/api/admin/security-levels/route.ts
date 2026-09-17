import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const securityLevels = await query(
      `SELECT 
         sl.id,
         sl.name,
         sl.code,
         sl.rank,
         sl.description,
         sl.approval_required,
         sl.encryption_required,
         sl.audit_level,
         COUNT(d.id) as document_count
       FROM security_levels sl
       LEFT JOIN documents d ON sl.id = d.security_level_id AND d.status != 'DELETED'
       WHERE sl.organization_id = $1
       GROUP BY sl.id
       ORDER BY sl.rank ASC`,
      [session.organizationId]
    );

    return NextResponse.json({ securityLevels });
  } catch (err: any) {
    console.error('[ADMIN_GET_SECURITY_LEVELS_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve classification tiers.', details: err.message },
      { status: 500 }
    );
  }
}
