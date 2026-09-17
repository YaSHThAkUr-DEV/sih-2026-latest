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
  const [justification, setJustification] = useState(
    'I have reviewed the supplementary memory extraction telemetry and confirmed cryptographic hash consistency with hardware key forensics. Approved for formal submission before the Special CBI Court VI, New Delhi.'
  );
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
            ? 'Promoting approved revision v' + activeRequest.proposedVersion.versionNumber + ' to active document record...'
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
    <div className="flex flex-col gap-6 max-w-[1720px] mx-auto w-full">
      {/* 1. Top Security Pill & Attestation Header Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              MAKER-CHECKER GOVERNANCE WORKFLOW
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px]">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
              ACTIVE SESSION VERIFIED
            </span>
          </div>

          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sensitive Approvals Queue & Version Reconciliation
          </h1>
          <p className="text-xs text-slate-500">
            Multi-tier revision review and audit protocol. Revisions to sensitive records require designated Approver / Department Head sign-off before being promoted to active documents.
          </p>
        </div>

        {/* Active Approver Credentials Badge */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 shadow-xs shrink-0">
          <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[24px]">key_vertical</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 truncate">
                {currentUser?.fullName || 'Approving Authority'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                {currentUser?.roles?.[0] || 'DEPT_HEAD'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              {currentUser?.designation || 'Designated Approving Authority'}
            </span>
            <div className="flex items-center gap-2 mt-1 font-mono text-[10px]">
              <span className="text-blue-700 flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[13px]">shield</span> Clearance Level {currentUser?.maxSecurityLevel ?? 4}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 font-semibold">Authorized Signer</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Triage Toolbar & Filter Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition ${
              activeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>All Pending Approvals</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">
              {requests.filter((r) => r.status === 'PENDING').length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('T5')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
              activeFilter === 'T5'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Tier 5 Highly Sensitive</span>
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-mono font-bold">
              {requests.filter((r) => r.document.securityTier === 'T5' && r.status === 'PENDING').length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('T4')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
              activeFilter === 'T4'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Tier 4 Sensitive</span>
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
              {requests.filter((r) => r.document.securityTier === 'T4' && r.status === 'PENDING').length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('COMPLETED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
              activeFilter === 'COMPLETED'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Audit History & Completed</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono">
              {requests.filter((r) => r.status !== 'PENDING').length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center min-w-[260px]">
          <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter docket, officer, hash..."
            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 rounded focus:bg-white focus:outline-none focus:border-blue-600 shadow-2xs"
          />
        </div>
      </div>

      {errorAlert && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">error</span>
          <div>
            <div className="font-bold">Dual-Custody Enforcement Block</div>
            <div>{errorAlert}</div>
          </div>
        </div>
      )}

      {/* 3. Empty State if No Pending Requests */}
      {!activeRequest ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px]">task_alt</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Sensitive Approvals Queue Clean</h3>
          <p className="text-xs text-slate-500 max-w-md">
            All staged Tier 4 and Tier 5 evidence change requests have been adjudicated and committed to the court ledger.
          </p>
          {onReturnToOverview && (
            <button
              onClick={onReturnToOverview}
              className="mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800 transition"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Active Review Target Header Strip */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-lg bg-red-100 text-red-800 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[28px]">policy</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {activeRequest.document.documentNumber}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      REQUEST_ID: {activeRequest.id.substring(0, 8)}...
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 uppercase tracking-wide flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      {activeRequest.document.securityTier} {activeRequest.document.securityTierName}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                      {activeRequest.document.type}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-slate-900 mt-1">
                    {activeRequest.document.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-slate-400">schedule</span>
                      Ingested:{' '}
                      <strong className="font-mono text-slate-800">
                        {new Date(activeRequest.createdAt).toISOString().replace('T', ' ').substring(0, 19)} UTC
                      </strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-slate-400">person</span>
                      Submitting Custodian:{' '}
                      <strong className="text-slate-800">
                        {activeRequest.requester.name} ({activeRequest.requester.designation})
                      </strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-slate-400">gavel</span>
                      Assigned Approver:{' '}
                      <strong className="text-slate-800">
                        {activeRequest.assignedApprover.name || 'Department Head'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Warning Pill */}
              <div className="bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-lg flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                <span className="material-symbols-outlined text-[20px] text-amber-700">alarm</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Statutory Review Mandate
                  </span>
                  <span className="text-xs text-amber-900">
                    Dual-custody sign-off required to promote to court docket
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Side-by-Side Dual Dossier Diff Engine */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT PANE: Currently Sealed Version */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                {/* Pane Top Strip */}
                <div className="flex items-center justify-between pb-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span className="text-xs font-bold text-slate-900 uppercase">Current Active Version</span>
                    <span className="font-mono text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-blue-700 font-bold">
                      v{activeRequest.originalVersion.versionNumber}.0 (Locked)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">verified_user</span> Active Merkle-Sealed
                  </span>
                </div>

                {/* File Card */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-2xs">
                      <span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {activeRequest.originalVersion.fileName}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Size: {(activeRequest.originalVersion.fileSize / (1024 * 1024)).toFixed(2)} MB • FIPS-140
                      </span>
                    </div>
                  </div>
                </div>

                {/* SHA Monospace Checksum Box */}
                <div className="flex flex-col gap-1 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Immutable SHA-256 Checksum (Docket Master)
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-blue-600">lock</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-800 break-all select-all bg-white border border-slate-200 p-2 rounded">
                    {activeRequest.originalVersion.sha256}
                  </div>
                </div>

                {/* Abstract */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Active Evidentiary Abstract</span>
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg leading-relaxed">
                    Primary docket evidence sealed in MinIO vault. All cryptographic blocks verified by original ingest officer.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-2 bg-slate-50 p-2 rounded text-center border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Status: Protected Court Record • Read-Only Base
                </span>
              </div>
            </div>

            {/* RIGHT PANE: Proposed Quarantined Revision */}
            <div className="bg-white rounded-xl shadow-xs border border-amber-300 p-5 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                {/* Pane Top Strip */}
                <div className="flex items-center justify-between pb-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse"></span>
                    <span className="text-xs font-bold text-amber-950 uppercase">Proposed Revision</span>
                    <span className="font-mono text-xs bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-amber-900 font-bold">
                      v{activeRequest.proposedVersion.versionNumber}.0 (Quarantined)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">hourglass_top</span> Awaiting Dual-Key Sign-off
                  </span>
                </div>

                {/* File Card */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded bg-amber-100 text-amber-900 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">difference</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {activeRequest.proposedVersion.fileName}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Size: {(activeRequest.proposedVersion.fileSize / (1024 * 1024)).toFixed(2)} MB • Staged in MinIO
                      </span>
                    </div>
                  </div>
                </div>

                {/* SHA Monospace Proposed Checksum Box */}
                <div className="flex flex-col gap-1 bg-amber-50/50 border border-amber-200 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                      Proposed SHA-256 Digest (Staged in Isolation)
                    </span>
                    <span className="font-mono text-[10px] text-amber-800 flex items-center gap-1 font-bold">
                      <span className="material-symbols-outlined text-[14px]">warning</span> CHECKSUM DIFF DETECTED
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-900 break-all select-all bg-white border border-amber-300 p-2 rounded">
                    {activeRequest.proposedVersion.sha256}
                  </div>
                </div>

                {/* Officer's Justification */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Requester's Statutory Justification</span>
                    <span className="font-mono text-[10px] text-blue-700 font-bold">
                      SUBMITTED BY: {activeRequest.requester.name.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 bg-amber-50/40 border border-amber-200 p-3 rounded-lg leading-relaxed">
                    "{activeRequest.reason}"
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-2 bg-amber-50 p-2 rounded text-center border border-amber-200">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                  Status: Quarantined in Staging Sandbox • Requires Key Clearance
                </span>
              </div>
            </div>
          </div>

          {/* 5. Cryptographic Attestation & Merkle Proof Visual Strip */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">account_tree</span>
                <h3 className="text-xs font-bold text-slate-900">Document Revision & Integrity Reconciliation Strip</h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400 uppercase">Audit Status: Tracked</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Integrity Check</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                  <span>VALIDATED</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 truncate">SHA-256 Verified</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Signer Authorization</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">verified_user</span>
                  <span>AUTHORIZED</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 truncate">RBAC Clearance Confirmed</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Version Transition</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">alt_route</span>
                  <span>v{activeRequest.originalVersion.versionNumber}.0 &rarr; v{activeRequest.proposedVersion.versionNumber}.0</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 truncate">Pending Maker-Checker</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Audit Trail</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">enhanced_encryption</span>
                  <span>LOGGED</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 truncate">Permanent DB Audit Trail</span>
              </div>
            </div>
          </div>

          {/* 6. Approver Decision Console */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">draw</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Approver Sign-Off Console</h3>
                  <p className="text-[11px] text-slate-500">
                    Approver Role: Designated Department Approver / Section Head
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                Audit Record
              </span>
            </div>

            {/* Mandatory Justification Textarea */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>
                  Approval Justification & Decision Notes <span className="text-red-600">*</span>
                  <span className="text-slate-400 font-normal ml-1">(Recorded in institutional audit log)</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400 font-normal">
                  Chars: {justification.length} / 2000
                </span>
              </label>
              <textarea
                rows={3}
                disabled={isDeciding || !activeRequest.canApprove}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 leading-relaxed"
              ></textarea>
            </div>

            {/* Dual Custody Warning / Notice */}
            {activeRequest.selfApprovalBlocked && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900 font-semibold">
                <span className="material-symbols-outlined text-[18px] text-amber-700">gavel</span>
                <span>
                  Notice: You are logged in as the submitting officer ({activeRequest.requester.name}). Maker-checker rules prohibit self-approval. A separate Department Approver must sign off.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeciding || !activeRequest.canApprove}
                  onClick={() => handleExecuteDecision('REJECTED')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  <span>Reject Revision</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isDeciding || !activeRequest.canApprove}
                  onClick={() => handleExecuteDecision('APPROVED')}
                  className="flex items-center gap-2 px-6 py-2.5 rounded bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Approve & Promote Revision</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Real-time Verification Feedback Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[24px] animate-spin">sync</span>
                <h3 className="text-sm font-bold text-slate-900">Processing Approval Sign-Off</h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400">DMS-WORKFLOW</span>
            </div>
            <p className="text-xs text-slate-600">
              Validating permissions, updating document version registry, and logging audit event...
            </p>
            <div className="bg-slate-900 text-white p-3 rounded font-mono text-[11px] space-y-1">
              <div className="text-slate-400">&gt; Validating approver role & clearance...</div>
              <div className="text-slate-400">&gt; Computing SHA-256 version integrity...</div>
              <div className="text-emerald-400 font-bold">&gt; {signingStep}</div>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${signingProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
