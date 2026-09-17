import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: policyId } = await params;

  try {
    const policy = await query(
      `SELECT p.*, COUNT(r.id) as document_count
       FROM retention_policies p
       LEFT JOIN retention_records r ON r.retention_policy_id = p.id
       WHERE p.id = $1 AND p.organization_id = $2
       GROUP BY p.id`,
      [policyId, session.organizationId]
    );

    if (policy.length === 0) {
      return NextResponse.json({ error: 'Retention schedule not found.' }, { status: 404 });
    }

    return NextResponse.json({ policy: policy[0] });
  } catch (err: any) {
    console.error('[ADMIN_GET_RETENTION_POLICY_BY_ID_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve retention policy.', details: err.message },
      { status: 500 }
    );
  }
}

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
      name,
      scheduleCode,
      retentionDays,
      permanent,
      deletionRequiresApproval,
      actionOnExpiry,
      statutoryFramework,
      description,
    } = body;

    const existing = await query(
      `SELECT id, name, schedule_code FROM retention_policies WHERE id = $1 AND organization_id = $2`,
      [policyId, session.organizationId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Retention schedule not found.' }, { status: 404 });
    }

    const setClauses: string[] = [];
    const queryParams: any[] = [policyId, session.organizationId];

    if (name !== undefined) {
      queryParams.push(name.trim());
      setClauses.push(`name = $${queryParams.length}`);
    }
    if (scheduleCode !== undefined) {
      const cleanCode = scheduleCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
      const dup = await query(
        `SELECT id FROM retention_policies WHERE schedule_code = $1 AND organization_id = $2 AND id != $3`,
        [cleanCode, session.organizationId, policyId]
      );
      if (dup.length > 0) {
        return NextResponse.json(
          { error: `Retention schedule code "${cleanCode}" is already in use.` },
          { status: 409 }
        );
      }
      queryParams.push(cleanCode);
      setClauses.push(`schedule_code = $${queryParams.length}`);
    }
    if (retentionDays !== undefined) {
      queryParams.push(retentionDays === null ? null : parseInt(retentionDays, 10));
      setClauses.push(`retention_days = $${queryParams.length}`);
    }
    if (permanent !== undefined) {
      queryParams.push(permanent);
      setClauses.push(`permanent = $${queryParams.length}`);
    }
    if (deletionRequiresApproval !== undefined) {
      queryParams.push(deletionRequiresApproval);
      setClauses.push(`deletion_requires_approval = $${queryParams.length}`);
    }
    if (actionOnExpiry !== undefined) {
      queryParams.push(actionOnExpiry.trim());
      setClauses.push(`action_on_expiry = $${queryParams.length}`);
    }
    if (statutoryFramework !== undefined) {
      queryParams.push(statutoryFramework.trim());
      setClauses.push(`statutory_framework = $${queryParams.length}`);
    }
    if (description !== undefined) {
      queryParams.push(description?.trim() || null);
      setClauses.push(`description = $${queryParams.length}`);
    }

    if (setClauses.length > 0) {
      await query(
        `UPDATE retention_policies SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
        queryParams
      );
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_RETENTION_SCHEDULE_UPDATED',
      actorId: session.userId,
      resourceType: 'RETENTION_POLICY',
      resourceId: policyId,
      result: 'SUCCESS',
      metadata: {
        policyId,
        changes: body,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Retention schedule updated successfully.',
    });
  } catch (err: any) {
    console.error('[ADMIN_UPDATE_RETENTION_POLICY_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to update retention schedule.', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: policyId } = await params;

  try {
    // Check if any documents are actively assigned to this schedule
    const activeDocs = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM retention_records WHERE retention_policy_id = $1`,
      [policyId]
    );

    if (parseInt(activeDocs[0]?.count || '0', 10) > 0) {
      return NextResponse.json(
        { error: `Cannot delete schedule: ${activeDocs[0].count} documents are actively linked to this schedule.` },
        { status: 409 }
      );
    }

    // Delete mapping in department policies first
    await query(`DELETE FROM document_type_policies WHERE retention_policy_id = $1 AND organization_id = $2`, [
      policyId,
      session.organizationId,
    ]);

    await query(`DELETE FROM retention_policies WHERE id = $1 AND organization_id = $2`, [
      policyId,
      session.organizationId,
    ]);

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_RETENTION_SCHEDULE_DELETED',
      actorId: session.userId,
      resourceType: 'RETENTION_POLICY',
      resourceId: policyId,
      result: 'SUCCESS',
      metadata: { policyId },
    });

    return NextResponse.json({
      success: true,
      message: 'Retention schedule deleted successfully.',
    });
  } catch (err: any) {
    console.error('[ADMIN_DELETE_RETENTION_POLICY_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to delete retention schedule.', details: err.message },
      { status: 500 }
    );
  }
}
