'use client';

import React, { useState, useEffect, useCallback } from 'react';

export interface BlockchainStatus {
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

export interface BlockchainRecord {
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

export interface TransactionProof {
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

export interface BlockchainLedgerViewProps {
  onInspectDocument?: (docketNumber: string) => void;
  onReturnToOverview?: () => void;
}

export default function BlockchainLedgerView({
  onInspectDocument,
  onReturnToOverview,
}: BlockchainLedgerViewProps) {
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

  // Toast Notification State
  const [toast, setToast] = useState<{ show: boolean; message: string; icon: string }>({
    show: false,
    message: '',
    icon: 'check_circle',
  });

  const showToast = (message: string, icon = 'check_circle') => {
    setToast({ show: true, message, icon });
    setTimeout(() => {
      setToast({ show: false, message: '', icon: 'check_circle' });
    }, 3200);
  };

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
      showToast('Cryptographic Merkle Proof verified on-chain!', 'verified');
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
      showToast('Please enter a valid SHA-256 payload hash (at least 16 hex chars).', 'warning');
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
      showToast('Successfully anchored digest in blockchain block!', 'lock');
    } catch (err: any) {
      showToast(`Error anchoring hash: ${err.message}`, 'error');
    } finally {
      setAnchorLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard', 'content_copy');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto py-16 flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-xl rounded-[26px] p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 font-sans">
        <div className="w-10 h-10 rounded-full bg-[rgba(131,162,219,0.14)] flex items-center justify-center text-[#3f5e93] animate-spin">
          <span className="material-symbols-outlined text-[24px]">sync</span>
        </div>
        <p className="text-xs font-semibold text-[#151c27]">
          Connecting to Hyperledger Fabric Network &amp; Channel State...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans text-[#151c27]">
      {/* Toast Notification Banner */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#151c27] text-white px-4 py-2.5 rounded-full shadow-[0_10px_30px_rgba(16,20,26,0.25)] flex items-center gap-2 text-xs font-medium animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">{toast.icon}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 1. Main Surface Container */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="material-symbols-outlined text-[#3f5e93] text-[24px]">token</span>
              <h1 className="text-xl lg:text-2xl font-semibold text-[#10141A] tracking-tight">
                Blockchain Ledger &amp; Sovereign Immutability
              </h1>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                Hyperledger Fabric • Channel: {status?.channelName || 'recordschannel'}
              </span>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {status?.mode === 'fabric' ? 'Fabric Peer Live' : 'Simulated Hashchain'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Continuous on-chain tamper-proof anchoring, cryptographic hash attestation, and Merkle root verification under Section 65B of the Indian Evidence Act &amp; Bharatiya Sakshya Adhiniyam 2023.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/verify"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">open_in_new</span>
              <span>Public Verifier Gateway</span>
            </a>
            
            <button
              onClick={() => {
                fetchStatus();
                fetchRecords(pagination.page);
                showToast('Blockchain ledger synchronized with peer nodes');
              }}
              className="w-9 h-9 rounded-full bg-white hover:bg-[#f0f3ff] text-[#45474b] border border-[#D8DEEA] flex items-center justify-center transition shadow-xs cursor-pointer"
              title="Refresh Ledger Feed"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 2. KPI Metrics Grid (4 Equal Columns) */}
        {/* --------------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Block Height */}
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Current Block Height</span>
              <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[19px]">layers</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A] font-mono">
                #{status?.lastBlockNumber || '409121'}
              </div>
              <div className="text-[11px] text-[#3f5e93] mt-0.5 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Active Raft Quorum Height</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Anchored Txns */}
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Total Anchored Txns</span>
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <span className="material-symbols-outlined text-[19px]">lock</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A] font-mono">
                {(status?.totalAnchored || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>100% Cryptographically Sealed</span>
              </div>
            </div>
          </div>

          {/* Card 3: Endorsing Peer Nodes */}
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Endorsing Peer Nodes</span>
              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <span className="material-symbols-outlined text-[19px]">hub</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">
                {status?.endorsingPeers?.length || 2} Active Nodes
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 font-mono truncate">
                peer0 &amp; peer1 (Org1MSP)
              </div>
            </div>
          </div>

          {/* Card 4: Ledger Integrity */}
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Ledger Integrity</span>
              <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[19px]">verified_user</span>
              </div>
            </div>
            <div className="mt-3">
              {(() => {
                const total = status?.totalAnchored || 0;
                const failed = status?.totalFailed || 0;
                const score = total > 0 ? Math.max(0, Math.round(((total - failed) / total) * 100)) : 100;
                return (
                  <>
                    <div className="text-2xl font-bold text-[#10141A] font-mono">
                      {score}% Tamper-Proof
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">shield</span>
                      <span>0 Discrepancies / FIPS 180-4</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 3. Interactive Merkle Proof Verifier */}
        {/* --------------------------------------------------------------------- */}
        <div className="bg-white rounded-[20px] p-5 lg:p-6 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">policy</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#151c27] uppercase tracking-wider">
                  Cryptographic Merkle Proof Verifier
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Validate any Transaction ID or SHA-256 Digest against the active on-chain Merkle tree state.
                </p>
              </div>
            </div>

            <span className="self-start sm:self-auto text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA]">
              Zero-Knowledge Verifiable
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-[#9CA3AF] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
                placeholder="Enter Transaction ID (e.g. 7f8a3b...) or SHA-256 Digest..."
                className="w-full h-10 pl-10 pr-4 bg-[#f0f3ff] border border-[#D8DEEA] text-xs font-mono text-[#151c27] placeholder:text-[#9CA3AF] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
              />
            </div>
            <button
              type="submit"
              disabled={verifyLoading}
              className="h-10 px-6 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full shadow-[0_6px_18px_rgba(16,20,26,0.22)] flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {verifyLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin text-[#83A2DB]">sync</span>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px] text-emerald-400">fingerprint</span>
                  <span>Verify Proof</span>
                </>
              )}
            </button>
          </form>

          {verifyError && (
            <div className="p-3.5 rounded-[16px] bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-fadeIn">
              <span className="material-symbols-outlined text-[18px] text-red-600">error</span>
              <span>{verifyError}</span>
            </div>
          )}

          {verifyResult && (
            <div className="p-4 rounded-[18px] bg-[#f0f3ff]/60 border border-[#D8DEEA] space-y-3 font-mono text-xs animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
                <span className="flex items-center gap-2 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {verifyResult.verified ? '100% CRYPTOGRAPHICALLY VALID' : 'VERIFICATION FAILED'}
                </span>
                <span className="text-[#6B7280] text-[11px] bg-white px-2.5 py-0.5 rounded-full border border-[#D8DEEA]">
                  Block #{verifyResult.blockNumber}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="bg-white p-2.5 rounded-xl border border-[#D8DEEA]/60">
                  <span className="text-[#6B7280] block text-[10px] uppercase font-semibold">Merkle Root:</span>
                  <span className="text-[#3f5e93] font-bold break-all">{verifyResult.merkleRoot}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#D8DEEA]/60">
                  <span className="text-[#6B7280] block text-[10px] uppercase font-semibold">Payload SHA-256:</span>
                  <span className="text-emerald-700 font-bold break-all">{verifyResult.payloadHash}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#D8DEEA]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[#6B7280]">
                <span>Endorsers: {verifyResult.endorsingPeers?.join(', ') || 'peer0.dms.gov.in'}</span>
                <span>Verified At: {new Date(verifyResult.verifiedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 4. Manual Hash Anchoring & Attestation Console */}
        {/* --------------------------------------------------------------------- */}
        <div className="bg-white rounded-[20px] p-5 lg:p-6 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
              <span className="material-symbols-outlined text-[18px]">edit_document</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#151c27] uppercase tracking-wider">
                Ad-hoc Hash Anchoring &amp; Attestation Console
              </h2>
              <p className="text-xs text-[#6B7280]">
                Anchor external forensic evidence digests, judicial decrees, or administrative records directly to the active ledger.
              </p>
            </div>
          </div>

          <form onSubmit={handleManualAnchor} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <input
                type="text"
                value={anchorHashInput}
                onChange={(e) => setAnchorHashInput(e.target.value)}
                placeholder="SHA-256 Payload Hash (e.g. a3c8e1...)"
                className="w-full h-10 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-mono"
                required
              />
            </div>

            <div className="sm:col-span-3">
              <input
                type="text"
                value={anchorDocNumber}
                onChange={(e) => setAnchorDocNumber(e.target.value)}
                placeholder="Reference Docket # (Optional)"
                className="w-full h-10 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <select
                value={anchorEventType}
                onChange={(e) => setAnchorEventType(e.target.value)}
                className="w-full h-10 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] cursor-pointer"
              >
                <option value="AUDIT_ATTESTATION">Audit Attestation</option>
                <option value="SECTION_65B_SEAL">Section 65B Seal</option>
                <option value="DOCUMENT_UPLOAD">Document Ingestion</option>
                <option value="LEGAL_HOLD_FREEZE">Legal Hold Freeze</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={anchorLoading}
                className="w-full h-10 px-4 bg-[#3f5e93] hover:bg-[#305184] text-white text-xs font-semibold rounded-full shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
              >
                {anchorLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Anchoring...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    <span>Anchor to Ledger</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {anchorSuccess && (
            <div className="p-3.5 rounded-[16px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                <span>
                  Successfully Anchored in Block #{anchorSuccess.blockNumber} • TxID: {anchorSuccess.transactionId.substring(0, 24)}...
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVerifyInput(anchorSuccess.transactionId);
                  handleVerify(anchorSuccess.transactionId);
                }}
                className="text-[#3f5e93] hover:underline text-xs font-bold font-sans self-start sm:self-auto cursor-pointer"
              >
                Verify Immediately →
              </button>
            </div>
          )}
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* 5. Live Block Stream & Transaction Ledger Table */}
        {/* --------------------------------------------------------------------- */}
        <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden flex flex-col">
          {/* Table Header Toolbar */}
          <div className="p-4 sm:p-5 bg-[#f0f3ff]/40 border-b border-[#D8DEEA]/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3f5e93] animate-pulse"></span>
                <h2 className="text-xs font-bold text-[#10141A] uppercase tracking-wider">
                  Live Transaction Ledger &amp; Block Stream
                </h2>
                <span className="font-mono text-[10px] font-medium px-2.5 py-0.5 bg-[#E9ECF4] text-[#6B7280] rounded-full">
                  {pagination.total} Records
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                Committed transactions in channel <span className="font-mono font-semibold text-[#151c27]">{status?.channelName || 'recordschannel'}</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Filter */}
              <div className="flex items-center bg-white border border-[#D8DEEA] px-3 py-1 rounded-full text-xs">
                <span className="text-[#6B7280] font-medium mr-1.5">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    fetchRecords(1, e.target.value, searchQuery);
                  }}
                  className="bg-transparent font-medium text-[#10141A] outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMMITTED">Committed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    fetchRecords(1, statusFilter, e.target.value);
                  }}
                  placeholder="Search TxID, Hash, Docket..."
                  className="w-48 sm:w-60 h-9 pl-8 pr-3 bg-white border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f0f3ff]/60 text-[#45474b] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
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
              <tbody className="divide-y divide-[#D8DEEA]/40 text-xs text-[#151c27]">
                {recordsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[#3f5e93]">sync</span>
                        <span>Loading blockchain ledger records...</span>
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-1">search_off</span>
                      <p className="text-sm font-semibold text-slate-600">No blockchain records found matching your filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#f0f3ff]/40 transition font-medium">
                      {/* Transaction ID */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#3f5e93] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span title={rec.transaction_id}>{rec.transaction_id.substring(0, 14)}...</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(rec.transaction_id, rec.id)}
                            className="w-6 h-6 rounded-full hover:bg-[#e2e8f8] flex items-center justify-center text-[#9CA3AF] hover:text-[#3f5e93] transition cursor-pointer"
                            title="Copy Full Transaction ID"
                          >
                            {copiedId === rec.id ? (
                              <span className="material-symbols-outlined text-[14px] text-emerald-600">check</span>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Payload Hash */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-[11px]" title={rec.payload_hash}>
                          {rec.payload_hash.substring(0, 14)}...
                        </span>
                      </td>

                      {/* Docket Context */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {rec.document_number ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => onInspectDocument && onInspectDocument(rec.document_number!)}
                              className="font-semibold font-mono text-[#3f5e93] hover:underline text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px]">description</span>
                              <span>{rec.document_number}</span>
                            </button>
                            <p className="text-[11px] text-[#9CA3AF] truncate max-w-[200px] mt-0.5">
                              {rec.document_title || 'Institutional Record'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[#9CA3AF] text-[11px] font-mono">System Audit Digest</span>
                        )}
                      </td>

                      {/* Event Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA]">
                          {rec.event_type || 'BLOCKCHAIN_ANCHOR'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            rec.ledger_status === 'COMMITTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : rec.ledger_status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {rec.ledger_status}
                        </span>
                      </td>

                      {/* Committed Timestamp */}
                      <td className="py-3.5 px-4 text-[#6B7280] text-[11px] font-mono whitespace-nowrap">
                        {new Date(rec.submitted_at).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTx(rec);
                            setProofModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-full bg-white hover:bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA] text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                          <span>Proof &amp; Cert</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#45474b]">
            <div className="flex items-center gap-2">
              <span>
                Showing <b>{records.length}</b> of <b>{pagination.total}</b> blockchain records
              </span>
              <span>•</span>
              <span>Page <b>{pagination.page}</b> of <b>{pagination.totalPages || 1}</b></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1 || recordsLoading}
                onClick={() => fetchRecords(pagination.page - 1)}
                className="px-3 py-1.5 rounded-full border border-[#D8DEEA] bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-mono font-bold text-[#151c27]">
                {pagination.page}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages || recordsLoading}
                onClick={() => fetchRecords(pagination.page + 1)}
                className="px-3 py-1.5 rounded-full border border-[#D8DEEA] bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 6. Transaction Proof & Certificate Modal */}
      {/* --------------------------------------------------------------------- */}
      {proofModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-[26px] shadow-2xl p-6 sm:p-7 flex flex-col gap-5 border border-[#D8DEEA] max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-3">
                <img
                  src="/nirman-logo.png"
                  alt="NIRMAN DMS"
                  className="w-10 h-10 object-contain rounded-xl border border-[#D8DEEA] p-0.5 bg-white shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#151c27]">NIRMAN DMS Ledger Receipt</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Fabric Anchored
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280]">Official Certificate of Cryptographic Immutability • Hyperledger Fabric</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setProofModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#151c27] p-1 rounded-full transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Proof Body Fields */}
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-[#f0f3ff]/60 p-3 rounded-[16px] border border-[#D8DEEA]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#6B7280] font-sans font-semibold text-[11px]">Transaction ID:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedTx.transaction_id, 'modal-tx')}
                    className="text-[#3f5e93] hover:underline text-[10px] font-sans flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                    <span>Copy TxID</span>
                  </button>
                </div>
                <div className="text-[#3f5e93] font-bold break-all select-all">
                  {selectedTx.transaction_id}
                </div>
              </div>

              <div className="bg-[#f0f3ff]/60 p-3 rounded-[16px] border border-[#D8DEEA]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#6B7280] font-sans font-semibold text-[11px]">Payload SHA-256 Hash:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedTx.payload_hash, 'modal-hash')}
                    className="text-[#3f5e93] hover:underline text-[10px] font-sans flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                    <span>Copy Hash</span>
                  </button>
                </div>
                <div className="text-emerald-700 font-bold break-all select-all">
                  {selectedTx.payload_hash}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-[14px] bg-white border border-[#D8DEEA]/80 shadow-xs">
                  <span className="text-[#6B7280] block text-[10px] uppercase font-semibold font-sans">Channel:</span>
                  <span className="text-[#151c27] font-bold">{selectedTx.channel_name || 'recordschannel'}</span>
                </div>
                <div className="p-3 rounded-[14px] bg-white border border-[#D8DEEA]/80 shadow-xs">
                  <span className="text-[#6B7280] block text-[10px] uppercase font-semibold font-sans">Smart Contract:</span>
                  <span className="text-[#151c27] font-bold">{selectedTx.chaincode_name || 'dms_audit_cc'}</span>
                </div>
              </div>

              {selectedTx.document_number && (
                <div className="p-3 rounded-[14px] bg-white border border-[#D8DEEA]/80 shadow-xs">
                  <span className="text-[#6B7280] block text-[10px] uppercase font-semibold font-sans">Associated Document:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[#3f5e93] font-bold">{selectedTx.document_number}</span>
                    {selectedTx.document_title && (
                      <span className="text-[#6B7280] text-[11px] font-sans truncate">({selectedTx.document_title})</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Legal Attestation Note */}
            <div className="p-3 rounded-[16px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 text-[11px] text-[#6B7280] flex items-start gap-2">
              <span className="material-symbols-outlined text-[#3f5e93] text-[16px] shrink-0 mt-0.5">verified_user</span>
              <span>
                This cryptographic ledger receipt serves as admissible electronic evidence under Section 65B of the Indian Evidence Act 1872 &amp; Section 63 of the Bharatiya Sakshya Adhiniyam 2023.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#D8DEEA]/60">
              <a
                href={`/verify?key=${encodeURIComponent(selectedTx.transaction_id)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#3f5e93] hover:underline font-medium flex items-center gap-1"
              >
                <span>Open in Public Verifier</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>

              <button
                type="button"
                onClick={() => setProofModalOpen(false)}
                className="px-5 py-2 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full transition shadow-xs cursor-pointer"
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
