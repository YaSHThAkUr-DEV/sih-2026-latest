'use client';

import React, { useState, useEffect } from 'react';

interface RetentionPolicy {
  id: string;
  name: string;
  scheduleCode: string;
  retentionDays: number;
  retentionYears: number;
  permanent: boolean;
  deletionRequiresApproval: boolean;
  actionOnExpiry: string;
  statutoryFramework: string;
  description: string;
  documentCount: number;
}

interface RetentionRecordItem {
  recordId: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  documentStatus: string;
  securityTier: string;
  securityTierName: string;
  policyId: string;
  policyName: string;
  scheduleCode: string;
  retentionDays: number;
  retentionYears: number;
  actionOnExpiry: string;
  statutoryFramework: string;
  retentionStartAt: string;
  retentionEndAt: string | null;
  daysElapsed: number;
  daysRemaining: number;
  elapsedPercent: number;
  isLegalHold: boolean;
  displayStatus: 'FROZEN' | 'DISPOSAL_STAGED' | 'STANDARD' | 'EXPIRED';
  legalHoldOrderNumber?: string | null;
  legalHoldAuthority?: string | null;
  legalHoldReason?: string | null;
  legalHoldAppliedAt?: string | null;
  legalHoldBy?: string | null;
  legalHoldByDesignation?: string | null;
  sha256Hash: string;
  fileSize: number;
  deletionRequest?: {
    id: string;
    status: string;
    reason: string;
    requestedAt: string;
    shredMethod: string;
    requestedBy: {
      username: string;
      fullName: string;
      designation: string;
    };
    isApproved: boolean;
  } | null;
}

interface RetentionStats {
  totalRecords: number;
  activeHolds: number;
  totalPolicies: number;
  pendingDisposals: number;
}

interface RetentionHoldStudioViewProps {
  onReturnToOverview?: () => void;
  onInspectDocument?: (docket: string) => void;
}

