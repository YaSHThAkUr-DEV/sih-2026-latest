// =============================================================================
// Module 21 — Blockchain Service: Core Hash Anchoring & Verification
// =============================================================================
// High-level service that orchestrates hash anchoring, verification, and
// transaction receipt management. Uses the blockchain_records table as the
// persistent ledger of all anchored transactions.
// =============================================================================

import crypto from 'crypto';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';
import { getBlockchainClient, getBlockchainConfig } from './fabric-client';
import type {
  AnchorRequest,
  AnchorReceipt,
  TransactionProof,
  BlockchainNetworkStatus,
  LedgerStatus,
} from './types';

export class BlockchainService {
  // ===========================================================================
  // 1. ANCHOR HASH — Record a document/event hash on the blockchain ledger
  // ===========================================================================

  /**
   * Anchor a SHA-256 payload hash to the blockchain ledger.
   * This is the primary entry point for all hash anchoring operations.
   *
   * @param request - The anchoring request parameters
   * @returns AnchorReceipt with transaction details
   */
  public static async anchorHash(request: AnchorRequest): Promise<AnchorReceipt> {
    const config = getBlockchainConfig();
    const client = getBlockchainClient();

    // 1. Submit transaction to blockchain (simulated or real Fabric)
    const txResult = await client.submitTransaction(request.payloadHash);

    // 2. Ensure a valid auditEventId exists for foreign key integrity
    let validAuditEventId = request.auditEventId;
    if (validAuditEventId) {
      const checkAudit = await query<{ id: string }>(
        'SELECT id FROM audit_events WHERE id = $1 LIMIT 1;',
        [validAuditEventId]
      );
      if (!checkAudit.length) {
        validAuditEventId = '';
      }
    }

    if (!validAuditEventId) {
      validAuditEventId = await logAuditEvent({
        organizationId: request.organizationId,
        actorId: request.actorId || null,
        eventType: request.eventType || 'BLOCKCHAIN_ANCHOR',
        resourceType: 'BLOCKCHAIN',
        documentId: request.documentId,
        result: 'SUCCESS',
        metadata: {
          transactionId: txResult.transactionId,
          payloadHash: request.payloadHash,
          autoCreated: true,
          ...request.metadata,
        },
      });
    }

    // 3. Persist the anchoring record in blockchain_records table
    const recordId = crypto.randomUUID();
    try {
      await query(
        `INSERT INTO blockchain_records (
           id, audit_event_id, network_name, channel_name, chaincode_name,
           transaction_id, payload_hash, ledger_status, submitted_at, confirmed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (audit_event_id) DO UPDATE SET
           transaction_id = EXCLUDED.transaction_id,
           payload_hash = EXCLUDED.payload_hash,
           ledger_status = EXCLUDED.ledger_status,
           submitted_at = EXCLUDED.submitted_at,
           confirmed_at = EXCLUDED.confirmed_at;`,
        [
          recordId,
          validAuditEventId,
          config.networkName,
          config.channelName,
          config.chaincodeName,
          txResult.transactionId,
          request.payloadHash,
          txResult.status,
          txResult.submittedAt,
          txResult.confirmedAt,
        ]
      );
    } catch (dbErr: any) {
      console.error('[BLOCKCHAIN_SERVICE] Failed to persist blockchain record:', dbErr.message);
      throw new Error(`Blockchain record persistence failed: ${dbErr.message}`);
    }

    // 3. Log the anchoring as an audit event
    try {
      await logAuditEvent({
        organizationId: request.organizationId,
        actorId: request.actorId || null,
        eventType: 'BLOCKCHAIN_ANCHOR',
        resourceType: 'BLOCKCHAIN',
        resourceId: recordId,
        documentId: request.documentId,
        result: 'SUCCESS',
        metadata: {
          transactionId: txResult.transactionId,
          blockNumber: txResult.blockNumber,
          payloadHash: request.payloadHash,
          eventType: request.eventType,
          channelName: config.channelName,
          chaincodeName: config.chaincodeName,
          endorsingPeers: txResult.endorsingPeers,
          mode: config.mode,
          ...request.metadata,
        },
      });
    } catch {
      // Audit logging failure should not break the anchoring flow
    }

    return {
      transactionId: txResult.transactionId,
      blockNumber: txResult.blockNumber,
      channelName: config.channelName,
      chaincodeName: config.chaincodeName,
      networkName: config.networkName,
      payloadHash: request.payloadHash,
      ledgerStatus: txResult.status,
      endorsingPeers: txResult.endorsingPeers,
      submittedAt: txResult.submittedAt,
      confirmedAt: txResult.confirmedAt,
      recordId,
    };
  }

