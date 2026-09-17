import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await query<any>(
      `SELECT 
         del.id,
         del.document_id,
         d.document_number,
         d.title as document_title,
         del.reason,
         del.status,
         del.requested_at,
         del.completed_at,
         del.shred_method,
         u_req.id as requester_id,
         u_req.username as requester_username,
         u_req.full_name as requester_name,
         u_req.designation as requester_designation,
         u_app.id as approver_id,
         u_app.username as approver_username,
         u_app.full_name as approver_name,
         u_app.designation as approver_designation,
         r.legal_hold,
         r.legal_hold_order_number,
         dv.sha256_hash,
         dv.file_size
       FROM deletion_requests del
       JOIN documents d ON d.id = del.document_id
       JOIN users u_req ON u_req.id = del.requested_by
       LEFT JOIN users u_app ON u_app.id = del.approved_by
       LEFT JOIN retention_records r ON r.document_id = d.id
       LEFT JOIN document_versions dv ON dv.id = d.current_version_id
       ORDER BY del.requested_at DESC`
    );

    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        documentId: r.document_id,
        documentNumber: r.document_number,
        documentTitle: r.document_title,
        reason: r.reason,
        status: r.status,
        requestedAt: r.requested_at,
        completedAt: r.completed_at,
        shredMethod: r.shred_method || 'WORM Object Purge + KMS Transit Key Zeroization',
        isLegalHold: r.legal_hold,
        sha256Hash: r.sha256_hash,
        fileSize: r.file_size,
        requester: {
          id: r.requester_id,
          username: r.requester_username,
          fullName: r.requester_name || r.requester_username,
          designation: r.requester_designation,
        },
        approver: r.approver_id
          ? {
              id: r.approver_id,
              username: r.approver_username,
              fullName: r.approver_name || r.approver_username,
              designation: r.approver_designation,
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching deletion requests:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, reason } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // 1. Fetch document and retention record
    const docRes = await query<{ id: string; document_number: string; title: string; status: string }>(
      'SELECT id, document_number, title, status FROM documents WHERE id = $1',
      [documentId]
    );

    if (docRes.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const doc = docRes[0];

    // 2. IMMUNITY CHECK: Is document under legal hold?
    const retRes = await query<{ legal_hold: boolean; legal_hold_order_number: string }>(
      'SELECT legal_hold, legal_hold_order_number FROM retention_records WHERE document_id = $1',
      [documentId]
    );

    if (retRes.length > 0 && retRes[0].legal_hold) {
      return NextResponse.json(
        {
          error: `DISPOSAL PROPOSAL REJECTED: Document is protected by active Judicial Legal Hold #${retRes[0].legal_hold_order_number}. Contempt-of-court immunity enforced.`,
        },
        { status: 403 }
      );
    }

    // 3. Check if already pending
    const existing = await query<{ id: string }>(
      "SELECT id FROM deletion_requests WHERE document_id = $1 AND status IN ('REQUESTED', 'PENDING_APPROVAL')",
      [documentId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A disposal proposal is already pending dual-custody approval for this document.' },
        { status: 409 }
      );
    }

    // 4. Create Deletion Request (Maker Key 1 Assertion)
    const delRes = await query<{ id: string }>(
      `INSERT INTO deletion_requests 
       (document_id, requested_by, reason, status, shred_method, requested_at)
       VALUES ($1, $2, $3, 'PENDING_APPROVAL', 'WORM Object Purge + KMS Transit Key Zeroization', now())
       RETURNING id`,
      [documentId, session.userId, reason || 'Statutory retention expired or operational disposal requested.']
    );

    // Update document status
    await query("UPDATE documents SET status = 'PENDING_DELETION' WHERE id = $1", [documentId]);
    await query("UPDATE retention_records SET status = 'DISPOSAL_STAGED' WHERE document_id = $1", [documentId]);

    // Log audit event
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'DISPOSAL_PROPOSED',
      actorId: session.userId,
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      documentId: documentId,
      result: 'SUCCESS',
      metadata: {
        documentNumber: doc.document_number,
        title: doc.title,
        makerOfficer: session.username,
        reason: reason || 'Disposal proposed',
        requestId: delRes[0].id,
      },
    });

    return NextResponse.json({
      success: true,
      requestId: delRes[0].id,
      message: `Disposal proposal initiated by Key 1 (${session.username}). Awaiting second custodian sign-off.`,
    });
  } catch (error: any) {
    console.error('Error proposing disposal:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
