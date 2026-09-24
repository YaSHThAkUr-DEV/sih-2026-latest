import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';
import { BlockchainService } from '@/lib/blockchain/service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { id: requestId } = await params;
    const body = await req.json();
    const {
      decision, // 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION'
      documentId,
      documentVersionId,
      accessModeId,
      enableWatermark,
      customWatermarkTemplate,
      accessDurationDays,
      responseNote,
      rejectionReason,
    } = body;

    if (!decision || !['APPROVE', 'REJECT', 'REQUEST_CLARIFICATION'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision: Must be APPROVE, REJECT, or REQUEST_CLARIFICATION' },
        { status: 400 }
      );
    }

    // 1. Fetch Request Details & Ensure it targets the user's organization
    const reqResults = await query(
      `SELECT req.*, 
              req_org.name as requesting_org_name, req_org.code as requesting_org_code,
              req_user.full_name as requesting_user_name, req_user.max_security_level as requesting_user_clearance
       FROM inter_org_requests req
       JOIN organizations req_org ON req.requesting_org_id = req_org.id
       JOIN users req_user ON req.requesting_user_id = req_user.id
       WHERE req.id = $1`,
      [requestId]
    );

    if (reqResults.length === 0) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const interReq = reqResults[0];

    // Authorization: User must belong to the TARGET organization
    if (interReq.target_org_id !== session.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not belong to the target organization handling this request' },
        { status: 403 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // ------------------------------------------------------------------------
    // HANDLING REJECTION
    // ------------------------------------------------------------------------
    if (decision === 'REJECT') {
      const reasonText = (rejectionReason || responseNote || 'Requisition denied by statutory authority').trim();

      await query(
        `UPDATE inter_org_requests
         SET status = 'REJECTED',
             response_note = $1,
             responded_by_user_id = $2,
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [reasonText, session.userId, requestId]
      );

      await logAuditEvent({
        organizationId: session.organizationId,
        eventType: 'INTER_ORG_REQUEST_REJECTED',
        actorId: session.userId,
        resourceType: 'FEDERATION_REQUISITION',
        resourceId: requestId,
        ipAddress,
        result: 'DENIED',
        failureReason: reasonText,
        metadata: {
          requestNumber: interReq.request_number,
          requestingOrg: interReq.requesting_org_name,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Requisition ${interReq.request_number} rejected`,
      });
    }

    // ------------------------------------------------------------------------
    // HANDLING APPROVAL & ACTIVE SHARE CREATION
    // ------------------------------------------------------------------------
    if (decision === 'APPROVE') {
      const selectedDocId = documentId || interReq.target_document_id;
      if (!selectedDocId) {
        return NextResponse.json(
          { error: 'A document must be selected from your repository to grant access' },
          { status: 400 }
        );
      }

      // 2. Fetch Document Details & Security Clearance Check
      const docResults = await query(
        `SELECT d.id, d.title, d.document_number, d.current_version_id,
                sl.id as security_level_id, sl.code as security_level_code, sl.rank as security_level_rank
         FROM documents d
         JOIN security_levels sl ON d.security_level_id = sl.id
         WHERE d.id = $1 AND d.organization_id = $2`,
        [selectedDocId, session.organizationId]
      );

      if (docResults.length === 0) {
        return NextResponse.json({ error: 'Selected document does not exist in your organization vault' }, { status: 404 });
      }

      const doc = docResults[0];
      const targetVersionId = documentVersionId || doc.current_version_id;

      // 3. MULTI-TIER CLEARANCE SAFETY CHECK (T1–T5)
      const docRank = Number(doc.security_level_rank);
      const reqUserClearance = Number(interReq.requesting_user_clearance || 1);

      if (reqUserClearance < docRank) {
        return NextResponse.json(
          {
            error: `Security Clearance Violation: Requesting officer holds Level ${reqUserClearance} clearance, which is insufficient for this Level ${docRank} (${doc.security_level_code}) classified document.`,
          },
          { status: 403 }
        );
      }

      // Resolve Access Mode
      let resolvedAccessModeId = accessModeId;
      if (!resolvedAccessModeId) {
        const defaultMode = await query(`SELECT id FROM taxonomy_access_modes WHERE code = 'VIEW_ONLY_WATERMARKED' LIMIT 1`);
        resolvedAccessModeId = defaultMode[0]?.id;
      }

      const durationDays = accessDurationDays ? Math.min(60, Math.max(1, Number(accessDurationDays))) : (interReq.requested_access_days || 7);
      const shareNumber = `SHR-FED-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      // Generate Ephemeral Share Token Hash
      const rawTokenPayload = `${shareNumber}:${interReq.id}:${doc.id}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
      const tokenHash = crypto.createHash('sha256').update(rawTokenPayload).digest('hex');

      // Ephemeral KMS Re-encryption Reference Key ID
      const ephemeralKeyId = `EPH-KMS-${crypto.randomBytes(8).toString('hex')}`;

      // Default watermark template
      const watermarkTemplate = customWatermarkTemplate || `ACCESSED BY {{officer_name}} ({{emp_code}}) | {{org_name}} | {{timestamp}} | TX: {{tx_hash}}`;

      // 4. Insert Active Cross-Org Share Record
      const shareRes = await query(
        `INSERT INTO inter_org_shares (
           share_number,
           request_id,
           document_id,
           document_version_id,
           source_org_id,
           target_org_id,
           authorized_user_id,
           access_mode_id,
           is_watermarked,
           custom_watermark_template,
           token_hash,
           ephemeral_key_id,
           starts_at,
           expires_at,
           created_by_user_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW() + INTERVAL '${durationDays} days', $13)
         RETURNING *;`,
        [
          shareNumber,
          requestId,
          doc.id,
          targetVersionId,
          session.organizationId,
          interReq.requesting_org_id,
          interReq.requesting_user_id,
          resolvedAccessModeId,
          enableWatermark !== false,
          watermarkTemplate,
          tokenHash,
          ephemeralKeyId,
          session.userId,
        ]
      );

      const createdShare = shareRes[0];

      // 5. Update Request Status to APPROVED
      await query(
        `UPDATE inter_org_requests
         SET status = 'APPROVED',
             target_document_id = $1,
             response_note = $2,
             responded_by_user_id = $3,
             responded_at = NOW(),
             expires_at = NOW() + INTERVAL '${durationDays} days',
             updated_at = NOW()
         WHERE id = $4`,
        [doc.id, responseNote || 'Requisition approved with time-bound cryptographic access', session.userId, requestId]
      );

      // 6. Anchor to Blockchain Ledger
      const anchorHash = crypto
        .createHash('sha256')
        .update(`INTER_ORG_GRANT:${interReq.request_number}:${shareNumber}:${doc.id}:${session.userId}:${Date.now()}`)
        .digest('hex');

      BlockchainService.anchorHash({
        auditEventId: createdShare.id,
        payloadHash: anchorHash,
        documentId: doc.id,
        eventType: 'FEDERATED_EXCHANGE_GRANT' as any,
        actorId: session.userId,
        organizationId: session.organizationId,
        metadata: {
          requestNumber: interReq.request_number,
          shareNumber,
          requestingOrg: interReq.requesting_org_name,
          durationDays,
          securityTier: doc.security_level_code,
        },
      })
        .then(async (tx) => {
          if (tx?.transactionId) {
            await query(`UPDATE inter_org_shares SET blockchain_tx_hash = $1 WHERE id = $2`, [tx.transactionId, createdShare.id]);
          }
        })
        .catch((err) => console.error('[BLOCKCHAIN_SHARE_ANCHOR_ERROR]', err));

      // 7. Log Tamper-Evident Audit Event
      await logAuditEvent({
        organizationId: session.organizationId,
        eventType: 'INTER_ORG_ACCESS_GRANTED',
        actorId: session.userId,
        resourceType: 'FEDERATION_SHARE',
        resourceId: createdShare.id,
        documentId: doc.id,
        documentVersionId: targetVersionId,
        ipAddress,
        result: 'SUCCESS',
        metadata: {
          requestNumber: interReq.request_number,
          shareNumber,
          requestingOrgId: interReq.requesting_org_id,
          requestingOrgName: interReq.requesting_org_name,
          requestingUserId: interReq.requesting_user_id,
          securityTier: doc.security_level_code,
          durationDays,
          isWatermarked: enableWatermark !== false,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Requisition ${interReq.request_number} approved and active share ${shareNumber} created`,
        share: createdShare,
      });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (error: any) {
    console.error('[COLLABORATION_RESPOND_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to process requisition response', details: error.message },
      { status: 500 }
    );
  }
}
