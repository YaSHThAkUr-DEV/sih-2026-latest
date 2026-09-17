import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: policyId } = await params;

  try {
    const body = await req.json();
    const {
      approvalRequired,
      ocrRequired,
      downloadAllowed,
      active,
      securityLevelId,
      retentionPolicyId,
    } = body;

    const existing = await query(
      `SELECT id FROM document_type_policies WHERE id = $1 AND organization_id = $2`,
      [policyId, session.organizationId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Policy record not found.' }, { status: 404 });
    }

    const setClauses: string[] = [];
    const queryParams: any[] = [policyId, session.organizationId];

    if (approvalRequired !== undefined) {
      queryParams.push(approvalRequired);
      setClauses.push(`approval_required = $${queryParams.length}`);
    }
    if (ocrRequired !== undefined) {
      queryParams.push(ocrRequired);
      setClauses.push(`ocr_required = $${queryParams.length}`);
    }
    if (downloadAllowed !== undefined) {
      queryParams.push(downloadAllowed);
      setClauses.push(`download_allowed = $${queryParams.length}`);
    }
    if (active !== undefined) {
      queryParams.push(active);
      setClauses.push(`active = $${queryParams.length}`);
    }
    if (securityLevelId !== undefined) {
      queryParams.push(securityLevelId);
      setClauses.push(`security_level_id = $${queryParams.length}`);
    }
    if (retentionPolicyId !== undefined) {
      queryParams.push(retentionPolicyId);
      setClauses.push(`retention_policy_id = $${queryParams.length}`);
    }

    if (setClauses.length > 0) {
      await query(
        `UPDATE document_type_policies SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
        queryParams
      );
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_DEPARTMENT_POLICY_UPDATED',
      actorId: session.userId,
      resourceType: 'DEPARTMENT_POLICY',
      resourceId: policyId,
      result: 'SUCCESS',
      metadata: {
        policyId,
        updates: body,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Policy configuration updated successfully.',
    });
  } catch (err: any) {
    console.error('[ADMIN_PATCH_POLICY_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to update policy.', details: err.message },
      { status: 500 }
    );
  }
}
