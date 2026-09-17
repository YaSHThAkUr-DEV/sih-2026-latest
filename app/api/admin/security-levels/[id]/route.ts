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
  const { id: securityLevelId } = await params;

  try {
    const body = await req.json();
    const { name, description, approvalRequired, encryptionRequired, auditLevel } = body;

    const existing = await query(
      `SELECT id, name, code FROM security_levels WHERE id = $1 AND organization_id = $2`,
      [securityLevelId, session.organizationId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Security tier not found.' }, { status: 404 });
    }

    const setClauses: string[] = [];
    const queryParams: any[] = [securityLevelId, session.organizationId];

    if (name !== undefined) {
      queryParams.push(name.trim());
      setClauses.push(`name = $${queryParams.length}`);
    }
    if (description !== undefined) {
      queryParams.push(description?.trim() || null);
      setClauses.push(`description = $${queryParams.length}`);
    }
    if (approvalRequired !== undefined) {
      queryParams.push(approvalRequired);
      setClauses.push(`approval_required = $${queryParams.length}`);
    }
    if (encryptionRequired !== undefined) {
      queryParams.push(encryptionRequired);
      setClauses.push(`encryption_required = $${queryParams.length}`);
    }
    if (auditLevel !== undefined) {
      queryParams.push(auditLevel);
      setClauses.push(`audit_level = $${queryParams.length}`);
    }

    if (setClauses.length > 0) {
      await query(
        `UPDATE security_levels SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
        queryParams
      );
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_SECURITY_LEVEL_UPDATED',
      actorId: session.userId,
      resourceType: 'SECURITY_LEVEL',
      resourceId: securityLevelId,
      result: 'SUCCESS',
      metadata: {
        securityLevelId,
        tierCode: existing[0].code,
        changes: { name, approvalRequired, encryptionRequired, auditLevel },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Security classification tier "${existing[0].code}" updated.`,
    });
  } catch (err: any) {
    console.error('[ADMIN_UPDATE_SECURITY_LEVEL_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to update security tier.', details: err.message },
      { status: 500 }
    );
  }
}
