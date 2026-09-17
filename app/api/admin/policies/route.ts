import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  const url = new URL(req.url);
  const departmentId = url.searchParams.get('department_id')?.trim();

  try {
    let whereClauses = [`dtp.organization_id = $1`];
    let params: any[] = [session.organizationId];

    if (departmentId) {
      params.push(departmentId);
      whereClauses.push(`dtp.department_id = $${params.length}`);
    }

    const policies = await query(
      `SELECT 
         dtp.id,
         dtp.organization_id,
         dtp.department_id,
         d.name as department_name,
         d.code as department_code,
         dtp.document_type_id,
         dt.name as document_type_name,
         dt.code as document_type_code,
         dtp.security_level_id,
         sl.name as security_level_name,
         sl.code as security_level_code,
         sl.rank as security_level_rank,
         dtp.retention_policy_id,
         rp.name as retention_policy_name,
         rp.schedule_code as retention_schedule_code,
         dtp.approval_required,
         dtp.ocr_required,
         dtp.download_allowed,
         dtp.active,
         dtp.created_at
       FROM document_type_policies dtp
       JOIN departments d ON dtp.department_id = d.id
       JOIN document_types dt ON dtp.document_type_id = dt.id
       JOIN security_levels sl ON dtp.security_level_id = sl.id
       JOIN retention_policies rp ON dtp.retention_policy_id = rp.id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY d.name ASC, dt.name ASC`,
      params
    );

    return NextResponse.json({ policies });
  } catch (err: any) {
    console.error('[ADMIN_GET_POLICIES_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve department policies.', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const body = await req.json();
    const {
      departmentId,
      documentTypeId,
      securityLevelId,
      retentionPolicyId,
      approvalRequired = false,
      ocrRequired = true,
      downloadAllowed = true,
      active = true,
    } = body;

    if (!departmentId || !documentTypeId || !securityLevelId || !retentionPolicyId) {
      return NextResponse.json(
        { error: 'Department, document classification, security tier, and retention policy are all mandatory.' },
        { status: 400 }
      );
    }

    // Check if policy already exists for this dept & docType
    const existing = await query(
      `SELECT id FROM document_type_policies WHERE department_id = $1 AND document_type_id = $2`,
      [departmentId, documentTypeId]
    );

    let policyId = '';

    if (existing.length > 0) {
      policyId = existing[0].id;
      await query(
        `UPDATE document_type_policies
         SET security_level_id = $1,
             retention_policy_id = $2,
             approval_required = $3,
             ocr_required = $4,
             download_allowed = $5,
             active = $6
         WHERE id = $7`,
        [securityLevelId, retentionPolicyId, approvalRequired, ocrRequired, downloadAllowed, active, policyId]
      );
    } else {
      const res = await query<{ id: string }>(
        `INSERT INTO document_type_policies (
           organization_id, department_id, document_type_id, security_level_id,
           retention_policy_id, approval_required, ocr_required, download_allowed, active, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING id;`,
        [
          session.organizationId,
          departmentId,
          documentTypeId,
          securityLevelId,
          retentionPolicyId,
          approvalRequired,
          ocrRequired,
          downloadAllowed,
          active,
        ]
      );
      policyId = res[0].id;
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_DEPARTMENT_POLICY_SAVED',
      actorId: session.userId,
      resourceType: 'DEPARTMENT_POLICY',
      resourceId: policyId,
      result: 'SUCCESS',
      metadata: {
        policyId,
        departmentId,
        documentTypeId,
        securityLevelId,
        retentionPolicyId,
        approvalRequired,
        ocrRequired,
        downloadAllowed,
        active,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Institutional document type policy configured.',
      policyId,
    });
  } catch (err: any) {
    console.error('[ADMIN_SAVE_POLICY_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to save policy configuration.', details: err.message },
      { status: 500 }
    );
  }
}