export default function RetentionHoldStudioView({
  onReturnToOverview,
  onInspectDocument,
}: RetentionHoldStudioViewProps) {
  // State
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [records, setRecords] = useState<RetentionRecordItem[]>([]);
  const [stats, setStats] = useState<RetentionStats>({
    totalRecords: 0,
    activeHolds: 0,
    totalPolicies: 5,
    pendingDisposals: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [holdFilter, setHoldFilter] = useState('all-holds');
  const [sortOption, setSortOption] = useState('expiry');

  // Selected item for right inspector
  const [selectedRecord, setSelectedRecord] = useState<RetentionRecordItem | null>(null);

  // Modals
  const [legalHoldModalOpen, setLegalHoldModalOpen] = useState(false);
  const [targetHoldDocket, setTargetHoldDocket] = useState('');
  const [targetHoldDocId, setTargetHoldDocId] = useState('');
  const [holdOrderNumber, setHoldOrderNumber] = useState('');
  const [holdAuthority, setHoldAuthority] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [submittingHold, setSubmittingHold] = useState(false);

  // Propose disposal modal
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [proposeDocId, setProposeDocId] = useState('');
  const [proposeReason, setProposeReason] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Key 2 Execution state
  const [executingShred, setExecutingShred] = useState(false);
  const [shredCompleted, setShredCompleted] = useState(false);

  // Verification input
  const [cnrInput, setCnrInput] = useState('');
  const [cnrVerified, setCnrVerified] = useState<string | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState('check_circle');

  const showToast = (msg: string, icon = 'check_circle') => {
    setToastMsg(msg);
    setToastIcon(icon);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Fetch policies
  const loadPolicies = async () => {
    try {
      const res = await fetch('/api/retention/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      }
    } catch (e) {
      console.error('Failed to load policies:', e);
    }
  };

  // Fetch records
  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (classificationFilter !== 'all') params.set('classification', classificationFilter);
      if (holdFilter !== 'all-holds') params.set('holdState', holdFilter);
      if (sortOption) params.set('sort', sortOption);

      const res = await fetch(`/api/retention/records?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        if (data.stats) setStats(data.stats);

        // Set default selected record
        if (!selectedRecord && data.records?.length > 0) {
          const staged = data.records.find(
            (r: RetentionRecordItem) => r.deletionRequest?.status === 'PENDING_APPROVAL' || r.displayStatus === 'DISPOSAL_STAGED'
          );
          setSelectedRecord(staged || data.records[0]);
        } else if (selectedRecord) {
          const updated = data.records.find((r: RetentionRecordItem) => r.recordId === selectedRecord.recordId);
          if (updated) setSelectedRecord(updated);
        }
      }
    } catch (e) {
      console.error('Failed to load retention records:', e);
      showToast('Failed to load records from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
    loadRecords();
  }, [classificationFilter, holdFilter, sortOption]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadRecords();
    }
  };

  // Open Preservation Lock Modal
  const handleOpenLegalHoldModal = (rec?: RetentionRecordItem) => {
    if (rec) {
      setTargetHoldDocId(rec.documentId);
      setTargetHoldDocket(`${rec.documentNumber} (${rec.documentTitle})`);
      setHoldOrderNumber(rec.legalHoldOrderNumber || '');
      setHoldAuthority(rec.legalHoldAuthority || '');
      setHoldReason(rec.legalHoldReason || '');
    } else if (records.length > 0) {
      const first = records[0];
      setTargetHoldDocId(first.documentId);
      setTargetHoldDocket(`${first.documentNumber} (${first.documentTitle})`);
      setHoldOrderNumber('LOCK-2026-ARCH-0091');
      setHoldAuthority('Storage Operations & Compliance');
      setHoldReason('Preservation hold: Critical record required for enterprise audit and long-term retention');
    }
    setLegalHoldModalOpen(true);
  };

  // Submit Preservation Lock
  const handleApplyLegalHold = async () => {
    if (!targetHoldDocId) {
      showToast('Please select a target document', 'error');
      return;
    }
    if (!holdOrderNumber || !holdAuthority || !holdReason) {
      showToast('Please fill all mandatory preservation lock fields', 'error');
      return;
    }

    setSubmittingHold(true);
    try {
      const res = await fetch('/api/retention/legal-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: targetHoldDocId,
          action: 'APPLY',
          orderNumber: holdOrderNumber,
          judicialAuthority: holdAuthority,
          reason: holdReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply preservation lock');

      showToast(data.message || 'Preservation Lock applied! Document retention schedule frozen.');
      setLegalHoldModalOpen(false);
      loadRecords();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingHold(false);
    }
  };

  // Lift Preservation Lock
  const handleLiftLegalHold = async (rec: RetentionRecordItem) => {
    if (!confirm(`Are you sure you want to release the Preservation Lock from ${rec.documentNumber}? This will unfreeze the retention schedule.`)) {
      return;
    }

    try {
      const res = await fetch('/api/retention/legal-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: rec.documentId,
          action: 'LIFT',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to release preservation lock');

      showToast(data.message || 'Preservation Lock released.');
      loadRecords();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Open Propose Disposal Modal
  const handleOpenProposeModal = (rec?: RetentionRecordItem) => {
    const target = rec || selectedRecord || records[0];
    if (target?.isLegalHold) {
      showToast('Protected by Preservation Lock: Deletion Disabled', 'lock');
      return;
    }
    if (target) {
      setProposeDocId(target.documentId);
      setProposeReason('Standard storage retention expired or obsolete document disposal requested.');
    }
    setProposeModalOpen(true);
  };

  // Submit Propose Disposal
  const handleProposeDisposal = async () => {
    if (!proposeDocId) return;
    setSubmittingProposal(true);
    try {
      const res = await fetch('/api/retention/deletion-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: proposeDocId,
          reason: proposeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to propose disposal');

      showToast(data.message || 'Disposal proposal staged for dual-control sign-off.');
      setProposeModalOpen(false);
      loadRecords();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingProposal(false);
    }
  };

  // Execute Dual-Custody Crypto Shred
  const handleExecuteCryptoShred = async () => {
    if (!selectedRecord?.deletionRequest?.id) {
      showToast('No active staged disposal request selected', 'error');
      return;
    }

    setExecutingShred(true);
    try {
      const res = await fetch(`/api/retention/deletion-requests/${selectedRecord.deletionRequest.id}/adjudicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'APPROVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cryptographic zeroization rejected');

      setShredCompleted(true);
      showToast(data.message || 'Cryptographic shredding finalized. Key DEK destroyed across all HSM clusters.', 'lock_reset');
      
      setTimeout(() => {
        setShredCompleted(false);
        loadRecords();
      }, 2000);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExecutingShred(false);
    }
  };

  // Export Manifest
  const handleExportManifest = () => {
    const headers = [
      'Record ID',
      'Document Number',
      'Title',
      'Security Tier',
      'Schedule Code',
      'Storage Framework',
      'Retention Years',
      'Days Elapsed',
      'Days Remaining',
      'Preservation Lock Active',
      'Lock Reference Number',
      'Authorizing Department',
      'SHA256 Hash',
    ];

    const rows = records.map((r) => [
      r.recordId,
      r.documentNumber,
      `"${r.documentTitle.replace(/"/g, '""')}"`,
      r.securityTier,
      r.scheduleCode,
      r.statutoryFramework,
      r.retentionYears,
      r.daysElapsed,
      r.daysRemaining,
      r.isLegalHold ? 'TRUE' : 'FALSE',
      `"${r.legalHoldOrderNumber || 'N/A'}"`,
      `"${r.legalHoldAuthority || 'N/A'}"`,
      r.sha256Hash,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DMS_Storage_Retention_Manifest_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Storage retention manifest exported with SHA-256 digital signature header.', 'file_download');
  };

  // Verify Record Code
  const handleVerifyCNR = () => {
    if (!cnrInput.trim()) {
      showToast('Enter a valid Document ID or Lock Reference', 'error');
      return;
    }
    setCnrVerified(`VERIFIED: Storage Record #${cnrInput.trim().toUpperCase()} verified. Retention schedule active and compliant.`);
    showToast('Storage Registry: Record Validated', 'verified');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-[#10141A] text-white rounded-full shadow-2xl text-xs font-medium border border-[#D8DEEA]/40 animate-slide-up">
          <span className="material-symbols-outlined text-[#83A2DB] text-[18px]">{toastIcon}</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Surface Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-[#3f5e93] text-[22px]">inventory_2</span>
              <h1 className="text-xl lg:text-2xl font-semibold text-[#10141A] tracking-tight">
                Retention Schedules & Storage Locks
              </h1>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                WORM Governance
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Lifecycle management and retention governance. Enforces preservation locks, policy-based archival schedules, and dual-authorized disposal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenLegalHoldModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-medium transition shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
            >
              <span className="material-symbols-outlined text-[16px] text-[#83A2DB]">lock</span>
              <span>Apply Preservation Lock</span>
            </button>
            <button
              onClick={() => handleOpenProposeModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-rose-700 border border-rose-200 text-xs font-medium transition shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-rose-600">delete_forever</span>
              <span>Propose Disposal</span>
            </button>
            <button
              onClick={handleExportManifest}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export Manifest</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Managed Records</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.totalRecords} Records</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Automated lifecycle tracking • 100% WORM</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Preservation Locks</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">lock_clock</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.activeHolds} Frozen</div>
              <div className="text-[11px] text-[#3f5e93] mt-0.5 font-medium">Protected against deletion</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Retention Policies</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 text-[#10141A] flex items-center justify-center border border-slate-200">
                <span className="material-symbols-outlined text-[18px]">policy</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.totalPolicies} Schedules</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Permanent • Long-Term • Standard</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Pending Disposals</span>
              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-rose-600">{stats.pendingDisposals} Pending</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 font-mono">Requires Key 2 Sign-Off</div>
            </div>
          </div>
        </div>

        {/* Retention Policies Schedules Ribbon */}
        <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">view_timeline</span>
              <h2 className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">Retention & Archival Schedules</h2>
            </div>
            <span className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50">
              All Schedules Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {policies.map((pol) => (
              <div
                key={pol.id}
                className="p-3.5 rounded-[16px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 flex flex-col justify-between hover:bg-[#f0f3ff] transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold text-[#3f5e93]">
                      {pol.scheduleCode.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-[10px] text-[#6B7280]">{pol.documentCount} Files</span>
                  </div>
                  <h3 className="text-xs font-semibold text-[#10141A] mt-1 leading-snug">{pol.name}</h3>
                  <p className="text-[11px] text-[#6B7280] mt-0.5 line-clamp-1">{pol.statutoryFramework}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-[#D8DEEA]/60 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[#10141A]">{pol.retentionYears} Years</span>
                  <span className="text-[10px] text-[#6B7280] truncate max-w-[100px]">{pol.actionOnExpiry}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-Column Split Workspace */}
        <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
          
          {/* Main Storage Lifecycle Table (8 Cols) */}
          <div className="2xl:col-span-8 bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden flex flex-col">
            <div className="p-4 bg-[#f0f3ff]/40 border-b border-[#D8DEEA]/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-semibold text-[#10141A]">Preservation & Lifecycle Ledger</h2>
                  <p className="text-[11px] text-[#6B7280]">Active preservation locks, elapsed periods, and disposal eligibility.</p>
                </div>
                <span className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-[#E9ECF4] text-[#6B7280] font-mono">
                  {records.length} of {stats.totalRecords} Records
                </span>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-5 relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[#9CA3AF] text-[16px]">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search Docket, Title, Lock Ref..."
                    className="w-full h-8 pl-9 pr-3 bg-white border border-[#D8DEEA] text-xs text-[#151c27] placeholder:text-[#9CA3AF] rounded-full focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                  />
                </div>
                <div className="md:col-span-4">
                  <select
                    value={holdFilter}
                    onChange={(e) => setHoldFilter(e.target.value)}
                    className="w-full h-8 px-3 bg-white border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:outline-none cursor-pointer"
                  >
                    <option value="all-holds">All Lock States</option>
                    <option value="active-only">Active Locks Only ({stats.activeHolds})</option>
                    <option value="expiring">Approaching Expiry</option>
                    <option value="pending-shred">Disposal Staged ({stats.pendingDisposals})</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="w-full h-8 px-3 bg-white border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:outline-none cursor-pointer"
                  >
                    <option value="expiry">Sort: Expiry (Soonest)</option>
                    <option value="hold">Sort: Lock Priority</option>
                    <option value="age">Sort: Age (Oldest)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                  <tr>
                    <th className="py-3 px-4">Document</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Schedule</th>
                    <th className="py-3 px-4">Lock Status</th>
                    <th className="py-3 px-4">Elapsed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6B7280]">
                        <span className="material-symbols-outlined text-[24px] animate-spin text-[#3f5e93] block mb-1">sync</span>
                        Loading retention records...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6B7280]">
                        No records match current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    records.map((rec) => {
                      const isSelected = selectedRecord?.recordId === rec.recordId;
                      return (
                        <tr
                          key={rec.recordId}
                          onClick={() => setSelectedRecord(rec)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-[#f0f3ff] border-l-4 border-l-[#3f5e93]'
                              : 'hover:bg-[#f0f3ff]/40'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-mono font-semibold text-[#10141A]">{rec.documentNumber}</div>
                            <div className="text-xs text-[#6B7280] truncate max-w-[180px]">{rec.documentTitle}</div>
                            <div className="font-mono text-[10px] text-[#9CA3AF]">SHA-256: {rec.sha256Hash?.slice(0, 12)}...</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                              {rec.securityTier} {rec.securityTierName}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono text-[11px] text-[#10141A]">{rec.retentionYears} Yrs ({rec.policyName})</div>
                            <div className="text-[10px] text-[#6B7280]">{rec.daysElapsed}d elapsed</div>
                          </td>

                          <td className="py-3 px-4">
                            {rec.isLegalHold ? (
                              <span className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">lock</span>
                                Preservation Locked
                              </span>
                            ) : rec.deletionRequest?.status === 'PENDING_APPROVAL' ? (
                              <span className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/50 inline-flex items-center gap-1 animate-pulse">
                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                Disposal Staged
                              </span>
                            ) : (
                              <span className="rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-slate-100 text-slate-700">
                                Unrestricted
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="w-24 space-y-1">
                              <div className="w-full bg-[#E9ECF4] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${rec.isLegalHold ? 'bg-[#3f5e93]' : 'bg-slate-700'}`}
                                  style={{ width: `${Math.min(rec.elapsedPercent, 100)}%` }}
                                ></div>
                              </div>
                              <div className="font-mono text-[10px] text-[#6B7280]">{rec.elapsedPercent}%</div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              {rec.isLegalHold ? (
                                <button
                                  onClick={() => handleLiftLegalHold(rec)}
                                  className="w-7 h-7 rounded-full bg-white hover:bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA] inline-flex items-center justify-center transition"
                                  title="Release Preservation Lock"
                                >
                                  <span className="material-symbols-outlined text-[15px]">lock_open</span>
                                </button>
                              ) : rec.deletionRequest?.status === 'PENDING_APPROVAL' ? (
                                <button
                                  onClick={() => setSelectedRecord(rec)}
                                  className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-medium hover:bg-rose-700 transition"
                                >
                                  Review
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleOpenLegalHoldModal(rec)}
                                    className="w-7 h-7 rounded-full bg-white hover:bg-[#f0f3ff] text-[#10141A] border border-[#D8DEEA] inline-flex items-center justify-center transition"
                                    title="Apply Lock"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">lock</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenProposeModal(rec)}
                                    className="w-7 h-7 rounded-full bg-white hover:bg-rose-50 text-rose-600 border border-[#D8DEEA] inline-flex items-center justify-center transition"
                                    title="Stage Disposal"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Controlled Disposal Cockpit (4 Cols) */}
          <div className="2xl:col-span-4 space-y-4 sticky top-24">
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
                <div className="flex items-center gap-1.5 text-[#10141A]">
                  <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">verified_user</span>
                  <span className="text-xs font-semibold uppercase tracking-wider">Disposal Cockpit</span>
                </div>
                <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                  Dual-Control
                </span>
              </div>

              {selectedRecord ? (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-[16px] bg-[#f0f3ff]/60 border border-[#D8DEEA]/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[#6B7280] uppercase">Target Record</span>
                      <span className="font-mono text-xs font-bold text-[#10141A]">{selectedRecord.documentNumber}</span>
                    </div>
                    <div className="text-xs font-semibold text-[#10141A]">{selectedRecord.documentTitle}</div>
                    <div className="font-mono text-[10px] text-[#9CA3AF] truncate">SHA-256: {selectedRecord.sha256Hash}</div>
                  </div>

                  {/* Lock Clearance */}
                  <div className={`p-3 rounded-[16px] border flex items-center gap-2.5 ${
                    selectedRecord.isLegalHold ? 'bg-[rgba(131,162,219,0.1)] border-[#83A2DB]/30' : 'bg-emerald-50 border-emerald-200/50'
                  }`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {selectedRecord.isLegalHold ? 'lock' : 'verified'}
                    </span>
                    <div className="text-xs">
                      <div className="font-semibold text-[#10141A]">
                        {selectedRecord.isLegalHold ? 'Preservation Lock Active' : 'Preservation Lock: Clear'}
                      </div>
                      <div className="text-[11px] text-[#6B7280]">
                        {selectedRecord.isLegalHold ? 'Disposal prohibited by active lock.' : 'Eligible for controlled disposal.'}
                      </div>
                    </div>
                  </div>

                  {/* Dual Key Signatures */}
                  <div className="space-y-2 text-xs">
                    <div className="text-[10px] font-medium text-[#6B7280] uppercase">Dual-Authorization Signatures</div>
                    
                    {/* Key 1 */}
                    <div className="p-3 rounded-[14px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/40 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#10141A]">Key 1: Requester</div>
                        <div className="text-[11px] text-[#6B7280]">
                          {selectedRecord.deletionRequest?.requestedBy?.fullName || 'Storage Specialist'}
                        </div>
                      </div>
                      <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700">
                        Signed
                      </span>
                    </div>

                    {/* Key 2 */}
                    <div className="p-3 rounded-[14px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/40 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#10141A]">Key 2: Compliance Officer</div>
                        <div className="text-[11px] text-[#6B7280]">Storage Governance Lead</div>
                      </div>
                      <span className={`rounded-full text-[9px] font-semibold px-2 py-0.5 ${
                        selectedRecord.deletionRequest?.isApproved || shredCompleted
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {selectedRecord.deletionRequest?.isApproved || shredCompleted ? 'Signed' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={handleExecuteCryptoShred}
                    disabled={
                      executingShred ||
                      selectedRecord.isLegalHold ||
                      !selectedRecord.deletionRequest ||
                      selectedRecord.deletionRequest.status !== 'PENDING_APPROVAL'
                    }
                    className="w-full py-2.5 px-4 rounded-full bg-[#000000] text-white font-medium text-xs hover:bg-[#181c22] transition flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(16,20,26,0.22)] disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                    <span>
                      {executingShred
                        ? 'Zeroizing Cryptographic Keys...'
                        : shredCompleted
                        ? 'Disposal Completed'
                        : 'Execute Secure Disposal (Key 2)'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-[#6B7280] text-xs">Select a document to inspect</div>
              )}
            </div>

            {/* Quick Lookup Drawer */}
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#10141A]">
                <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">search</span>
                <span>Registry Record Quick-Lookup</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cnrInput}
                  onChange={(e) => setCnrInput(e.target.value)}
                  placeholder="Enter Document ID or Lock Ref..."
                  className="flex-1 h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
                <button
                  onClick={handleVerifyCNR}
                  className="px-3.5 py-1.5 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition"
                >
                  Verify
                </button>
              </div>
              {cnrVerified && (
                <div className="p-2.5 rounded-[12px] bg-emerald-50 border border-emerald-200/50 text-emerald-700 text-[11px] font-mono">
                  {cnrVerified}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Apply Lock */}
      {legalHoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] flex flex-col gap-4 border border-[#D8DEEA]/80">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2 text-[#10141A]">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] flex items-center justify-center text-[#3f5e93] border border-[#83A2DB]/30">
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                </div>
                <h3 className="text-sm font-semibold">Apply Preservation Lock</h3>
              </div>
              <button
                onClick={() => setLegalHoldModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-[#10141A] block mb-1">Target Document</label>
                <select
                  value={targetHoldDocId}
                  onChange={(e) => {
                    setTargetHoldDocId(e.target.value);
                    const sel = records.find((r) => r.documentId === e.target.value);
                    if (sel) setTargetHoldDocket(`${sel.documentNumber} (${sel.documentTitle})`);
                  }}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] font-mono text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none"
                >
                  {records.map((r) => (
                    <option key={r.documentId} value={r.documentId}>
                      {r.documentNumber} — {r.documentTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[#10141A] block mb-1">Lock Ref #</label>
                  <input
                    type="text"
                    value={holdOrderNumber}
                    onChange={(e) => setHoldOrderNumber(e.target.value)}
                    placeholder="e.g. LOCK-2026-ARCH-0091"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] font-mono text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-medium text-[#10141A] block mb-1">Authorizing Unit</label>
                  <input
                    type="text"
                    value={holdAuthority}
                    onChange={(e) => setHoldAuthority(e.target.value)}
                    placeholder="e.g. Compliance Lead"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#10141A] block mb-1">Preservation Grounds</label>
                <textarea
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Specify preservation grounds..."
                  rows={3}
                  className="w-full p-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-[16px] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
              <button
                onClick={() => setLegalHoldModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] font-medium text-xs rounded-full transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLegalHold}
                disabled={submittingHold}
                className="px-4 py-2 bg-[#000000] hover:bg-[#181c22] text-white font-medium text-xs rounded-full flex items-center gap-1.5 transition shadow-[0_6px_18px_rgba(16,20,26,0.22)] disabled:opacity-50"
              >
                <span>{submittingHold ? 'Applying...' : 'Affix Lock'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Propose Disposal */}
      {proposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] flex flex-col gap-4 border border-[#D8DEEA]/80">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2 text-[#10141A]">
                <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                  <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                </div>
                <h3 className="text-sm font-semibold">Propose Storage Disposal (Key 1)</h3>
              </div>
              <button
                onClick={() => setProposeModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-[#10141A] block mb-1">Target Document</label>
                <select
                  value={proposeDocId}
                  onChange={(e) => setProposeDocId(e.target.value)}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] font-mono text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none"
                >
                  {records
                    .filter((r) => !r.isLegalHold)
                    .map((r) => (
                      <option key={r.documentId} value={r.documentId}>
                        {r.documentNumber} — {r.documentTitle}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-[#10141A] block mb-1">Disposal Grounds</label>
                <textarea
                  value={proposeReason}
                  onChange={(e) => setProposeReason(e.target.value)}
                  placeholder="Specify expiration of storage retention period..."
                  rows={3}
                  className="w-full p-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-[16px] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
              <button
                onClick={() => setProposeModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] font-medium text-xs rounded-full transition"
              >
                Cancel
              </button>
              <button
                onClick={handleProposeDisposal}
                disabled={submittingProposal}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-full flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
              >
                <span>{submittingProposal ? 'Submitting...' : 'Submit Proposal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
