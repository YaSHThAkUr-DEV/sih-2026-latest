import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, action, orderNumber, judicialAuthority, reason } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    const docRes = await query<{ id: string; document_number: string; title: string }>(
      'SELECT id, document_number, title FROM documents WHERE id = $1',
      [documentId]
    );

    if (docRes.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = docRes[0];

    if (action === 'LIFT') {
      // Lifting judicial legal hold
      await query(
        `UPDATE retention_records 
         SET legal_hold = false, status = 'ACTIVE'
         WHERE document_id = $1`,
        [documentId]
      );

      await logAuditEvent({
        organizationId: session.organizationId,
        eventType: 'LEGAL_HOLD_LIFTED',
        actorId: session.userId,
        resourceType: 'DOCUMENT',
        resourceId: documentId,
        documentId: documentId,
        result: 'SUCCESS',
        metadata: {
          documentNumber: doc.document_number,
          title: doc.title,
          liftedBy: session.username,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Storage Preservation Lock released for document ${doc.document_number}.`,
      });
    }

    // Applying storage preservation lock
    if (!orderNumber || !judicialAuthority || !reason) {
      return NextResponse.json(
        { error: 'Lock reference number, authorizing department, and reason are required to apply a preservation lock' },
        { status: 400 }
      );
    }

    // Check if retention record exists, if not create one with default policy
    const recRes = await query<{ id: string }>(
      'SELECT id FROM retention_records WHERE document_id = $1',
      [documentId]
    );

    if (recRes.length > 0) {
      await query(
        `UPDATE retention_records 
         SET legal_hold = true,
             status = 'LEGAL_HOLD',
             legal_hold_order_number = $1,
             legal_hold_authority = $2,
             legal_hold_reason = $3,
             legal_hold_by = $4,
             legal_hold_applied_at = now()
         WHERE document_id = $5`,
        [orderNumber, judicialAuthority, reason, session.userId, documentId]
      );
    } else {
      const polRes = await query<{ id: string }>('SELECT id FROM retention_policies LIMIT 1');
      await query(
        `INSERT INTO retention_records 
         (document_id, retention_policy_id, retention_start_at, retention_end_at, legal_hold, status,
          legal_hold_order_number, legal_hold_authority, legal_hold_reason, legal_hold_by, legal_hold_applied_at)
         VALUES ($1, $2, now(), now() + INTERVAL '30 years', true, 'LEGAL_HOLD', $3, $4, $5, $6, now())`,
        [documentId, polRes[0].id, orderNumber, judicialAuthority, reason, session.userId]
      );
    }

    // If any pending deletion request exists, cancel it immediately due to preservation lock!
    await query(
      `UPDATE deletion_requests 
       SET status = 'CANCELLED', failure_reason = $1 
       WHERE document_id = $2 AND status IN ('REQUESTED', 'PENDING_APPROVAL')`,
      [`Storage Preservation Lock applied: Ref #${orderNumber}`, documentId]
    );

    // Audit Event logged into immutable ledger
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'LEGAL_HOLD_APPLIED',
      actorId: session.userId,
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      documentId: documentId,
      result: 'SUCCESS',
      metadata: {
        documentNumber: doc.document_number,
        title: doc.title,
        courtOrderNumber: orderNumber,
        judicialAuthority,
        grounds: reason,
        appliedBy: session.username,
        immunityActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Storage Preservation Lock applied under Ref #${orderNumber}. Retention counter frozen.`,
    });
  } catch (error: any) {
    console.error('Error modifying legal hold:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
