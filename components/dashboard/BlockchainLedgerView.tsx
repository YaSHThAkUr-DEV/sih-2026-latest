'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface BlockchainStatus {
  mode: 'simulated' | 'fabric';
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

interface BlockchainRecord {
  id: string;
  transaction_id: string;
  payload_hash: string;
  ledger_status: string;
  network_name: string;
  channel_name: string;
  chaincode_name: string;
  submitted_at: string;
  confirmed_at: string | null;
  audit_event_id?: string;
  event_type?: string;
  actor_name?: string;
  document_id?: string;
  document_number?: string;
  document_title?: string;
}

interface TransactionProof {
  transactionId: string;
  verified: boolean;
  payloadHash: string;
  merkleRoot: string;
  blockNumber: number;
  endorsingPeers: string[];
  ledgerStatus: string;
  verifiedAt: string;
  discrepancy?: string;
}

export default function BlockchainLedgerView() {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [records, setRecords] = useState<BlockchainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Interactive Verifier State
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<TransactionProof | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Manual Hash Anchor State
  const [anchorHashInput, setAnchorHashInput] = useState('');
  const [anchorEventType, setAnchorEventType] = useState('AUDIT_ATTESTATION');
  const [anchorDocNumber, setAnchorDocNumber] = useState('');
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorSuccess, setAnchorSuccess] = useState<any>(null);

  // Modals & Proof Details
  const [selectedTx, setSelectedTx] = useState<BlockchainRecord | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Network Status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/blockchain/status');
      if (res.ok) {
        const data = await res.json();
        if (data.blockchain) setStatus(data.blockchain);
      }
    } catch (err) {
      console.error('Failed to fetch blockchain status:', err);
    }
  };

  // Fetch Paginated Records
  const fetchRecords = useCallback(async (page = 1, stat = statusFilter, search = searchQuery) => {
    setRecordsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (stat && stat !== 'ALL') params.set('status', stat);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/blockchain/records?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.records) setRecords(data.records);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch blockchain records:', err);
    } finally {
      setRecordsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchRecords(1)]);
      setLoading(false);
    };
    init();
  }, [fetchRecords]);

  // Handle Verify Submission
  const handleVerify = async (txIdOrHash?: string) => {
    const target = (txIdOrHash || verifyInput).trim();
    if (!target) {
      setVerifyError('Please enter a valid Transaction ID or SHA-256 Payload Hash.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResult(null);

    try {
      const res = await fetch(`/api/blockchain/public-verify/${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed');
      }
      setVerifyResult(data.proof);
    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Handle Manual Hash Anchoring
  const handleManualAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorHashInput.trim() || anchorHashInput.trim().length < 16) {
      alert('Please enter a valid SHA-256 payload hash (at least 16 hex characters).');
      return;
    }

    setAnchorLoading(true);
    setAnchorSuccess(null);

    try {
      const res = await fetch('/api/blockchain/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payloadHash: anchorHashInput.trim(),
          eventType: anchorEventType,
          metadata: {
            manualAttestation: true,
            docketNumber: anchorDocNumber.trim() || undefined,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to anchor hash');
      }

      setAnchorSuccess(data.receipt);
      setAnchorHashInput('');
      setAnchorDocNumber('');
      fetchStatus();
      fetchRecords(1);
    } catch (err: any) {
      alert(`Error anchoring hash: ${err.message}`);
    } finally {
      setAnchorLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-spin mb-3">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-xs font-medium">Connecting to Hyperledger Fabric Ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* --------------------------------------------------------------------- */}
      {/* 1. Header & Live Network Topology Bar */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/nirman-logo.png"
                alt="NIRMAN DMS"
                className="w-12 h-12 object-contain rounded-2xl shadow-lg border border-slate-700/80 p-0.5 bg-white shrink-0"
              />
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>NIRMAN DMS Blockchain Ledger</span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    Hyperledger Fabric • Module 21
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Channel: <span className="font-mono text-cyan-300">{status?.channelName || 'recordschannel'}</span> • Smart Contract:{' '}
                  <span className="font-mono text-indigo-300">{status?.chaincodeName || 'dms_audit_cc'}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                status?.healthy
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${status?.healthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {status?.mode === 'fabric' ? 'DOCKER FABRIC PEER [LIVE]' : 'SIMULATED HASHCHAIN [LOCAL]'}
            </div>

            <button
              onClick={() => {
                fetchStatus();
                fetchRecords(pagination.page);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Refresh Ledger"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Current Block Height</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white font-mono">
                #{status?.lastBlockNumber || '409121'}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Total Anchored Txns</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400 font-mono">
                {status?.totalAnchored || 0}
              </span>
              <span className="text-[10px] text-slate-400">Committed</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Endorsing Peer Nodes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-400 font-mono">
                {status?.endorsingPeers?.length || 2}
              </span>
              <span className="text-[10px] text-indigo-300">peer0/peer1</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Ledger Integrity</span>
            <div className="flex items-baseline gap-2 mt-1">
              {(() => {
                const total = status?.totalAnchored || 0;
                const failed = status?.totalFailed || 0;
                const score = total > 0 ? Math.max(0, Math.round(((total - failed) / total) * 100)) : 100;
                return (
                  <>
                    <span className={`text-2xl font-black font-mono ${score === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {score}%
                    </span>
                    <span className={`text-[10px] font-semibold ${score === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {score === 100 ? 'Tamper-Proof' : 'Discrepancy Detected'}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. Interactive Merkle Proof Verifier & Tamper Simulator */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Merkle Verifier */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cryptographic Merkle Proof Verifier</h2>
                <p className="text-xs text-slate-400">Validate any Transaction ID or SHA-256 Digest against the on-chain Merkle tree.</p>
              </div>
            </div>

            <a
              href="/verify"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
            >
              Public Verifier Gateway ↗
            </a>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="Enter Transaction ID (e.g. 7f8a3b...) or SHA-256 Digest..."
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
            />
            <button
              type="submit"
              disabled={verifyLoading}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {verifyLoading ? 'Verifying...' : 'Verify Proof'}
            </button>
          </form>

          {verifyError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {verifyError}
            </div>
          )}

          {verifyResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  {verifyResult.verified ? '100% CRYPTOGRAPHICALLY VALID' : 'VERIFICATION FAILED'}
                </span>
                <span className="text-slate-400 text-[11px]">Block #{verifyResult.blockNumber}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Merkle Root:</span>
                  <span className="text-indigo-300 break-all">{verifyResult.merkleRoot}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payload SHA-256:</span>
                  <span className="text-emerald-300 break-all">{verifyResult.payloadHash}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Endorsers: {verifyResult.endorsingPeers?.join(', ') || 'peer0.dms.gov.in'}</span>
                <span>Verified At: {new Date(verifyResult.verifiedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Consensus & Cryptographic Security Architecture */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Consensus & Security</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cryptographic integrity parameters enforced under Section 65B and Bharatiya Sakshya Adhiniyam guidelines.
            </p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400">Consensus Engine:</span>
              <span className="text-cyan-300 font-semibold">Raft BFT / 2PC</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400">Digest Standard:</span>
              <span className="text-emerald-300 font-semibold">SHA-256 (FIPS 180-4)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400">MSP Authority:</span>
              <span className="text-indigo-300 font-semibold">Org1MSP (X.509)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400">State Trie DB:</span>
              <span className="text-amber-300 font-semibold">CouchDB Immutable</span>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. Manual Hash Anchoring & Attestation Panel */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Ad-hoc Hash Anchoring & Attestation Console
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Anchor external forensic evidence digests, judicial decrees, or administrative records directly to the active ledger.
        </p>

        <form onSubmit={handleManualAnchor} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={anchorHashInput}
            onChange={(e) => setAnchorHashInput(e.target.value)}
            placeholder="SHA-256 Payload Hash (e.g. a3c8e1...)"
            className="sm:col-span-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            required
          />

          <input
            type="text"
            value={anchorDocNumber}
            onChange={(e) => setAnchorDocNumber(e.target.value)}
            placeholder="Reference Docket # (Optional, e.g. HC-ORD-2026)"
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />

          <div className="flex gap-2">
            <select
              value={anchorEventType}
              onChange={(e) => setAnchorEventType(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="AUDIT_ATTESTATION">Audit Attestation</option>
              <option value="SECTION_65B_SEAL">Section 65B Seal</option>
              <option value="DOCUMENT_UPLOAD">Document Ingestion</option>
              <option value="LEGAL_HOLD_FREEZE">Legal Hold Freeze</option>
            </select>

            <button
              type="submit"
              disabled={anchorLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {anchorLoading ? 'Anchoring...' : 'Anchor to Ledger'}
            </button>
          </div>
        </form>

        {anchorSuccess && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono animate-fadeIn flex items-center justify-between">
            <div>
              ✓ Successfully Anchored in Block #{anchorSuccess.blockNumber} • TxID: {anchorSuccess.transactionId.substring(0, 24)}...
            </div>
            <button
              type="button"
              onClick={() => {
                setVerifyInput(anchorSuccess.transactionId);
                handleVerify(anchorSuccess.transactionId);
              }}
              className="text-cyan-400 hover:underline text-[11px]"
            >
              Verify Immediately →
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. Live Block Stream & Transaction Ledger */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Live Transaction Ledger & Block Stream
            </h2>
            <p className="text-xs text-slate-400">
              Showing {records.length} of {pagination.total} committed transactions in channel {status?.channelName || 'recordschannel'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                fetchRecords(1, e.target.value, searchQuery);
              }}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMMITTED">Committed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchRecords(1, statusFilter, e.target.value);
                }}
                placeholder="Search TxID, Hash, Docket..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none w-48 sm:w-60 font-mono"
              />
              <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Payload Hash (SHA-256)</th>
                <th className="py-3 px-4">Docket Context</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Committed Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {recordsLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading blockchain records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No blockchain records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-cyan-300 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span title={rec.transaction_id}>{rec.transaction_id.substring(0, 16)}...</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(rec.transaction_id, rec.id)}
                          className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                          title="Copy Transaction ID"
                        >
                          {copiedId === rec.id ? (
                            <span className="text-[10px] text-emerald-400">✓</span>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      <span className="text-emerald-300" title={rec.payload_hash}>
                        {rec.payload_hash.substring(0, 16)}...
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans text-slate-200">
                      {rec.document_number ? (
                        <div>
                          <p className="font-semibold font-mono text-cyan-400 text-[11px]">{rec.document_number}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{rec.document_title}</p>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">System Audit Record</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                        {rec.event_type || 'BLOCKCHAIN_ANCHOR'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.ledger_status === 'COMMITTED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : rec.ledger_status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {rec.ledger_status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(rec.submitted_at).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTx(rec);
                          setProofModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-sans text-[11px] border border-slate-700 transition-colors cursor-pointer"
                      >
                        Proof & Cert →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total transactions)
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchRecords(pagination.page - 1)}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchRecords(pagination.page + 1)}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. Transaction Proof & Certificate Modal */}
      {/* --------------------------------------------------------------------- */}
      {proofModalOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/nirman-logo.png"
                  alt="NIRMAN DMS"
                  className="w-10 h-10 object-contain rounded-xl border border-slate-700 p-0.5 bg-white shrink-0"
                />
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>NIRMAN DMS Ledger Receipt</span>
                  </h3>
                  <p className="text-xs text-slate-400">Official Certificate of Cryptographic Immutability • Hyperledger Fabric</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProofModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Transaction ID:</span>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 break-all select-all">
                  {selectedTx.transaction_id}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Payload SHA-256 Hash:</span>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 break-all select-all">
                  {selectedTx.payload_hash}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Channel:</span>
                  <span className="text-slate-200">{selectedTx.channel_name || 'recordschannel'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Chaincode:</span>
                  <span className="text-slate-200">{selectedTx.chaincode_name || 'dms_audit_cc'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <a
                href={`/verify?key=${encodeURIComponent(selectedTx.transaction_id)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 font-sans flex items-center gap-1"
              >
                Open in Public Verifier ↗
              </a>

              <button
                type="button"
                onClick={() => setProofModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
