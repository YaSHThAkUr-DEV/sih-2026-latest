import { NextRequest, NextResponse } from 'next/server';
import { pool, query } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth/jwt';
import { canApproveDocuments } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/auth/audit';
import { invalidateCache } from '@/lib/cache/redis';
import { JobQueueManager } from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();

  try {
    const { id: requestId } = await params;

    // 1. Check Session
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Valid session required' }, { status: 401 });
    }

    // 2. Parse Body
    const body = await req.json().catch(() => ({}));
    const decision = body.decision;
    const comment = (body.comment || '').trim();

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return NextResponse.json(
        { error: "Invalid decision. Must be either 'APPROVED' or 'REJECTED'." },
        { status: 400 }
      );
    }

    if (!comment) {
      return NextResponse.json(
        { error: 'Statutory Requirement: Approver justification comment is mandatory.' },
        { status: 400 }
      );
    }

    // 3. Query Change Request Details
    const crQuery = await client.query(
      `SELECT 
         cr.id, cr.document_id, cr.original_version_id, cr.proposed_version_id,
         cr.requested_by, cr.assigned_approver_id, cr.status,
         d.document_number, d.title, d.organization_id,
         prop_v.sha256_hash as proposed_hash,
         prop_v.version_number as proposed_version_number
       FROM change_requests cr
       JOIN documents d ON cr.document_id = d.id
       JOIN document_versions prop_v ON cr.proposed_version_id = prop_v.id
       WHERE cr.id = $1
       LIMIT 1;`,
      [requestId]
    );

    if (crQuery.rowCount === 0) {
      return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
    }

    const cr = crQuery.rows[0];

    // 4. Verify Status
    if (cr.status !== 'PENDING') {
      return NextResponse.json(
        { error: `This change request is already finalized (Status: ${cr.status}).` },
        { status: 400 }
      );
    }

    // 5. Enforce Statutory Maker-Checker Dual Custody Rule
    if (session.userId === cr.requested_by) {
      return NextResponse.json(
        {
          error:
            'Statutory Violation (Dual-Custody Mandate): The original requester is legally prohibited from approving their own change request.',
        },
        { status: 403 }
      );
    }

    // 6. Check Approver Privilege (Assigned approver OR permission-based role)
    const isAssigned = cr.assigned_approver_id === session.userId;
    const hasPrivilege = canApproveDocuments(session);

    if (!isAssigned && !hasPrivilege) {
      return NextResponse.json(
        { error: 'Access Denied: You do not possess the required clearance level to adjudicate this change request.' },
        { status: 403 }
      );
    }

    // 7. Atomic Transaction Execution
    await client.query('BEGIN');

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (decision === 'APPROVED') {
      // 1. Promote proposed version to active current version on document
      await client.query(
        `UPDATE documents 
         SET current_version_id = $1, updated_at = NOW(), updated_by = $2 
         WHERE id = $3;`,
        [cr.proposed_version_id, session.userId, cr.document_id]
      );

      // 2. Mark original version as ARCHIVED
      await client.query(
        `UPDATE document_versions SET status = 'ARCHIVED' WHERE id = $1;`,
        [cr.original_version_id]
      );

      // 3. Mark proposed version as ACTIVE
      await client.query(
        `UPDATE document_versions SET status = 'ACTIVE' WHERE id = $1;`,
        [cr.proposed_version_id]
      );

      // 4. Finalize change request as APPROVED
      await client.query(
        `UPDATE change_requests 
         SET status = 'APPROVED', decided_at = NOW() 
         WHERE id = $1;`,
        [cr.id]
      );

      // 5. Insert audit action into approval_actions
      await client.query(
        `INSERT INTO approval_actions (
           change_request_id, approver_id, decision, comment, approved_version_hash
         )
         VALUES ($1, $2, 'APPROVED', $3, $4);`,
        [cr.id, session.userId, comment, cr.proposed_hash]
      );

      // 6. Emit Tamper-Evident Audit Event
      await logAuditEvent({
        organizationId: cr.organization_id,
        eventType: 'DOCUMENT_CHANGE_APPROVED',
        actorId: session.userId,
        resourceType: 'DOCUMENT',
        documentId: cr.document_id,
        documentVersionId: cr.proposed_version_id,
        ipAddress,
        result: 'SUCCESS',
        metadata: {
          changeRequestId: cr.id,
          documentNumber: cr.document_number,
          promotedVersion: cr.proposed_version_number,
          sha256: cr.proposed_hash,
          justification: comment,
        },
      });
    } else {
      // REJECTED Flow
      // 1. Mark proposed version as REJECTED
      await client.query(
        `UPDATE document_versions SET status = 'REJECTED' WHERE id = $1;`,
        [cr.proposed_version_id]
      );

      // 2. Finalize change request as REJECTED
      await client.query(
        `UPDATE change_requests 
         SET status = 'REJECTED', decided_at = NOW() 
         WHERE id = $1;`,
        [cr.id]
      );

      // 3. Insert audit action into approval_actions
      await client.query(
        `INSERT INTO approval_actions (
           change_request_id, approver_id, decision, comment, approved_version_hash
         )
         VALUES ($1, $2, 'REJECTED', $3, $4);`,
        [cr.id, session.userId, comment, cr.proposed_hash]
      );

      // 4. Emit Tamper-Evident Audit Event
      await logAuditEvent({
        organizationId: cr.organization_id,
        eventType: 'DOCUMENT_CHANGE_REJECTED',
        actorId: session.userId,
        resourceType: 'DOCUMENT',
        documentId: cr.document_id,
        documentVersionId: cr.proposed_version_id,
        ipAddress,
        result: 'SUCCESS',
        metadata: {
          changeRequestId: cr.id,
          documentNumber: cr.document_number,
          rejectedVersion: cr.proposed_version_number,
          sha256: cr.proposed_hash,
          justification: comment,
        },
      });
    }

    await client.query('COMMIT');

    // Invalidate Redis Dashboard Cache
    await invalidateCache('dms:dashboard:*');

    // Enqueue Blockchain Hash Anchoring (Module 21 — Hyperledger Fabric Integrity)
    try {
      const eventType = decision === 'APPROVED' ? 'DOCUMENT_CHANGE_APPROVED' : 'DOCUMENT_CHANGE_REJECTED';
      const auditRows = await query<{ id: string }>(
        `SELECT id FROM audit_events
         WHERE document_id = $1 AND event_type = $2
         ORDER BY created_at DESC LIMIT 1;`,
        [cr.document_id, eventType]
      );
      if (auditRows.length > 0) {
        await JobQueueManager.enqueue(
          'blockchain-queue',
          'BLOCKCHAIN_ANCHOR',
          {
            auditEventId: auditRows[0].id,
            payloadHash: cr.proposed_hash,
            documentId: cr.document_id,
            eventType: decision === 'APPROVED' ? 'DOCUMENT_APPROVAL' : 'DOCUMENT_REJECTION',
            actorId: session.userId,
            organizationId: cr.organization_id,
            metadata: {
              changeRequestId: cr.id,
              documentNumber: cr.document_number,
              version: cr.proposed_version_number,
              decision,
            },
          }
        );
      }
    } catch (bcErr: any) {
      // Non-blocking — blockchain anchoring failure should not block approval
      console.warn('[BLOCKCHAIN_ENQUEUE_WARN] Approval anchor deferred:', bcErr.message);
    }

    return NextResponse.json({
      success: true,
      decision,
      message:
        decision === 'APPROVED'
          ? `Revision v${cr.proposed_version_number} for ${cr.document_number} officially approved and promoted to active docket.`
          : `Revision v${cr.proposed_version_number} for ${cr.document_number} formally rejected and quarantined.`,
      documentNumber: cr.document_number,
      approvedVersionHash: cr.proposed_hash,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[APPROVAL_DECISION_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Failed to process approval decision' }, { status: 500 });
  } finally {
    client.release();
  }
}
