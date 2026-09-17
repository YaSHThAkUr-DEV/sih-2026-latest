// =============================================================================
// Module 21 — Hyperledger Fabric Integrity: TypeScript Interfaces
// =============================================================================

/**
 * Blockchain operating mode.
 * - `simulated`: SHA-256 hash-chain anchoring in PostgreSQL (for dev/demo)
 * - `fabric`: Real Hyperledger Fabric network via fabric-network SDK
 */
export type BlockchainMode = 'simulated' | 'fabric';

/**
 * Evidentiary event types that trigger blockchain anchoring
 */
export type AnchorEventType =
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_APPROVAL'
  | 'DOCUMENT_REJECTION'
  | 'DOCUMENT_DELETION'
  | 'LEGAL_HOLD_ENFORCEMENT'
  | 'AUDIT_ATTESTATION'
  | 'VERSION_PROMOTION'
  | 'CRYPTO_SHRED';

/**
 * Ledger status for a blockchain record
 */
export type LedgerStatus = 'PENDING' | 'SUBMITTED' | 'COMMITTED' | 'CONFIRMED' | 'FAILED';

/**
 * Input parameters for anchoring a hash to the blockchain
 */
export interface AnchorRequest {
  /** The audit_events.id that this anchoring is tied to */
  auditEventId: string;
  /** SHA-256 hash of the evidentiary payload being anchored */
  payloadHash: string;
  /** Optional document reference */
  documentId?: string;
  /** The evidentiary event that triggered anchoring */
  eventType: AnchorEventType;
  /** Actor who triggered the event */
  actorId?: string;
  /** Organization ID */
  organizationId: string;
  /** Additional metadata to include in the transaction */
  metadata?: Record<string, any>;
}

/**
 * Receipt returned after successful hash anchoring
 */
export interface AnchorReceipt {
  /** Unique blockchain transaction ID */
  transactionId: string;
  /** Block number in the ledger */
  blockNumber: number;
  /** Channel name (Hyperledger concept) */
  channelName: string;
  /** Chaincode / smart contract name */
  chaincodeName: string;
  /** Network name */
  networkName: string;
  /** The anchored payload hash */
  payloadHash: string;
  /** Current ledger status */
  ledgerStatus: LedgerStatus;
  /** Endorsing peer nodes */
  endorsingPeers: string[];
  /** When the transaction was submitted */
  submittedAt: string;
  /** When the transaction was confirmed (may be null if pending) */
  confirmedAt: string | null;
  /** The blockchain_records.id in PostgreSQL */
  recordId: string;
}

/**
 * Verification proof returned when verifying a transaction
 */
export interface TransactionProof {
  /** The transaction ID that was verified */
  transactionId: string;
  /** Whether the transaction is valid and untampered */
  verified: boolean;
  /** The original payload hash that was anchored */
  payloadHash: string;
  /** Recomputed Merkle root from the proof path */
  merkleRoot: string;
  /** Block number */
  blockNumber: number;
  /** Endorsing peer nodes that signed this transaction */
  endorsingPeers: string[];
  /** Ledger status */
  ledgerStatus: LedgerStatus;
  /** Timestamp of verification */
  verifiedAt: string;
  /** Any error or discrepancy message */
  discrepancy?: string;
}

/**
 * Blockchain network configuration
 */
export interface BlockchainConfig {
  mode: BlockchainMode;
  networkName: string;
  channelName: string;
  chaincodeName: string;
  /** Simulated mode: base block number offset */
  baseBlockNumber: number;
  /** Endorsing peer identities */
  endorsingPeers: string[];
}

/**
 * Blockchain network health / status
 */
export interface BlockchainNetworkStatus {
  mode: BlockchainMode;
  networkName: string;
  channelName: string;
  chaincodeName: string;
  healthy: boolean;
  totalAnchored: number;
  totalPending: number;
  totalFailed: number;
  lastBlockNumber: number | null;
  lastTransactionId: string | null;
  lastAnchoredAt: string | null;
  endorsingPeers: string[];
}

/**
 * Payload for the blockchain-queue job
 */
export interface BlockchainAnchorPayload {
  auditEventId: string;
  payloadHash: string;
  documentId?: string;
  eventType: AnchorEventType;
  actorId?: string;
  organizationId: string;
  metadata?: Record<string, any>;
}
