import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { isAdmin, isSuperAdmin } from '@/lib/auth/rbac';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const sort = searchParams.get('sort') || 'newest';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const scope = searchParams.get('scope') || 'user';

    // Scoping: default to user's notifications + system broadcasts. Admins can view org-wide with scope=org.
    const isOrgScope = scope === 'org' && (isAdmin(session) || isSuperAdmin(session));
    const userScopeClause = isOrgScope
      ? '(user_id IS NULL OR user_id IN (SELECT id FROM users WHERE organization_id = $1))'
      : '(user_id = $1 OR user_id IS NULL)';
    const scopeParams = isOrgScope ? [session.organizationId] : [session.userId];

    // 1. Fetch KPI metrics for ribbon & category counts
    const [allCount, unreadCount, approvalCount, holdCount, ocrCount, securityCount, retentionCount] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*) as count FROM notifications WHERE ${userScopeClause}`, scopeParams),
      query<{ count: string }>(`SELECT COUNT(*) as count FROM notifications WHERE ${userScopeClause} AND read_at IS NULL`, scopeParams),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications WHERE ${userScopeClause} AND (type = 'APPROVAL_REQUEST' OR metadata->>'category' = 'dual-custody')`,
        scopeParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications WHERE ${userScopeClause} AND (type = 'LEGAL_HOLD' OR metadata->>'category' = 'legal-holds')`,
        scopeParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications WHERE ${userScopeClause} AND (type = 'OCR_COMPLETE' OR metadata->>'category' = 'ocr-pipeline')`,
        scopeParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications WHERE ${userScopeClause} AND (type = 'SECURITY_ALERT' OR type = 'AUDIT_ATTESTATION' OR type = 'BLOCKCHAIN_ANCHOR' OR metadata->>'category' = 'security')`,
        scopeParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications WHERE ${userScopeClause} AND (type = 'RETENTION_EXPIRY' OR metadata->>'category' = 'retention')`,
        scopeParams
      ),
    ]);

    const stats = {
      total: parseInt(allCount[0]?.count || '0', 10),
      unreadNotices: parseInt(unreadCount[0]?.count || '0', 10),
      pendingApprovals: parseInt(approvalCount[0]?.count || '0', 10),
      legalHolds: parseInt(holdCount[0]?.count || '0', 10),
      ocrCompleted: parseInt(ocrCount[0]?.count || '0', 10),
      categoryCounts: {
        all: parseInt(allCount[0]?.count || '0', 10),
        'dual-custody': parseInt(approvalCount[0]?.count || '0', 10),
        'legal-holds': parseInt(holdCount[0]?.count || '0', 10),
        'ocr-pipeline': parseInt(ocrCount[0]?.count || '0', 10),
        security: parseInt(securityCount[0]?.count || '0', 10),
        retention: parseInt(retentionCount[0]?.count || '0', 10),
      },
    };

    // 2. Build filtered query
    let sql = `
      SELECT 
        id,
        user_id,
        type,
        title,
        message,
        resource_type,
        resource_id,
        severity,
        read_at,
        metadata,
        created_at
      FROM notifications
      WHERE ${userScopeClause}
    `;
    const params: any[] = [...scopeParams];

    if (unreadOnly) {
      sql += ' AND read_at IS NULL';
    }

    if (category !== 'all') {
      if (category === 'dual-custody') {
        sql += " AND (type = 'APPROVAL_REQUEST' OR metadata->>'category' = 'dual-custody')";
      } else if (category === 'legal-holds') {
        sql += " AND (type = 'LEGAL_HOLD' OR metadata->>'category' = 'legal-holds')";
      } else if (category === 'ocr-pipeline') {
        sql += " AND (type = 'OCR_COMPLETE' OR metadata->>'category' = 'ocr-pipeline')";
      } else if (category === 'security') {
        sql += " AND (type = 'SECURITY_ALERT' OR type = 'AUDIT_ATTESTATION' OR type = 'BLOCKCHAIN_ANCHOR' OR metadata->>'category' = 'security')";
      } else if (category === 'retention') {
        sql += " AND (type = 'RETENTION_EXPIRY' OR metadata->>'category' = 'retention')";
      }
    }

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      sql += ` AND (
        LOWER(title) LIKE $${pIdx} OR 
        LOWER(message) LIKE $${pIdx} OR 
        LOWER(COALESCE(metadata->>'docketNumber', '')) LIKE $${pIdx} OR
        LOWER(COALESCE(metadata->>'initiatingCustodian', '')) LIKE $${pIdx}
      )`;
    }

    if (sort === 'oldest') {
      sql += ' ORDER BY created_at ASC';
    } else if (sort === 'critical') {
      sql += ` ORDER BY 
        CASE 
          WHEN severity = 'CRITICAL' THEN 1 
          WHEN severity = 'WARNING' THEN 2 
          WHEN severity = 'SUCCESS' THEN 3 
          ELSE 4 
        END ASC, created_at DESC`;
    } else {
      sql += ' ORDER BY created_at DESC';
    }

    const rows = await query<any>(sql, params);

    const notifications = rows.map((r) => {
      const isUnread = r.read_at === null;
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {};

      return {
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        severity: r.severity || 'INFO',
        isUnread,
        readAt: r.read_at,
        createdAt: r.created_at,
        metadata: meta,
      };
    });

    return NextResponse.json({
      stats,
      notifications,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
