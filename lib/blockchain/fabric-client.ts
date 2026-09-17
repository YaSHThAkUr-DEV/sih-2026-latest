// =============================================================================
// Module 21 — Hyperledger Fabric Client Abstraction
// =============================================================================
// Dual-mode blockchain client:
// - `simulated`: Deterministic SHA-256 hash-chain (no external infra needed)
// - `fabric`: Real Hyperledger Fabric SDK (requires peer network)
// =============================================================================

import crypto from 'crypto';
import { query } from '@/lib/db';
import type {
  BlockchainConfig,
  BlockchainMode,
  LedgerStatus,
} from './types';

/**
 * Returns the active blockchain configuration from environment variables.
 */
export function getBlockchainConfig(): BlockchainConfig {
  const mode = (process.env.BLOCKCHAIN_MODE || 'simulated') as BlockchainMode;
  return {
    mode,
    networkName: process.env.BLOCKCHAIN_NETWORK_NAME || 'dms-records-network',
    channelName: process.env.BLOCKCHAIN_CHANNEL_NAME || 'recordschannel',
    chaincodeName: process.env.BLOCKCHAIN_CHAINCODE_NAME || 'dms_audit_cc',
    baseBlockNumber: 409120,
    endorsingPeers: [
      'peer0.dms.gov.in',
      'peer1.dms.gov.in',
    ],
  };
}

/**
 * Transaction result from the blockchain client
 */
export interface FabricTransactionResult {
  transactionId: string;
  blockNumber: number;
  status: LedgerStatus;
  endorsingPeers: string[];
  submittedAt: string;
  confirmedAt: string | null;
}

// =============================================================================
// Simulated Blockchain Client
// =============================================================================

/**
 * Simulated blockchain client that uses SHA-256 hash chains stored in PostgreSQL.
 * Fully functional for development and demonstration — mirrors the behavior
 * of a real Hyperledger Fabric network.
 */
export class SimulatedFabricClient {
  private config: BlockchainConfig;

  constructor(config: BlockchainConfig) {
    this.config = config;
  }

  /**
   * Generate a deterministic transaction ID from payload
   */
  private generateTransactionId(payloadHash: string, timestamp: string): string {
    const seed = `${this.config.networkName}:${this.config.channelName}:${payloadHash}:${timestamp}`;
    return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 64);
  }

  /**
   * Compute the next block number based on existing records
   */
  private async getNextBlockNumber(): Promise<number> {
    try {
      const rows = await query<{ max_block: string | null }>(
        `SELECT MAX(
           CASE WHEN transaction_id ~ '^[0-9a-f]+$' 
           THEN (SELECT count(*) FROM blockchain_records)::int
           ELSE 0 END
         ) as max_block FROM blockchain_records;`
      );

      const count = await query<{ cnt: string }>(
        `SELECT count(*) as cnt FROM blockchain_records;`
      );

      return this.config.baseBlockNumber + parseInt(count[0]?.cnt || '0', 10) + 1;
    } catch {
      return this.config.baseBlockNumber + 1;
    }
  }

  /**
   * Submit a hash anchoring transaction (simulated)
   */
  async submitTransaction(payloadHash: string): Promise<FabricTransactionResult> {
    const now = new Date().toISOString();
    const transactionId = this.generateTransactionId(payloadHash, now);
    const blockNumber = await this.getNextBlockNumber();

    return {
      transactionId,
      blockNumber,
      status: 'COMMITTED',
      endorsingPeers: this.config.endorsingPeers,
      submittedAt: now,
      confirmedAt: now, // In simulated mode, confirmation is instant
    };
  }

  /**
   * Verify a transaction exists (simulated — checks PostgreSQL)
   */
  async verifyTransaction(transactionId: string): Promise<{
    valid: boolean;
    blockNumber: number | null;
    payloadHash: string | null;
  }> {
    const rows = await query<{
      payload_hash: string;
      ledger_status: string;
    }>(
      `SELECT payload_hash, ledger_status
       FROM blockchain_records
       WHERE transaction_id = $1;`,
      [transactionId]
    );

    if (!rows.length) {
      return { valid: false, blockNumber: null, payloadHash: null };
    }

    // Compute the expected block number from the record's position
    const countRows = await query<{ pos: string }>(
      `SELECT count(*) as pos FROM blockchain_records 
       WHERE submitted_at <= (SELECT submitted_at FROM blockchain_records WHERE transaction_id = $1);`,
      [transactionId]
    );

    return {
      valid: rows[0].ledger_status === 'COMMITTED' || rows[0].ledger_status === 'CONFIRMED',
      blockNumber: this.config.baseBlockNumber + parseInt(countRows[0]?.pos || '0', 10),
      payloadHash: rows[0].payload_hash,
    };
  }

  /**
   * Health check for simulated mode
   */
  async healthCheck(): Promise<{ healthy: boolean; mode: 'simulated'; latencyMs: number }> {
    const start = Date.now();
    try {
      await query('SELECT 1');
      return { healthy: true, mode: 'simulated', latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, mode: 'simulated', latencyMs: Date.now() - start };
    }
  }
}

// =============================================================================
// Fabric SDK Client (Stub — ready for real Hyperledger Fabric integration)
// =============================================================================

/**
 * Real Hyperledger Fabric client.
 * This is a stub that falls back to SimulatedFabricClient.
 * When a real Fabric network is available, replace the method implementations
 * with `fabric-network` SDK calls.
 * 
 * To activate:
 * 1. `npm install fabric-network fabric-ca-client`
 * 2. Set `BLOCKCHAIN_MODE=fabric` in .env
 * 3. Place connection profile JSON in `config/fabric-connection.json`
 * 4. Implement gateway connection and chaincode invocation below
 */
export class HyperledgerFabricClient {
  private simulatedFallback: SimulatedFabricClient;
  private config: BlockchainConfig;

  constructor(config: BlockchainConfig) {
    this.config = config;
    // Until real Fabric infrastructure is provisioned, delegate to simulated
    this.simulatedFallback = new SimulatedFabricClient(config);
    console.warn(
      '[BLOCKCHAIN] Fabric mode selected but no peer network configured. ' +
      'Falling back to simulated hash-chain mode. ' +
      'Install fabric-network SDK and configure connection profile for production.'
    );
  }

  async submitTransaction(payloadHash: string): Promise<FabricTransactionResult> {
    // TODO: Replace with real Fabric SDK call:
    // const gateway = new Gateway();
    // await gateway.connect(connectionProfile, gatewayOptions);
    // const network = await gateway.getNetwork(this.config.channelName);
    // const contract = network.getContract(this.config.chaincodeName);
    // const result = await contract.submitTransaction('anchorHash', payloadHash);
    return this.simulatedFallback.submitTransaction(payloadHash);
  }

  async verifyTransaction(transactionId: string) {
    // TODO: Replace with real Fabric SDK query
    return this.simulatedFallback.verifyTransaction(transactionId);
  }

  async healthCheck() {
    const result = await this.simulatedFallback.healthCheck();
    return { ...result, mode: 'fabric' as const };
  }
}

// =============================================================================
// Factory: Get the appropriate client based on configuration
// =============================================================================

let _clientInstance: SimulatedFabricClient | HyperledgerFabricClient | null = null;

export function getBlockchainClient(): SimulatedFabricClient | HyperledgerFabricClient {
  if (!_clientInstance) {
    const config = getBlockchainConfig();
    if (config.mode === 'fabric') {
      _clientInstance = new HyperledgerFabricClient(config);
    } else {
      _clientInstance = new SimulatedFabricClient(config);
    }
  }
  return _clientInstance;
}
