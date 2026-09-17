'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface ApprovalsViewProps {
  currentUser: any;
  onDecisionMade: () => void;
  onReturnToOverview?: () => void;
}

interface ChangeRequestItem {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  decidedAt?: string;
  document: {
    id: string;
    documentNumber: string;
    title: string;
    department: string;
    departmentCode: string;
    securityTier: string;
    securityTierName: string;
    type: string;
  };
  requester: {
    id: string;
    name: string;
    designation: string;
    isCurrentOfficer: boolean;
  };
  assignedApprover: {
    id: string;
    name: string;
    designation: string;
  };
  originalVersion: {
    id: string;
    versionNumber: number;
    fileName: string;
    fileSize: number;
    sha256: string;
  };
  proposedVersion: {
    id: string;
    versionNumber: number;
    fileName: string;
    fileSize: number;
    sha256: string;
  };
  lastDecision?: {
    decision: string;
    comment: string;
    timestamp: string;
  } | null;
  canApprove: boolean;
  selfApprovalBlocked: boolean;
}

export default function SensitiveApprovalsView({
  currentUser,
  onDecisionMade,
  onReturnToOverview,
}: ApprovalsViewProps) {
  const [requests, setRequests] = useState<ChangeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'T5' | 'T4' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Decision Form State
  const [justification, setJustification] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);
  const [signingProgress, setSigningProgress] = useState(0);
  const [signingStep, setSigningStep] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const param = activeFilter === 'COMPLETED' ? 'COMPLETED' : 'ALL';
      const res = await fetch(`/api/approvals/pending?status=${param}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        if (data.requests && data.requests.length > 0 && !selectedRequestId) {
          setSelectedRequestId(data.requests[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [activeFilter]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      let matchesFilter = true;
      if (activeFilter === 'T5') matchesFilter = r.document.securityTier === 'T5' && r.status === 'PENDING';
      else if (activeFilter === 'T4') matchesFilter = r.document.securityTier === 'T4' && r.status === 'PENDING';
      else if (activeFilter === 'COMPLETED') matchesFilter = r.status !== 'PENDING';
      else matchesFilter = r.status === 'PENDING';

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.document.documentNumber.toLowerCase().includes(q) ||
        r.document.title.toLowerCase().includes(q) ||
        r.requester.name.toLowerCase().includes(q) ||
        r.proposedVersion.sha256.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [requests, activeFilter, searchQuery]);

  const activeRequest = useMemo(() => {
    if (!selectedRequestId) return filteredRequests[0] || null;
    return requests.find((r) => r.id === selectedRequestId) || filteredRequests[0] || null;
  }, [requests, selectedRequestId, filteredRequests]);

  const handleExecuteDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeRequest) return;
    if (!justification.trim()) {
      setErrorAlert('Approver justification comment is required for maker-checker audit sign-off.');
      return;
    }

    setIsDeciding(true);
    setErrorAlert(null);
    setModalOpen(true);
    setSigningProgress(25);
    setSigningStep('Verifying authority credentials and digital audit signature...');

    try {
      setTimeout(() => {
        setSigningProgress(65);
        setSigningStep(
          decision === 'APPROVED'
            ? `Promoting approved revision v${activeRequest.proposedVersion.versionNumber} to active document record...`
            : 'Archiving rejected revision in quarantined history...'
        );
      }, 700);

      const res = await fetch(`/api/approvals/${activeRequest.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          comment: justification,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Decision failed');
      }

      setSigningProgress(100);
      setSigningStep(
        decision === 'APPROVED'
          ? 'Revision successfully approved and promoted to active document.'
          : 'Revision permanently rejected and archived to history pool.'
      );

      setTimeout(() => {
        setModalOpen(false);
        setIsDeciding(false);
        onDecisionMade();
        fetchApprovals();
      }, 1200);
    } catch (err: any) {
      setIsDeciding(false);
      setModalOpen(false);
      setErrorAlert(err.message || 'An error occurred during approval adjudication.');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1720px] mx-auto w-full font-sans text-[#151c27]">
      {/* 1. Header Banner */}
      <section className="bg-white/85 backdrop-blur-xl rounded-[26px] shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 text-[11px] font-mono font-semibold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#3f5e93]"></span>
              MAKER-CHECKER GOVERNANCE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0f3ff] text-[#151c27] font-mono text-[11px]">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
              ACTIVE SESSION SECURE
            </span>
          </div>

          <h1 className="text-xl font-bold text-[#151c27] tracking-tight">
            Sensitive Approvals Queue &amp; Version Adjudication
          </h1>
          <p className="text-xs text-[#45474b]">
            Multi-tier revision review and audit protocol. Revisions to sensitive records require designated Approver or Section Head sign-off before promotion.
          </p>
        </div>

        {/* Active Approver Credentials Badge */}
        <div className="bg-[#f0f3ff]/60 border border-[#D8DEEA] rounded-2xl p-4 flex items-center gap-3.5 shadow-xs shrink-0">
          <div className="w-11 h-11 rounded-full bg-[#000000] text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[22px]">draw</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#151c27] truncate">
                {currentUser?.fullName || 'Approving Authority'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] font-mono">
                {currentUser?.roles?.[0] || 'DEPT_HEAD'}
              </span>
            </div>
            <span className="text-[11px] text-[#45474b] truncate">
              {currentUser?.designation || 'Designated Approving Authority'}
            </span>
            <div className="flex items-center gap-2 mt-1 font-mono text-[10px]">
              <span className="text-[#3f5e93] flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[13px]">shield</span> Clearance Level {currentUser?.maxSecurityLevel ?? 4}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Triage Toolbar & Filter Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-[26px] border border-[#D8DEEA]/80 shadow-xs">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-[#000000] text-white shadow-xs'
                : 'bg-[#f0f3ff] text-[#45474b] hover:bg-[#e2e8f8]'
            }`}
          >
            <span>All Pending</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
              {requests.filter((r) => r.status === 'PENDING').length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('T5')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeFilter === 'T5'
                ? 'bg-[#000000] text-white shadow-xs'
                : 'bg-[#f0f3ff] text-[#45474b] hover:bg-[#e2e8f8]'
            }`}
          >
            <span>Tier 5 Top Secret</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[rgba(206,105,105,0.14)] text-[#ca6666] text-[10px] font-mono font-bold">
              {requests.filter((r) => r.document.securityTier === 'T5' && r.status === 'PENDING').length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('T4')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeFilter === 'T4'
                ? 'bg-[#000000] text-white shadow-xs'
                : 'bg-[#f0f3ff] text-[#45474b] hover:bg-[#e2e8f8]'
            }`}
          >
            <span>Tier 4 Secret</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
              {requests.filter((r) => r.document.securityTier === 'T4' && r.status === 'PENDING').length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('COMPLETED')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeFilter === 'COMPLETED'
                ? 'bg-[#000000] text-white shadow-xs'
                : 'bg-[#f0f3ff] text-[#45474b] hover:bg-[#e2e8f8]'
            }`}
          >
            <span>Audit History</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono">
              {requests.filter((r) => r.status !== 'PENDING').length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center min-w-[260px]">
          <span className="material-symbols-outlined absolute left-3 text-[#9CA3AF] text-[18px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter docket, officer, digest..."
            className="w-full h-9 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] placeholder:text-[#9CA3AF] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
          />
        </div>
      </div>

      {errorAlert && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">error</span>
          <div>
            <div className="font-bold">Dual-Custody Enforcement Block</div>
            <div>{errorAlert}</div>
          </div>
        </div>
      )}

      {/* 3. Empty State if No Pending Requests */}
      {!activeRequest ? (
        <div className="bg-white rounded-[26px] border border-[#D8DEEA]/80 p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px]">task_alt</span>
          </div>
          <h3 className="text-base font-bold text-[#151c27]">Sensitive Approvals Queue Cleared</h3>
          <p className="text-xs text-[#9CA3AF] max-w-md">
            All staged change requests have been adjudicated and committed to the audit ledger.
          </p>
          {onReturnToOverview && (
            <button
              onClick={onReturnToOverview}
              className="mt-2 px-5 py-2 bg-[#000000] text-white text-xs font-semibold rounded-full hover:bg-[#181c22] transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Active Review Target Header Strip */}
          <div className="bg-white rounded-[26px] shadow-xs border border-[#D8DEEA]/80 p-6 flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[rgba(206,105,105,0.14)] text-[#ca6666] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">policy</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#3f5e93] bg-[rgba(131,162,219,0.14)] border border-[#83A2DB]/30 px-2.5 py-0.5 rounded-full">
                      {activeRequest.document.documentNumber}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[rgba(206,105,105,0.14)] text-[#ca6666] border border-[#CE6969]/30 uppercase tracking-wide flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      {activeRequest.document.securityTier} {activeRequest.document.securityTierName}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#45474b] uppercase">
                      {activeRequest.document.type}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-[#151c27] mt-1">
                    {activeRequest.document.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[#45474b] mt-1">
                    <span>
                      Ingested:{' '}
                      <strong className="font-mono text-[#151c27]">
                        {new Date(activeRequest.createdAt).toISOString().replace('T', ' ').substring(0, 19)} UTC
                      </strong>
                    </span>
                    <span>
                      Submitting Officer:{' '}
                      <strong className="text-[#151c27]">
                        {activeRequest.requester.name} ({activeRequest.requester.designation})
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Warning Pill */}
              <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                <span className="material-symbols-outlined text-[20px] text-amber-700">alarm</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Maker-Checker Rule
                  </span>
                  <span className="text-xs text-amber-900">
                    Dual sign-off required to promote revision
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Side-by-Side Dual Dossier Diff Engine */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT PANE: Currently Sealed Version */}
            <div className="bg-white rounded-[26px] shadow-xs border border-[#D8DEEA]/80 p-6 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 bg-[#f0f3ff] p-3 rounded-2xl border border-[#D8DEEA]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3f5e93]"></span>
                    <span className="text-xs font-bold text-[#151c27] uppercase">Current Active Version</span>
                    <span className="font-mono text-xs bg-white border border-[#D8DEEA] px-2 py-0.5 rounded-full text-[#3f5e93] font-bold">
                      v{activeRequest.originalVersion.versionNumber}.0
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">verified_user</span> Active Sealed
                  </span>
                </div>

                {/* File Card */}
                <div className="p-3.5 bg-[#f0f3ff]/50 border border-[#D8DEEA]/60 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-white border border-[#D8DEEA] flex items-center justify-center text-[#3f5e93] shadow-xs">
                      <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#151c27] truncate">
                        {activeRequest.originalVersion.fileName}
                      </span>
                      <span className="text-[11px] text-[#9CA3AF] font-mono">
                        Size: {(activeRequest.originalVersion.fileSize / (1024 * 1024)).toFixed(2)} MB • AES-256-GCM
                      </span>
                    </div>
                  </div>
                </div>

                {/* SHA Monospace Checksum Box */}
                <div className="flex flex-col gap-1 bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                    Current SHA-256 Checksum
                  </span>
                  <div className="font-mono text-[11px] text-[#151c27] break-all select-all bg-white border border-[#D8DEEA] p-2 rounded-xl">
                    {activeRequest.originalVersion.sha256}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANE: Proposed Revision */}
            <div className="bg-white rounded-[26px] shadow-xs border border-amber-300 p-6 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 bg-amber-50 p-3 rounded-2xl border border-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse"></span>
                    <span className="text-xs font-bold text-amber-950 uppercase">Proposed Revision</span>
                    <span className="font-mono text-xs bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full text-amber-900 font-bold">
                      v{activeRequest.proposedVersion.versionNumber}.0 (Pending)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">hourglass_top</span> Awaiting Sign-off
                  </span>
                </div>

                {/* File Card */}
                <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">difference</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#151c27] truncate">
                        {activeRequest.proposedVersion.fileName}
                      </span>
                      <span className="text-[11px] text-[#9CA3AF] font-mono">
                        Size: {(activeRequest.proposedVersion.fileSize / (1024 * 1024)).toFixed(2)} MB • Staged
                      </span>
                    </div>
                  </div>
                </div>

                {/* SHA Monospace Proposed Checksum Box */}
                <div className="flex flex-col gap-1 bg-amber-50/40 border border-amber-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                    Proposed SHA-256 Digest
                  </span>
                  <div className="font-mono text-[11px] text-[#151c27] break-all select-all bg-white border border-amber-300 p-2 rounded-xl">
                    {activeRequest.proposedVersion.sha256}
                  </div>
                </div>

                {/* Officer's Justification */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Requester Justification</span>
                  <p className="text-xs text-[#151c27] bg-[#f0f3ff]/50 border border-[#D8DEEA] p-3 rounded-2xl leading-relaxed">
                    "{activeRequest.reason}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Approver Decision Console */}
          <div className="bg-white rounded-[26px] shadow-xs border border-[#D8DEEA]/80 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#000000] text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">draw</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#151c27]">Approver Adjudication Console</h3>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Section Head / Department Approver Decision
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 uppercase">
                Audit Record
              </span>
            </div>

            {/* Justification Textarea */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#45474b]">
                Decision Notes &amp; Audit Justification <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                disabled={isDeciding || !activeRequest.canApprove}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Enter mandatory approver justification and statutory compliance sign-off note..."
                className="w-full p-3.5 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] leading-relaxed font-medium placeholder:text-[#9CA3AF]"
              ></textarea>
            </div>

            {/* Dual Custody Warning / Notice */}
            {activeRequest.selfApprovalBlocked && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-900 font-semibold">
                <span className="material-symbols-outlined text-[18px] text-amber-700">gavel</span>
                <span>
                  Notice: You are logged in as the submitting officer ({activeRequest.requester.name}). Maker-checker rules prohibit self-approval. A separate Section Head must sign off.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={isDeciding || !activeRequest.canApprove}
                onClick={() => handleExecuteDecision('REJECTED')}
                className="h-10 px-5 rounded-full bg-[rgba(206,105,105,0.14)] hover:bg-[rgba(206,105,105,0.25)] border border-[#CE6969]/30 text-[#ca6666] text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">block</span>
                <span>Reject Revision</span>
              </button>

              <button
                type="button"
                disabled={isDeciding || !activeRequest.canApprove}
                onClick={() => handleExecuteDecision('APPROVED')}
                className="h-10 px-6 rounded-full bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold shadow-[0_6px_18px_rgba(16,20,26,0.22)] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Approve &amp; Promote Revision</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Feedback Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10141A]/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[26px] max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 border border-[#D8DEEA]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[24px] animate-spin">sync</span>
                <h3 className="text-sm font-bold text-[#151c27]">Processing Approval Sign-Off</h3>
              </div>
              <span className="font-mono text-[10px] text-[#9CA3AF]">DMS-WORKFLOW</span>
            </div>
            <p className="text-xs text-[#45474b]">
              Validating clearance credentials, promoting document version, and committing audit ledger...
            </p>
            <div className="bg-[#10141A] text-white p-3.5 rounded-2xl font-mono text-[11px] space-y-1">
              <div className="text-slate-400">&gt; Validating approver role &amp; clearance...</div>
              <div className="text-slate-400">&gt; Computing SHA-256 version integrity...</div>
              <div className="text-emerald-400 font-bold">&gt; {signingStep}</div>
            </div>
            <div className="w-full bg-[#E9ECF4] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#000000] h-full transition-all duration-300 rounded-full"
                style={{ width: `${signingProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
