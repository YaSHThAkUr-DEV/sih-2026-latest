// =============================================================================
// Blockchain Ledger Sync & Re-Anchoring Tool
// =============================================================================
// Iterates through all existing documents and audit events in PostgreSQL
// and anchors any missing hashes into the active blockchain ledger.
//
// Run: npm run fabric:sync
// =============================================================================

import { query, pool } from '../lib/db';
import { BlockchainService } from '../lib/blockchain/service';

async function syncBlockchainLedger() {
  console.log('\n' + '='.repeat(80));
  console.log('  🏛️  HYPERLEDGER FABRIC LEDGER SYNCHRONIZATION TOOL');
  console.log('='.repeat(80));

  try {
    const status = await BlockchainService.getNetworkStatus();
    console.log(`\n[LEDGER_STATUS] Active Mode: ${status.mode.toUpperCase()}`);
    console.log(`[LEDGER_STATUS] Network:     ${status.networkName} (Channel: ${status.channelName})`);
    console.log(`[LEDGER_STATUS] Chaincode:   ${status.chaincodeName}`);
    console.log(`[LEDGER_STATUS] Total Prior: ${status.totalAnchored} anchored transactions\n`);

    // 1. Fetch all document versions with SHA-256 hashes
    console.log('--- 1. Scanning document versions in PostgreSQL ---');
    const docs = await query<{
      document_id: string;
      version_id: string;
      document_number: string;
      title: string;
      sha256_hash: string;
      organization_id: string;
      owner_id: string;
    }>(
      `SELECT d.id as document_id, dv.id as version_id, d.document_number,
              d.title, dv.sha256_hash, d.organization_id, d.owner_id
       FROM documents d
       JOIN document_versions dv ON d.id = dv.document_id
       WHERE dv.sha256_hash IS NOT NULL AND dv.status = 'ACTIVE'
       ORDER BY dv.created_at ASC;`
    );

    console.log(`Found ${docs.length} active document versions.`);

    // 2. Fetch all historical audit events
    console.log('\n--- 2. Scanning all historical system & officer audit logs ---');
    const auditLogs = await query<{
      id: string;
      event_type: string;
      event_hash: string;
      organization_id: string;
      actor_id: string | null;
      document_id: string | null;
      created_at: string;
    }>(
      `SELECT id, event_type, event_hash, organization_id, actor_id, document_id, created_at
       FROM audit_events
       WHERE event_hash IS NOT NULL
       ORDER BY created_at ASC;`
    );

    console.log(`Found ${auditLogs.length} historical audit log events.`);

    // 3. Fetch existing blockchain records to detect unanchored items
    const existingRecords = await query<{ payload_hash: string }>(
      `SELECT payload_hash FROM blockchain_records;`
    );
    const existingHashSet = new Set(existingRecords.map((r) => r.payload_hash));

    let docAnchored = 0;
    let auditAnchored = 0;
    let skippedCount = 0;

    // Anchor Document Hashes
    for (const doc of docs) {
      if (existingHashSet.has(doc.sha256_hash)) {
        skippedCount++;
        continue;
      }

      const auditRes = await query<{ id: string }>(
        `SELECT id FROM audit_events 
         WHERE document_id = $1 AND event_type = 'DOCUMENT_UPLOAD' 
         ORDER BY created_at DESC LIMIT 1;`,
        [doc.document_id]
      );

      const auditEventId = auditRes[0]?.id || doc.version_id;

      await BlockchainService.anchorHash({
        payloadHash: doc.sha256_hash,
        auditEventId,
        organizationId: doc.organization_id,
        documentId: doc.document_id,
        actorId: doc.owner_id,
        eventType: 'DOCUMENT_UPLOAD',
        metadata: {
          documentNumber: doc.document_number,
          title: doc.title,
          syncMigration: true,
          syncedAt: new Date().toISOString(),
        },
      });

      existingHashSet.add(doc.sha256_hash);
      docAnchored++;
    }

    // Anchor Audit Event Hashes
    for (const log of auditLogs) {
      if (existingHashSet.has(log.event_hash)) {
        skippedCount++;
        continue;
      }

      await BlockchainService.anchorHash({
        payloadHash: log.event_hash,
        auditEventId: log.id,
        organizationId: log.organization_id,
        documentId: log.document_id || undefined,
        actorId: log.actor_id || undefined,
        eventType: (log.event_type as any) || 'AUDIT_ATTESTATION',
        metadata: {
          originalTimestamp: log.created_at,
          syncMigration: true,
        },
      });

      existingHashSet.add(log.event_hash);
      auditAnchored++;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🎉 SYNCHRONIZATION COMPLETE!`);
    console.log(`   • Documents Anchored  : ${docAnchored}`);
    console.log(`   • Audit Logs Anchored : ${auditAnchored}`);
    console.log(`   • Total Anchored Now  : ${existingHashSet.size}`);
    console.log(`   • Already Synced/Skip : ${skippedCount}`);
    console.log('='.repeat(80) + '\n');
  } catch (err: any) {
    console.error('❌ Sync failed:', err);
  } finally {
    await pool.end();
  }
}

syncBlockchainLedger().catch(console.error);
