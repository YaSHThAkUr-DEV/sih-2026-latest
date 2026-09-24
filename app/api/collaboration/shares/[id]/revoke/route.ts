import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { id: shareId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const shares = await query(
      `SELECT shr.*, d.document_number, d.title as document_title
       FROM inter_org_shares shr
       JOIN documents d ON shr.document_id = d.id
       WHERE shr.id = $1`,
      [shareId]
    );

    if (shares.length === 0) {
      return NextResponse.json({ error: 'Shared document record not found' }, { status: 404 });
    }

    const share = shares[0];

    // Authorization: Must belong to originating/source organization
    if (share.source_org_id !== session.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: Only the originating authority can execute emergency revocation' },
        { status: 403 }
      );
    }

    const revokeReason = reason?.trim() || 'Revoked by originating agency administrator';

    await query(
      `UPDATE inter_org_shares
       SET is_revoked = true,
           revoked_reason = $1,
           revoked_by_user_id = $2,
           revoked_at = NOW()
       WHERE id = $3`,
      [revokeReason, session.userId, shareId]
    );

    // Also update linked request status if any
    if (share.request_id) {
      await query(
        `UPDATE inter_org_requests SET status = 'CANCELLED', response_note = $1, updated_at = NOW() WHERE id = $2`,
        [`Access revoked: ${revokeReason}`, share.request_id]
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'INTER_ORG_ACCESS_REVOKED',
      actorId: session.userId,
      resourceType: 'FEDERATION_SHARE',
      resourceId: shareId,
      documentId: share.document_id,
      ipAddress,
      result: 'SUCCESS',
      metadata: {
        shareNumber: share.share_number,
        documentNumber: share.document_number,
        revokedReason: revokeReason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Emergency Revocation executed: Shared access to ${share.share_number} has been immediately terminated`,
    });
  } catch (error: any) {
    console.error('[COLLABORATION_REVOKE_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to revoke shared document access', details: error.message },
      { status: 500 }
    );
  }
}
