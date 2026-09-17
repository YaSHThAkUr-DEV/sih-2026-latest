import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('dms_session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }

    const statusParam = req.nextUrl.searchParams.get('status') || 'PENDING';

    // 2. Query Change Requests with Dual-Custody Metadata
    let statusFilter = "cr.status = 'PENDING'";
    if (statusParam === 'COMPLETED') {
      statusFilter = "cr.status IN ('APPROVED', 'REJECTED')";
    } else if (statusParam === 'ALL') {
      statusFilter = '1=1';
    }

    const sql = `
      SELECT 
        cr.id as request_id,
        cr.reason,
        cr.status as request_status,
        cr.created_at,
        cr.decided_at,
        d.id as document_id,
        d.document_number,
        d.title as document_title,
        d.organization_id,
        dept.name as department_name,
        dept.code as department_code,
        sec.code as security_tier,
        sec.name as security_tier_name,
        sec.rank as security_rank,
        dt.name as document_type_name,
        dt.code as document_type_code,
        req_u.id as requester_id,
        req_u.full_name as requester_name,
        req_u.designation as requester_designation,
        app_u.id as assigned_approver_id,
        app_u.full_name as assigned_approver_name,
        app_u.designation as assigned_approver_designation,
        orig_v.id as original_version_id,
        orig_v.version_number as original_version_number,
        orig_v.file_name as original_file_name,
        orig_v.file_size as original_file_size,
        orig_v.sha256_hash as original_sha256,
        prop_v.id as proposed_version_id,
        prop_v.version_number as proposed_version_number,
        prop_v.file_name as proposed_file_name,
        prop_v.file_size as proposed_file_size,
        prop_v.sha256_hash as proposed_sha256,
        act.decision as last_decision,
        act.comment as decision_comment,
        act.created_at as decision_timestamp
      FROM change_requests cr
      JOIN documents d ON cr.document_id = d.id
      LEFT JOIN departments dept ON d.department_id = dept.id
      LEFT JOIN security_levels sec ON d.security_level_id = sec.id
      LEFT JOIN document_types dt ON d.document_type_id = dt.id
      JOIN users req_u ON cr.requested_by = req_u.id
      LEFT JOIN users app_u ON cr.assigned_approver_id = app_u.id
      LEFT JOIN document_versions orig_v ON cr.original_version_id = orig_v.id
      JOIN document_versions prop_v ON cr.proposed_version_id = prop_v.id
      LEFT JOIN approval_actions act ON act.change_request_id = cr.id
      WHERE d.organization_id = $1 AND ${statusFilter}
      ORDER BY cr.created_at DESC;
    `;

    const rows = await query<any>(sql, [session.organizationId]);

    // Format output with canApprove flag for the logged-in officer
    const requests = rows.map((r) => {
      const isRequester = r.requester_id === session.userId;
      // An officer can approve if they are NOT the requester, AND they are either the assigned approver, or a DEPT_HEAD / SUPER_ADMIN
      const isAssigned = r.assigned_approver_id === session.userId;
      const hasPrivilege =
        session.roles.includes('SUPER_ADMIN') ||
        session.roles.includes('DEPT_HEAD') ||
        session.roles.includes('ORG_ADMIN');
      const canApprove = !isRequester && (isAssigned || hasPrivilege) && r.request_status === 'PENDING';

      return {
        id: r.request_id,
        reason: r.reason,
        status: r.request_status,
        createdAt: r.created_at,
        decidedAt: r.decided_at,
        document: {
          id: r.document_id,
          documentNumber: r.document_number,
          title: r.document_title,
          department: r.department_name,
          departmentCode: r.department_code,
          securityTier: r.security_tier,
          securityTierName: r.security_tier_name,
          type: r.document_type_name,
        },
        requester: {
          id: r.requester_id,
          name: r.requester_name,
          designation: r.requester_designation,
          isCurrentOfficer: isRequester,
        },
        assignedApprover: {
          id: r.assigned_approver_id,
          name: r.assigned_approver_name,
          designation: r.assigned_approver_designation,
        },
        originalVersion: {
          id: r.original_version_id,
          versionNumber: r.original_version_number,
          fileName: r.original_file_name,
          fileSize: Number(r.original_file_size),
          sha256: r.original_sha256,
        },
        proposedVersion: {
          id: r.proposed_version_id,
          versionNumber: r.proposed_version_number,
          fileName: r.proposed_file_name,
          fileSize: Number(r.proposed_file_size),
          sha256: r.proposed_sha256,
        },
        lastDecision: r.last_decision
          ? {
              decision: r.last_decision,
              comment: r.decision_comment,
              timestamp: r.decision_timestamp,
            }
          : null,
        canApprove,
        selfApprovalBlocked: isRequester,
      };
    });

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err: any) {
    console.error('[APPROVALS_PENDING_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch approvals' }, { status: 500 });
  }
}
