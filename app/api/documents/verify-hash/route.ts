import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { isSuperAdmin, getMaxSecurityLevel } from '@/lib/auth/rbac';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { hashOrNumber } = await req.json();
    const term = (hashOrNumber || '').trim();

    if (!term) {
      return NextResponse.json({ error: 'Please enter a SHA-256 hash or Document Number.' }, { status: 400 });
    }

    const superAdmin = isSuperAdmin(session);
    const maxRank = getMaxSecurityLevel(session);

    // 1. Check Active Document Vault (document_versions JOIN documents)
    const rows = await query(
      `SELECT 
         dv.id as version_id,
         dv.version_number,
         dv.sha256_hash,
         dv.file_name,
         dv.file_size,
         dv.encryption_algorithm,
         dv.status as version_status,
         dv.created_at,
         d.id as document_id,
         d.document_number,
         d.title,
         sl.rank as security_rank,
         sl.code as security_tier,
         sl.name as security_tier_name,
         dep.name as department_name,
         u.full_name as created_by_name
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       JOIN security_levels sl ON d.security_level_id = sl.id
       JOIN departments dep ON d.department_id = dep.id
       JOIN users u ON dv.created_by = u.id
       WHERE (LOWER(dv.sha256_hash) = LOWER($1) OR LOWER(d.document_number) = LOWER($1))
         AND ($2 = TRUE OR d.organization_id = $3)
         AND sl.rank <= $4
       LIMIT 1`,
      [term, superAdmin, session.organizationId, maxRank]
    );

    if (rows.length > 0) {
      const doc = rows[0];
      return NextResponse.json({
        verified: true,
        proofOfExistence: true,
        vaultStatus: 'ACTIVE_IN_VAULT',
        document: {
          documentNumber: doc.document_number,
          title: doc.title,
          version: `v${doc.version_number}.0`,
          sha256Hash: doc.sha256_hash,
          fileName: doc.file_name,
          fileSize: `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB`,
          encryption: doc.encryption_algorithm,
          securityTier: `${doc.security_tier} (${doc.security_tier_name})`,
          department: doc.department_name,
          officer: doc.created_by_name,
          timestamp: doc.created_at,
        },
        message: `Attestation Verified: Document ${doc.document_number} matches the active vault copy and registered SHA-256 digest.`,
      });
    }

    // 2. Proof of Existence Fallback: Check Immutable Blockchain Ledger
    const blockchainRows = await query<any>(
      `SELECT br.id, br.transaction_id, br.payload_hash, br.ledger_status, br.submitted_at, br.confirmed_at,
              br.network_name, br.channel_name, br.chaincode_name,
              ae.event_type, ae.actor_id, ae.created_at as event_created_at,
              org.name as org_name, org.code as org_code,
              u.full_name as officer_name, u.designation as officer_designation
       FROM blockchain_records br
       LEFT JOIN audit_events ae ON br.audit_event_id = ae.id
       LEFT JOIN organizations org ON ae.organization_id = org.id
       LEFT JOIN users u ON ae.actor_id = u.id
       WHERE (LOWER(br.payload_hash) = LOWER($1) OR LOWER(br.transaction_id) = LOWER($1))
       LIMIT 1;`,
      [term]
    );

    if (blockchainRows.length > 0) {
      const bRecord = blockchainRows[0];
      return NextResponse.json({
        verified: true,
        proofOfExistence: true,
        isHistoricalLedgerProof: true,
        vaultStatus: 'PURGED_OR_OFFLINE',
        blockchain: {
          transactionId: bRecord.transaction_id,
          payloadHash: bRecord.payload_hash,
          status: bRecord.ledger_status,
          timestamp: bRecord.confirmed_at || bRecord.submitted_at,
          networkName: bRecord.network_name,
          channelName: bRecord.channel_name,
          chaincode: bRecord.chaincode_name,
          anchoredBy: bRecord.officer_name || 'Authorized Officer',
          organization: bRecord.org_name ? `${bRecord.org_name} (${bRecord.org_code})` : 'Sovereign Federation Node',
        },
        message: `Proof of Existence Confirmed: Hash ${bRecord.payload_hash.substring(0, 16)}... is immutably anchored on the Sovereign Blockchain Ledger (TX: ${bRecord.transaction_id.substring(0, 16)}...). The active vault copy was pruned, but its authentic historical existence and timestamp are permanently proven.`,
      });
    }

    // 3. Not Found in Vault or Blockchain
    return NextResponse.json({
      verified: false,
      proofOfExistence: false,
      message: 'No matching document, vault record, or cryptographic blockchain anchor found in the national registry. Possible unregistered or tampered file.',
    });
  } catch (err: any) {
    console.error('Verify hash error:', err);
    return NextResponse.json({ error: 'Verification service error' }, { status: 500 });
  }
}
