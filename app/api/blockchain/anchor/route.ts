// =============================================================================
// POST /api/blockchain/anchor — Manual Hash Anchoring API
// =============================================================================
// Allows admin/auditor users to manually anchor a payload hash to the
// blockchain ledger. Restricted to users with AUDIT_VIEW permission.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/jwt';
import { logAuditEvent } from '@/lib/auth/audit';
import { BlockchainService } from '@/lib/blockchain/service';
import type { AnchorEventType } from '@/lib/blockchain/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify audit/admin privilege
    const hasPrivilege =
      session.permissions.includes('AUDIT_VIEW') ||
      session.roles.includes('SUPER_ADMIN') ||
      session.roles.includes('AUDITOR');

    if (!hasPrivilege) {
      return NextResponse.json(
        { error: 'Access Denied: Blockchain anchoring requires AUDIT_VIEW or SUPER_ADMIN clearance.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { payloadHash, documentId, eventType, metadata } = body;

    if (!payloadHash || typeof payloadHash !== 'string' || payloadHash.length < 16) {
      return NextResponse.json(
        { error: 'Missing or invalid payloadHash. Provide a SHA-256 hex string.' },
        { status: 400 }
      );
    }

    // Create an audit event for this manual anchoring
    const auditEventId = await logAuditEvent({
      organizationId: session.organizationId,
      actorId: session.userId,
      eventType: 'MANUAL_BLOCKCHAIN_ANCHOR',
      resourceType: 'BLOCKCHAIN',
      documentId: documentId || undefined,
      result: 'SUCCESS',
      metadata: {
        payloadHash,
        eventType: eventType || 'AUDIT_ATTESTATION',
        manualAnchor: true,
        ...metadata,
      },
    });

    // Execute the blockchain anchoring
    const receipt = await BlockchainService.anchorHash({
      auditEventId,
      payloadHash,
      documentId: documentId || undefined,
      eventType: (eventType as AnchorEventType) || 'AUDIT_ATTESTATION',
      actorId: session.userId,
      organizationId: session.organizationId,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      message: 'Payload hash successfully anchored to Hyperledger Fabric ledger.',
      receipt,
    });
  } catch (error: any) {
    console.error('[BLOCKCHAIN_ANCHOR_API_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to anchor hash to blockchain' },
      { status: 500 }
    );
  }
}
