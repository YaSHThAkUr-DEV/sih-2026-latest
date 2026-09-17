import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const classification = searchParams.get('classification') || 'all';
    const holdState = searchParams.get('holdState') || 'all-holds';
    const sort = searchParams.get('sort') || 'expiry';

    // 1. Fetch KPI metrics for the ribbon
    const [totalRecordsRes, activeHoldsRes, policiesRes, pendingDisposalsRes] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM retention_records'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM retention_records WHERE legal_hold = true'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM retention_policies'),
      query<{ count: string }>(
        "SELECT COUNT(*) as count FROM deletion_requests WHERE status IN ('REQUESTED', 'PENDING_APPROVAL')"
      ),
    ]);

    const stats = {
      totalRecords: parseInt(totalRecordsRes[0]?.count || '0', 10),
      activeHolds: parseInt(activeHoldsRes[0]?.count || '0', 10),
      totalPolicies: parseInt(policiesRes[0]?.count || '0', 10),
      pendingDisposals: parseInt(pendingDisposalsRes[0]?.count || '0', 10),
    };

    // 2. Query retention records with document and policy joins
    let sql = `
      SELECT 
        r.id as record_id,
        r.document_id,
        d.document_number,
        d.title as document_title,
        d.status as document_status,
        sl.code as security_tier_code,
        sl.name as security_tier_name,
        sl.rank as security_rank,
        p.id as policy_id,
        p.name as policy_name,
        p.schedule_code,
        p.retention_days,
        p.action_on_expiry,
        p.statutory_framework,
        r.retention_start_at,
        r.retention_end_at,
        r.legal_hold,
        r.status as retention_status,
        r.legal_hold_order_number,
        r.legal_hold_authority,
        r.legal_hold_reason,
        r.legal_hold_applied_at,
        u_hold.username as legal_hold_by_username,
        u_hold.designation as legal_hold_by_designation,
        dv.sha256_hash,
        dv.file_size,
        del.id as deletion_request_id,
        del.status as deletion_status,
        del.reason as deletion_reason,
        del.requested_at as deletion_requested_at,
        del.shred_method as deletion_shred_method,
        u_req.username as deletion_requested_by_username,
        u_req.full_name as deletion_requested_by_name,
        u_req.designation as deletion_requested_by_designation,
        del.approved_by as deletion_approved_by
      FROM retention_records r
      JOIN documents d ON d.id = r.document_id
      LEFT JOIN security_levels sl ON sl.id = d.security_level_id
      JOIN retention_policies p ON p.id = r.retention_policy_id
      LEFT JOIN users u_hold ON u_hold.id = r.legal_hold_by
      LEFT JOIN document_versions dv ON dv.id = d.current_version_id
      LEFT JOIN LATERAL (
        SELECT id, status, reason, requested_at, shred_method, requested_by, approved_by
        FROM deletion_requests
        WHERE document_id = d.id
        ORDER BY requested_at DESC
        LIMIT 1
      ) del ON true
      LEFT JOIN users u_req ON u_req.id = del.requested_by
      WHERE 1=1
    `;

    const params: any[] = [];

    // Search filter
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      sql += ` AND (
        LOWER(d.document_number) LIKE $${idx} OR 
        LOWER(d.title) LIKE $${idx} OR 
        LOWER(COALESCE(r.legal_hold_order_number, '')) LIKE $${idx} OR
        LOWER(COALESCE(r.legal_hold_authority, '')) LIKE $${idx}
      )`;
    }

    // Classification filter
    if (classification !== 'all') {
      if (classification === 'fir') {
        sql += ` AND (p.schedule_code = 'SCHEDULE_I' OR d.document_number LIKE '%FIR%')`;
      } else if (classification === 'charge') {
        sql += ` AND (p.schedule_code = 'SCHEDULE_II' OR d.document_number LIKE '%CHG%')`;
      } else if (classification === 'forensics') {
        sql += ` AND (p.schedule_code = 'SCHEDULE_III' OR d.document_number LIKE '%EVD%' OR d.document_number LIKE '%FOR%')`;
      } else if (classification === 'diary') {
        sql += ` AND (p.schedule_code = 'SCHEDULE_IV' OR d.document_number LIKE '%DIARY%' OR d.document_number LIKE '%DOC%')`;
      } else if (classification === 'seizure') {
        sql += ` AND (p.schedule_code = 'SCHEDULE_V' OR d.document_number LIKE '%SZR%')`;
      }
    }

    // Hold State filter
    if (holdState === 'active-only') {
      sql += ` AND r.legal_hold = true`;
    } else if (holdState === 'pending-shred') {
      sql += ` AND (del.status IN ('REQUESTED', 'PENDING_APPROVAL') OR r.status = 'DISPOSAL_STAGED')`;
    } else if (holdState === 'expiring') {
      sql += ` AND r.legal_hold = false AND r.retention_end_at IS NOT NULL AND r.retention_end_at <= (now() + INTERVAL '365 days')`;
    }

    // Sorting
    if (sort === 'expiry') {
      sql += ` ORDER BY r.retention_end_at ASC NULLS LAST`;
    } else if (sort === 'hold') {
      sql += ` ORDER BY r.legal_hold DESC, r.retention_start_at DESC`;
    } else if (sort === 'age') {
      sql += ` ORDER BY r.retention_start_at ASC`;
    } else {
      sql += ` ORDER BY r.retention_end_at ASC NULLS LAST`;
    }

    const rows = await query<any>(sql, params);

    const records = rows.map((r) => {
      const startMs = new Date(r.retention_start_at).getTime();
      const endMs = r.retention_end_at ? new Date(r.retention_end_at).getTime() : startMs + 10950 * 86400000;
      const nowMs = Date.now();
      const totalDuration = Math.max(endMs - startMs, 86400000);
      const elapsedDuration = Math.max(nowMs - startMs, 0);
      const elapsedPercent = Math.min(Math.round((elapsedDuration / totalDuration) * 100), 100);
      const daysElapsed = Math.round(elapsedDuration / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(Math.round((endMs - nowMs) / (1000 * 60 * 60 * 24)), 0);

      // Determine synthesized status
      let displayStatus = r.legal_hold ? 'FROZEN' : r.deletion_status === 'PENDING_APPROVAL' ? 'DISPOSAL_STAGED' : 'STANDARD';
      if (!r.legal_hold && daysRemaining === 0) {
        displayStatus = 'EXPIRED';
      }

      return {
        recordId: r.record_id,
        documentId: r.document_id,
        documentNumber: r.document_number,
        documentTitle: r.document_title,
        documentStatus: r.document_status,
        securityTier: r.security_tier_code || 'T3',
        securityTierName: r.security_tier_name || 'Confidential',
        policyId: r.policy_id,
        policyName: r.policy_name,
        scheduleCode: r.schedule_code,
        retentionDays: r.retention_days,
        retentionYears: r.retention_days ? Math.round(r.retention_days / 365) : 0,
        actionOnExpiry: r.action_on_expiry,
        statutoryFramework: r.statutory_framework,
        retentionStartAt: r.retention_start_at,
        retentionEndAt: r.retention_end_at,
        daysElapsed,
        daysRemaining,
        elapsedPercent,
        isLegalHold: r.legal_hold,
        displayStatus,
        legalHoldOrderNumber: r.legal_hold_order_number,
        legalHoldAuthority: r.legal_hold_authority,
        legalHoldReason: r.legal_hold_reason,
        legalHoldAppliedAt: r.legal_hold_applied_at,
        legalHoldBy: r.legal_hold_by_username,
        legalHoldByDesignation: r.legal_hold_by_designation,
        sha256Hash: r.sha256_hash || '7d4a82e99812afc098',
        fileSize: r.file_size || 4820000,
        deletionRequest: r.deletion_request_id
          ? {
              id: r.deletion_request_id,
              status: r.deletion_status,
              reason: r.deletion_reason,
              requestedAt: r.deletion_requested_at,
              shredMethod: r.deletion_shred_method,
              requestedBy: {
                username: r.deletion_requested_by_username,
                fullName: r.deletion_requested_by_name || 'Dealing Officer',
                designation: r.deletion_requested_by_designation || 'Executive Dealing Officer (GOV-OFF-042)',
              },
              isApproved: !!r.deletion_approved_by,
            }
          : null,
      };
    });

    return NextResponse.json({
      stats,
      records,
    });
  } catch (error: any) {
    console.error('Error fetching retention records:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
