// =============================================================================
// Hyperledger Fabric Chaincode: dms_audit_cc (TypeScript / Fabric Contract API)
// =============================================================================
// Implements immutable audit hash anchoring, transaction lookup, and reverse
// payload hash queries for sovereign document authenticity verification.
// =============================================================================

export interface AnchorRecord {
  docId?: string;
  payloadHash: string;
  eventType: string;
  txId: string;
  timestamp: string;
  creatorMsp: string;
  metadata?: Record<string, any>;
}

export class DmsAuditContract {
  /**
   * Anchor a SHA-256 payload digest onto the immutable ledger state
   */
  async anchorHash(
    ctx: any,
    docId: string,
    payloadHash: string,
    eventType: string,
    metadataJson?: string
  ): Promise<string> {
    const txId = ctx.stub.getTxID ? ctx.stub.getTxID() : ctx.txId;
    const txTimestamp = ctx.stub.getTxTimestamp ? ctx.stub.getTxTimestamp() : new Date().toISOString();
    const creatorMsp = ctx.clientIdentity ? ctx.clientIdentity.getMSPID() : 'Org1MSP';

    let metadata = {};
    if (metadataJson) {
      try {
        metadata = JSON.parse(metadataJson);
      } catch {
        // ignore
      }
    }

    const record: AnchorRecord = {
      docId,
      payloadHash,
      eventType,
      txId,
      timestamp: typeof txTimestamp === 'string' ? txTimestamp : new Date().toISOString(),
      creatorMsp,
      metadata,
    };

    const recordBuffer = Buffer.from(JSON.stringify(record));

    // 1. Store primary state indexed by TxID
    await ctx.stub.putState(txId, recordBuffer);

    // 2. Index by SHA-256 payload hash for reverse lookup
    await ctx.stub.putState(`hash~${payloadHash}`, Buffer.from(txId));

    // 3. Index by Document ID for audit trail lookup
    if (docId) {
      await ctx.stub.putState(`doc~${docId}~${txId}`, recordBuffer);
    }

    return JSON.stringify(record);
  }

  /**
   * Query transaction record by Transaction ID
   */
  async queryTransaction(ctx: any, txId: string): Promise<string> {
    const bytes = await ctx.stub.getState(txId);
    if (!bytes || bytes.length === 0) {
      throw new Error(`Transaction ${txId} does not exist in blockchain ledger`);
    }
    return bytes.toString();
  }

  /**
   * Query transaction record by Payload SHA-256 Hash
   */
  async queryByHash(ctx: any, payloadHash: string): Promise<string> {
    const txIdBytes = await ctx.stub.getState(`hash~${payloadHash}`);
    if (!txIdBytes || txIdBytes.length === 0) {
      throw new Error(`No transaction anchored with payload hash ${payloadHash}`);
    }
    const txId = txIdBytes.toString();
    return this.queryTransaction(ctx, txId);
  }

  /**
   * Health probe for chaincode
   */
  async ping(): Promise<string> {
    return JSON.stringify({
      status: 'ONLINE',
      chaincode: 'dms_audit_cc',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }
}