  // ===========================================================================
  // 2. VERIFY TRANSACTION — Cryptographic verification of an anchored tx
  // ===========================================================================

  /**
   * Verify a previously anchored transaction.
   * Looks up the blockchain_records table, re-validates the payload hash,
   * and computes a Merkle root proof.
   */
  public static async verifyTransaction(transactionId: string): Promise<TransactionProof> {
    const config = getBlockchainConfig();

    // 1. Look up the transaction in blockchain_records
    const rows = await query<{
      id: string;
      audit_event_id: string;
      payload_hash: string;
      ledger_status: string;
      network_name: string;
      channel_name: string;
      chaincode_name: string;
      submitted_at: string;
      confirmed_at: string | null;
    }>(
      `SELECT id, audit_event_id, payload_hash, ledger_status,
              network_name, channel_name, chaincode_name,
              submitted_at, confirmed_at
       FROM blockchain_records
       WHERE transaction_id = $1;`,
      [transactionId]
    );

    if (!rows.length) {
      return {
        transactionId,
        verified: false,
        payloadHash: '',
        merkleRoot: '',
        blockNumber: 0,
        endorsingPeers: [],
        ledgerStatus: 'FAILED',
        verifiedAt: new Date().toISOString(),
        discrepancy: 'Transaction not found in ledger',
      };
    }

    const record = rows[0];

    // 2. Verify via blockchain client
    const client = getBlockchainClient();
    const verification = await client.verifyTransaction(transactionId);

    // 3. Compute Merkle root from all anchored hashes up to this transaction
    const allHashes = await query<{ payload_hash: string }>(
      `SELECT payload_hash FROM blockchain_records
       WHERE submitted_at <= $1
       ORDER BY submitted_at ASC;`,
      [record.submitted_at]
    );

    let currentLevel = allHashes.map(r => r.payload_hash);
    if (currentLevel.length === 0) {
      currentLevel = [crypto.createHash('sha256').update('GENESIS_BLOCK_DMS_2026').digest('hex')];
    }

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        nextLevel.push(crypto.createHash('sha256').update(left + right).digest('hex'));
      }
      currentLevel = nextLevel;
    }

    const merkleRoot = '0x' + currentLevel[0].toUpperCase();

    // 4. Cross-check payload hash integrity
    const hashMatch = verification.payloadHash === record.payload_hash;

    return {
      transactionId,
      verified: verification.valid && hashMatch,
      payloadHash: record.payload_hash,
      merkleRoot,
      blockNumber: verification.blockNumber || 0,
      endorsingPeers: config.endorsingPeers,
      ledgerStatus: record.ledger_status as LedgerStatus,
      verifiedAt: new Date().toISOString(),
      discrepancy: !hashMatch ? 'Payload hash mismatch detected — possible tampering' : undefined,
    };
  }

  // ===========================================================================
  // 3. GET TRANSACTION RECEIPT
  // ===========================================================================

  /**
   * Get the full receipt for a blockchain transaction
   */
  public static async getTransactionReceipt(transactionId: string): Promise<AnchorReceipt | null> {
    const rows = await query<{
      id: string;
      audit_event_id: string;
      network_name: string;
      channel_name: string;
      chaincode_name: string;
      transaction_id: string;
      payload_hash: string;
      ledger_status: string;
      submitted_at: string;
      confirmed_at: string | null;
    }>(
      `SELECT id, audit_event_id, network_name, channel_name, chaincode_name,
              transaction_id, payload_hash, ledger_status, submitted_at, confirmed_at
       FROM blockchain_records
       WHERE transaction_id = $1;`,
      [transactionId]
    );

    if (!rows.length) return null;

    const r = rows[0];
    const config = getBlockchainConfig();

    // Compute block number from position
    const countRows = await query<{ pos: string }>(
      `SELECT count(*) as pos FROM blockchain_records
       WHERE submitted_at <= $1;`,
      [r.submitted_at]
    );

    return {
      transactionId: r.transaction_id,
      blockNumber: config.baseBlockNumber + parseInt(countRows[0]?.pos || '0', 10),
      channelName: r.channel_name || config.channelName,
      chaincodeName: r.chaincode_name || config.chaincodeName,
      networkName: r.network_name,
      payloadHash: r.payload_hash,
      ledgerStatus: r.ledger_status as LedgerStatus,
      endorsingPeers: config.endorsingPeers,
      submittedAt: r.submitted_at,
      confirmedAt: r.confirmed_at,
      recordId: r.id,
    };
  }

  // ===========================================================================
  // 4. GET ANCHOR HISTORY FOR A DOCUMENT
  // ===========================================================================

  /**
   * Get all blockchain anchoring records associated with a document
   */
  public static async getAnchorHistory(documentId: string): Promise<AnchorReceipt[]> {
    const config = getBlockchainConfig();

    // Join blockchain_records with audit_events to find document-specific anchors
    const rows = await query<{
      id: string;
      audit_event_id: string;
      network_name: string;
      channel_name: string;
      chaincode_name: string;
      transaction_id: string;
      payload_hash: string;
      ledger_status: string;
      submitted_at: string;
      confirmed_at: string | null;
    }>(
      `SELECT br.id, br.audit_event_id, br.network_name, br.channel_name,
              br.chaincode_name, br.transaction_id, br.payload_hash,
              br.ledger_status, br.submitted_at, br.confirmed_at
       FROM blockchain_records br
       JOIN audit_events ae ON br.audit_event_id = ae.id
       WHERE ae.document_id = $1::uuid
       ORDER BY br.submitted_at DESC;`,
      [documentId]
    );

    return rows.map((r, idx) => ({
      transactionId: r.transaction_id,
      blockNumber: config.baseBlockNumber + (rows.length - idx),
      channelName: r.channel_name || config.channelName,
      chaincodeName: r.chaincode_name || config.chaincodeName,
      networkName: r.network_name,
      payloadHash: r.payload_hash,
      ledgerStatus: r.ledger_status as LedgerStatus,
      endorsingPeers: config.endorsingPeers,
      submittedAt: r.submitted_at,
      confirmedAt: r.confirmed_at,
      recordId: r.id,
    }));
  }

  // ===========================================================================
  // 5. NETWORK STATUS & HEALTH
  // ===========================================================================

  /**
   * Get blockchain network status and statistics
   */
  public static async getNetworkStatus(): Promise<BlockchainNetworkStatus> {
    const config = getBlockchainConfig();
    const client = getBlockchainClient();

    // Health check
    const health = await client.healthCheck();

    // Statistics from blockchain_records
    const stats = await query<{
      total: string;
      pending: string;
      failed: string;
      last_tx: string | null;
      last_block: string | null;
      last_at: string | null;
    }>(
      `SELECT 
         count(*) as total,
         count(*) FILTER (WHERE ledger_status = 'PENDING') as pending,
         count(*) FILTER (WHERE ledger_status = 'FAILED') as failed,
         (SELECT transaction_id FROM blockchain_records ORDER BY submitted_at DESC LIMIT 1) as last_tx,
         (SELECT count(*) FROM blockchain_records)::text as last_block,
         (SELECT submitted_at::text FROM blockchain_records ORDER BY submitted_at DESC LIMIT 1) as last_at
       FROM blockchain_records;`
    );

    const s = stats[0];

    return {
      mode: config.mode,
      networkName: config.networkName,
      channelName: config.channelName,
      chaincodeName: config.chaincodeName,
      healthy: health.healthy,
      totalAnchored: parseInt(s?.total || '0', 10),
      totalPending: parseInt(s?.pending || '0', 10),
      totalFailed: parseInt(s?.failed || '0', 10),
      lastBlockNumber: s?.last_block ? config.baseBlockNumber + parseInt(s.last_block, 10) : null,
      lastTransactionId: s?.last_tx || null,
      lastAnchoredAt: s?.last_at || null,
      endorsingPeers: config.endorsingPeers,
    };
  }
}
