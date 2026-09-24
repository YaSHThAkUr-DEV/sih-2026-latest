import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const direction = searchParams.get('direction') || 'all'; // 'inbound', 'outbound', 'all'
    const status = searchParams.get('status')?.trim() || 'ALL';
    const priorityId = searchParams.get('priorityId')?.trim() || 'ALL';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const orgId = session.organizationId;
    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (direction === 'inbound') {
      whereConditions.push(`req.target_org_id = $${paramIndex}`);
      params.push(orgId);
      paramIndex++;
    } else if (direction === 'outbound') {
      whereConditions.push(`req.requesting_org_id = $${paramIndex}`);
      params.push(orgId);
      paramIndex++;
    } else {
      whereConditions.push(`(req.target_org_id = $${paramIndex} OR req.requesting_org_id = $${paramIndex})`);
      params.push(orgId);
      paramIndex++;
    }

    if (status && status !== 'ALL') {
      whereConditions.push(`req.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (priorityId && priorityId !== 'ALL') {
      whereConditions.push(`req.priority_tier_id = $${paramIndex}`);
      params.push(priorityId);
      paramIndex++;
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total Count
    const countSql = `
      SELECT COUNT(*)::int as total
      FROM inter_org_requests req
      ${whereSql}
    `;
    const countRes = await query<{ total: number }>(countSql, params);
    const total = countRes[0]?.total || 0;

    // Detailed Query with Joined Counterparty, Documents, and Shares
    const selectSql = `
      SELECT 
        req.id,
        req.request_number as "requestNumber",
        req.subject_title as "subjectTitle",
        req.reference_case_number as "referenceCaseNumber",
        req.custom_statutory_purpose as "statutoryPurpose",
        req.custom_legal_provisions as "legalProvisions",
        req.requested_access_days as "requestedAccessDays",
        req.sla_deadline as "slaDeadline",
        req.status,
        req.response_note as "responseNote",
        req.responded_at as "respondedAt",
        req.expires_at as "expiresAt",
        req.created_at as "createdAt",
        req.updated_at as "updatedAt",
        
        -- Requesting Org & Officer
        req_org.id as "requestingOrgId",
        req_org.name as "requestingOrgName",
        req_org.code as "requestingOrgCode",
        req_org.agency_code as "requestingAgencyCode",
        req_user.id as "requestingUserId",
        req_user.full_name as "requestingUserName",
        req_user.designation as "requestingUserDesignation",
        req_user.employee_code as "requestingUserEmpCode",
        req_user.max_security_level as "requestingUserClearance",

        -- Target Org
        tgt_org.id as "targetOrgId",
        tgt_org.name as "targetOrgName",
        tgt_org.code as "targetOrgCode",
        tgt_org.agency_code as "targetAgencyCode",
        tgt_org.nodal_officer_name as "targetNodalName",
        tgt_org.nodal_officer_email as "targetNodalEmail",

        -- Statutory Template
        st.id as "statutoryTemplateId",
        st.code as "statutoryTemplateCode",
        st.title as "statutoryTemplateTitle",
        st.section_citation as "sectionCitation",
        st.legal_act_name as "legalActName",

        -- Priority Tier
        pt.id as "priorityTierId",
        pt.code as "priorityTierCode",
        pt.name as "priorityTierName",
        pt.sla_hours as "slaHours",
        pt.badge_color as "priorityBadgeColor",

        -- Linked Target Document (if specified)
        doc.id as "targetDocumentId",
        doc.document_number as "targetDocumentNumber",
        doc.title as "targetDocumentTitle",
        sl.code as "targetDocSecurityCode",
        sl.rank as "targetDocSecurityRank",
        sl.name as "targetDocSecurityName",

        -- Active Share Link (if approved)
        shr.id as "shareId",
        shr.share_number as "shareNumber",
        shr.is_watermarked as "shareIsWatermarked",
        shr.view_count as "shareViewCount",
        shr.download_count as "shareDownloadCount",
        shr.expires_at as "shareExpiresAt",
        shr.is_revoked as "shareIsRevoked",
        shr.blockchain_tx_hash as "shareBlockchainTx",
        am.code as "accessModeCode",
        am.name as "accessModeName"

      FROM inter_org_requests req
      JOIN organizations req_org ON req.requesting_org_id = req_org.id
      JOIN users req_user ON req.requesting_user_id = req_user.id
      JOIN organizations tgt_org ON req.target_org_id = tgt_org.id
      LEFT JOIN taxonomy_statutory_templates st ON req.statutory_template_id = st.id
      LEFT JOIN taxonomy_priority_tiers pt ON req.priority_tier_id = pt.id
      LEFT JOIN documents doc ON req.target_document_id = doc.id
      LEFT JOIN security_levels sl ON doc.security_level_id = sl.id
      LEFT JOIN inter_org_shares shr ON req.id = shr.request_id AND shr.is_revoked = false
      LEFT JOIN taxonomy_access_modes am ON shr.access_mode_id = am.id
      ${whereSql}
      ORDER BY 
        CASE WHEN req.status = 'PENDING' THEN 1 WHEN req.status = 'UNDER_REVIEW' THEN 2 ELSE 3 END,
        req.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const requests = await query(selectSql, params);

    // Compute live counter stats for summary cards
    const statsSql = `
      SELECT 
        COUNT(CASE WHEN target_org_id = $1 AND status = 'PENDING' THEN 1 END)::int as "pendingInbound",
        COUNT(CASE WHEN target_org_id = $1 THEN 1 END)::int as "totalInbound",
        COUNT(CASE WHEN requesting_org_id = $1 AND status = 'PENDING' THEN 1 END)::int as "pendingOutbound",
        COUNT(CASE WHEN requesting_org_id = $1 AND status = 'APPROVED' THEN 1 END)::int as "approvedOutbound",
        COUNT(CASE WHEN requesting_org_id = $1 THEN 1 END)::int as "totalOutbound"
      FROM inter_org_requests
      WHERE target_org_id = $1 OR requesting_org_id = $1
    `;
    const statsRes = await query(statsSql, [orgId]);
    const counters = statsRes[0] || {};

    return NextResponse.json({
      success: true,
      requests,
      counters,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error('[COLLABORATION_REQUESTS_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to fetch inter-agency requests', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const body = await req.json();
    const {
      targetOrgId,
      targetDeptId,
      targetDocumentId,
      documentTypeId,
      statutoryTemplateId,
      priorityTierId,
      referenceCaseNumber,
      subjectTitle,
      customStatutoryPurpose,
      customLegalProvisions,
      requestedAccessDays,
    } = body;

    if (!targetOrgId || !subjectTitle || !customStatutoryPurpose) {
      return NextResponse.json(
        { error: 'Target Organization, Subject Title, and Statutory Legal Purpose are required' },
        { status: 400 }
      );
    }

    const requestingOrgId = session.organizationId;
    if (targetOrgId === requestingOrgId) {
      return NextResponse.json(
        { error: 'Invalid Request: You cannot issue an inter-agency requisition to your own organization' },
        { status: 400 }
      );
    }

    // Resolve Priority Tier SLA
    let slaHours = 168; // Default 7 days
    if (priorityTierId) {
      const priorityRes = await query<{ sla_hours: number }>(
        `SELECT sla_hours FROM taxonomy_priority_tiers WHERE id = $1`,
        [priorityTierId]
      );
      if (priorityRes[0]?.sla_hours) {
        slaHours = priorityRes[0].sla_hours;
      }
    }

    // Generate Unique Tracking Request Number
    const randomSeq = Math.floor(10000 + Math.random() * 90000);
    const requestNumber = `REQ-FED-${new Date().getFullYear()}-${randomSeq}`;

    const insertSql = `
      INSERT INTO inter_org_requests (
        request_number,
        requesting_org_id,
        requesting_dept_id,
        requesting_user_id,
        target_org_id,
        target_dept_id,
        target_document_id,
        document_type_id,
        statutory_template_id,
        priority_tier_id,
        reference_case_number,
        subject_title,
        custom_statutory_purpose,
        custom_legal_provisions,
        requested_access_days,
        sla_deadline,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW() + INTERVAL '${slaHours} hours', 'PENDING')
      RETURNING *;
    `;

    const result = await query(insertSql, [
      requestNumber,
      requestingOrgId,
      session.departmentId || null,
      session.userId,
      targetOrgId,
      targetDeptId || null,
      targetDocumentId || null,
      documentTypeId || null,
      statutoryTemplateId || null,
      priorityTierId || null,
      referenceCaseNumber?.trim() || null,
      subjectTitle.trim(),
      customStatutoryPurpose.trim(),
      customLegalProvisions?.trim() || 'Statutory Official Requisition',
      requestedAccessDays ? Math.min(60, Math.max(1, Number(requestedAccessDays))) : 7,
    ]);

    const createdReq = result[0];

    // Log Tamper-Evident Audit Event
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    await logAuditEvent({
      organizationId: requestingOrgId,
      eventType: 'INTER_ORG_REQUEST_CREATED',
      actorId: session.userId,
      resourceType: 'FEDERATION_REQUISITION',
      resourceId: createdReq.id,
      ipAddress,
      result: 'SUCCESS',
      metadata: {
        requestNumber,
        targetOrgId,
        subjectTitle,
        referenceCaseNumber,
        slaHours,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Inter-Agency Requisition ${requestNumber} submitted successfully`,
      request: createdReq,
    });
  } catch (error: any) {
    console.error('[COLLABORATION_REQUESTS_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create inter-agency request', details: error.message },
      { status: 500 }
    );
  }
}
