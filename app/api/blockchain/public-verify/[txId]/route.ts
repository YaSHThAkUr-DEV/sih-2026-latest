// =============================================================================
// GET /api/blockchain/public-verify/:txId — Zero-Auth Public Verification API
// =============================================================================
// Allows courts, external auditors, citizens, and QR code scanners to verify
// any Blockchain Transaction ID or SHA-256 hash without an active session.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BlockchainService } from '@/lib/blockchain/service';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const { txId } = await params;

    if (!txId || txId.trim().length < 8) {
      return NextResponse.json(
        { error: 'Invalid verification key or transaction ID.' },
        { status: 400 }
      );
    }

    const cleanInput = txId.trim();

    // 1. Check if the input is a direct Transaction ID
    let proof = await BlockchainService.verifyTransaction(cleanInput);

    // 2. If not found, check if the input is a SHA-256 Payload Hash
    let associatedRecord: any = null;
    if (!proof.verified) {
      const hashLookup = await query<any>(
        `SELECT br.transaction_id, br.payload_hash, br.ledger_status, br.submitted_at,
                d.document_number, d.title as document_title, d.created_at as doc_created_at,
                org.name as org_name
         FROM blockchain_records br
         LEFT JOIN audit_events ae ON br.audit_event_id = ae.id
         LEFT JOIN documents d ON ae.document_id = d.id
         LEFT JOIN organizations org ON ae.organization_id = org.id
         WHERE br.payload_hash ILIKE $1 OR br.transaction_id ILIKE $1
         LIMIT 1;`,
        [cleanInput]
      );

      if (hashLookup.length > 0) {
        associatedRecord = hashLookup[0];
        proof = await BlockchainService.verifyTransaction(associatedRecord.transaction_id);
      }
    } else {
      const docLookup = await query<any>(
        `SELECT d.document_number, d.title as document_title, d.created_at as doc_created_at,
                org.name as org_name
         FROM blockchain_records br
         LEFT JOIN audit_events ae ON br.audit_event_id = ae.id
         LEFT JOIN documents d ON ae.document_id = d.id
         LEFT JOIN organizations org ON ae.organization_id = org.id
         WHERE br.transaction_id = $1
         LIMIT 1;`,
        [cleanInput]
      );
      if (docLookup.length > 0) {
        associatedRecord = docLookup[0];
      }
    }

    return NextResponse.json({
      success: true,
      verified: proof.verified,
      proof,
      document: associatedRecord
        ? {
            documentNumber: associatedRecord.document_number,
            title: associatedRecord.document_title,
            organization: associatedRecord.org_name || 'Central Institutional Authority',
            createdAt: associatedRecord.doc_created_at,
          }
        : null,
      verificationAuthority: 'National Sovereign Cryptographic Document Repository (DMS-2026)',
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PUBLIC_VERIFY_API_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
