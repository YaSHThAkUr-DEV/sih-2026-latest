'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserProfileDossierModal } from './UserProfileDossierModal';

interface AuditorStats {
  totalAuditEvents: number;
  cryptographicHealth: {
    status: string;
    violations: number;
    epochsCount: number;
    sealedState: string;
  };
  activeOfficersCount: number;
  departments: string[];
  departmentList?: Array<{ name: string; code: string }>;
  securityAlertsCount: number;
  epochProgression: Array<{ label: string; count: number }>;
  inspector: {
    name: string;
    role: string;
    designation: string;
    clearanceLevel?: string;
    hardwareToken?: string;
    node: string;
  };
}

interface AuditEventRow {
  id: string;
  createdAt: string;
  timeUtc: string;
  actor: {
    id: string | null;
    name: string;
    badge: string;
    designation: string;
    department: string;
    departmentCode: string;
    initials: string;
  };
  eventClass: string;
  eventType: string;
  targetDocket: string;
  targetTitle: string;
  targetFile: string;
  ipAddress: string;
  node: string;
  result: string;
  isFlagged: boolean;
  eventHash: string;
}

interface OfficerDossier {
  id: string;
  name: string;
  badge: string;
  department: string;
  clearance: string;
  initials: string;
  stats: {
    ingestedFiles: number;
    dekUnwraps: number;
    approvalsGiven: number;
    violations: number;
  };
  timeline: Array<{
    id: string;
    timeUtc: string;
    eventType: string;
    title: string;
    target: string;
    eventHash: string;
  }>;
}

interface Auditor360ViewProps {
  onInspectDocument?: (docketNumber: string) => void;
  onReturnToOverview?: () => void;
}

export default function Auditor360View({
  onInspectDocument,
  onReturnToOverview,
}: Auditor360ViewProps) {
  // Stats & Timeline State
  const [stats, setStats] = useState<AuditorStats | null>(null);
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'LOW' | 'MEDIUM' | 'FLAGGED'>('all');

  // Selected Officer / Dossier State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [officerDossier, setOfficerDossier] = useState<OfficerDossier | null>(null);
  const [selectedDossierUserId, setSelectedDossierUserId] = useState<string | null>(null);
  const [personnelModalOpen, setPersonnelModalOpen] = useState(false);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [personnelSearch, setPersonnelSearch] = useState('');

  // Attestation State
  const [attesting, setAttesting] = useState(false);
  const [merkleRoot, setMerkleRoot] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

  // Toast State
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

  // 1. Fetch KPI Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/auditor/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to load auditor stats:', e);
    }
  }, []);

  // 2. Fetch Timeline Events
  const loadTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '8',
        search: searchQuery,
        department: departmentFilter,
        eventType: eventFilter,
        riskLevel: riskFilter,
      });

      const res = await fetch(`/api/auditor/timeline?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setTotalRecords(data.totalRecords || 0);
        setTotalPages(data.totalPages || 1);

        // Auto-select first event if none selected
        if (!selectedEventId && data.events?.length > 0) {
          const first = data.events[0];
          setSelectedEventId(first.id);
          loadOfficerDossier(first.actor.id, first.actor);
        }
      }
    } catch (e) {
      console.error('Failed to load auditor timeline:', e);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, departmentFilter, eventFilter, riskFilter, selectedEventId]);

  // 3. Fetch Officer Dossier
  const loadOfficerDossier = async (actorId: string | null, fallbackActor: any) => {
    if (!actorId) {
      setOfficerDossier({
        id: 'sys',
        name: fallbackActor.name,
        badge: `${fallbackActor.badge} // ${fallbackActor.department}`,
        department: fallbackActor.department,
        clearance: 'Active Clearance Tier-1',
        initials: fallbackActor.initials,
        stats: { ingestedFiles: 0, dekUnwraps: 0, approvalsGiven: 0, violations: 0 },
        timeline: [],
      });
      return;
    }

    try {
      const res = await fetch(`/api/auditor/officer/${actorId}`);
      if (res.ok) {
        const data = await res.json();
        setOfficerDossier(data.officer);
      }
    } catch (e) {
      console.error('Failed to load officer dossier:', e);
    }
  };

  const loadPersonnelList = useCallback(async () => {
    setPersonnelLoading(true);
    try {
      const res = await fetch(`/api/auditor/users?search=${encodeURIComponent(personnelSearch)}`);
      if (res.ok) {
        const data = await res.json();
        setPersonnelList(data.users || []);
      }
    } catch (e) {
      console.error('Failed to load personnel list:', e);
    } finally {
      setPersonnelLoading(false);
    }
  }, [personnelSearch]);

  useEffect(() => {
    if (personnelModalOpen) {
      loadPersonnelList();
    }
  }, [personnelModalOpen, loadPersonnelList]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Handle Cryptographic Ledger Attestation
  const handleRunAttestation = async () => {
    setAttesting(true);
    try {
      const res = await fetch('/api/auditor/verify-ledger', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.verified) {
        setMerkleRoot(data.merkleRoot);
        showToast(
          `Merkle Tree Attestation Complete. ${data.totalEventsVerified} events verified 100% sealed!`,
          'verified'
        );
        loadStats();
        loadTimeline();
      } else {
        showToast('Attestation check finished with warnings.', 'warning');
      }
    } catch (e) {
      showToast('Attestation service timed out.', 'error');
    } finally {
      setAttesting(false);
    }
  };

  // Handle Export Judicial Manifest
  const handleExportManifest = () => {
    showToast('Preparing signed Section 65B judicial manifest...', 'download');
    window.location.href = '/api/auditor/export';
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* 1. Main Surface Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-[#3f5e93] text-[22px]">policy</span>
              <h1 className="text-xl lg:text-2xl font-semibold text-[#10141A] tracking-tight">
                Forensic Audit & Ledger Attestation
              </h1>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                Section 65B Certified
              </span>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Merkle Verified
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Continuous evidentiary chain of custody verification, user action provenance, and tamper-evident Merkle hash ledger under Section 65B / Section 63 BSA 2023.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPersonnelModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">group</span>
              <span>User Activity</span>
            </button>
            <button
              onClick={handleExportManifest}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">verified</span>
              <span>Export Manifest</span>
            </button>
            <button
              onClick={handleRunAttestation}
              disabled={attesting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-medium transition-all shadow-[0_6px_18px_rgba(16,20,26,0.22)] disabled:opacity-50"
            >
              {attesting ? (
                <span className="material-symbols-outlined text-[16px] animate-spin text-[#83A2DB]">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[16px] text-emerald-400">fingerprint</span>
              )}
              <span>{attesting ? 'Attesting Ledger...' : 'Run Ledger Attestation'}</span>
            </button>
          </div>
        </div>

        {/* Auditor Credentials Status Bar */}
        <div className="p-3.5 rounded-[18px] bg-white border border-[#D8DEEA]/60 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">verified_user</span>
              <span className="text-[#6B7280]">Auditor:</span>
              <span className="font-semibold text-[#10141A]">{stats?.inspector?.name || 'Vigilance Auditor'}</span>
            </div>
            <span className="text-[#D8DEEA]">•</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#9CA3AF] text-[16px]">shield</span>
              <span className="font-mono text-[#6B7280]">{stats?.inspector?.clearanceLevel || 'Clearance Level 5 (Maximum)'}</span>
            </div>
            <span className="text-[#D8DEEA]">•</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#9CA3AF] text-[16px]">dns</span>
              <span className="font-mono text-[#6B7280]">Node: {stats?.inspector?.node || 'DMS-SEC-NODE-01'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-mono text-[11px] font-medium bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/50">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            <span>WORM IMMUTABLE STORAGE SEAL: ACTIVE</span>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Total Audit Events</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">account_tree</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">
                {(stats?.totalAuditEvents ?? totalRecords).toLocaleString()}
              </div>
              <div className="text-[11px] text-[#3f5e93] mt-0.5 flex items-center gap-1 font-mono">
                <span className="material-symbols-outlined text-[13px]">link</span>
                <span>100% SHA-256 Chained</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Cryptographic Health</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">
                {stats?.cryptographicHealth?.status || '100% Attested'}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 font-mono">
                {(stats?.cryptographicHealth?.violations ?? 0)} Violations / {(stats?.cryptographicHealth?.epochsCount ?? 1)} Epochs
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Active Custodians</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">groups</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">
                {stats?.activeOfficersCount ?? 0} Personnel
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 font-mono truncate">
                {stats?.departments?.length ? stats.departments.slice(0, 3).join(', ') : 'Central Operations'}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Security Flags</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                (stats?.securityAlertsCount ?? 0) > 0 
                  ? 'bg-rose-50 text-rose-600 border-rose-100' 
                  : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                <span className="material-symbols-outlined text-[18px]">
                  {(stats?.securityAlertsCount ?? 0) > 0 ? 'warning' : 'verified'}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold ${
                (stats?.securityAlertsCount ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {(stats?.securityAlertsCount ?? 0)} Flags
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 font-mono truncate">
                {(stats?.securityAlertsCount ?? 0) === 0 
                  ? 'Zero anomalies detected' 
                  : `${stats?.securityAlertsCount} security challenges logged`}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Search Bar */}
        <div className="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
              <input
                type="text"
                placeholder="Search Officer Name, Badge ID, IP Address, or SHA-256 Hash..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 pl-9 pr-9 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] placeholder:text-[#9CA3AF] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-[#9CA3AF] hover:text-[#10141A]"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-[#f0f3ff] border border-[#D8DEEA] px-3 py-1 rounded-full text-xs">
                <span className="text-[#6B7280] font-medium mr-1.5">Unit:</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-medium text-[#10141A] outline-none cursor-pointer"
                >
                  <option value="all">All Units</option>
                  {(stats?.departmentList || []).map((dep) => (
                    <option key={dep.code || dep.name} value={dep.code || dep.name}>
                      {dep.name} {dep.code ? `(${dep.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center bg-[#f0f3ff] border border-[#D8DEEA] px-3 py-1 rounded-full text-xs">
                <span className="text-[#6B7280] font-medium mr-1.5">Event:</span>
                <select
                  value={eventFilter}
                  onChange={(e) => {
                    setEventFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-medium text-[#10141A] outline-none cursor-pointer"
                >
                  <option value="all">All Events</option>
                  <option value="FILE_UPLOAD">FILE_UPLOAD</option>
                  <option value="DEK_UNWRAP">DEK_UNWRAP_STREAM</option>
                  <option value="VERSION">VERSION_PROMOTION</option>
                  <option value="CERT">SECTION_65B_CERT</option>
                  <option value="AUTH">LOGIN / AUTH</option>
                  <option value="APPROV">APPROVAL_ADJUDICATED</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#D8DEEA]/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-wider mr-1">Risk Filter:</span>
              {[
                { id: 'all', label: `All Activities (${totalRecords})`, color: 'bg-[#3f5e93]' },
                { id: 'LOW', label: 'Standard', color: 'bg-emerald-500' },
                { id: 'MEDIUM', label: 'Medium (Unwraps)', color: 'bg-amber-500' },
                { id: 'FLAGGED', label: 'Flagged Anomalies', color: 'bg-rose-500' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => {
                    setRiskFilter(pill.id as any);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                    riskFilter === pill.id
                      ? 'bg-[#000000] text-white shadow-sm'
                      : 'bg-[#f0f3ff] text-[#6B7280] hover:text-[#10141A] hover:bg-[#E9ECF4]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${pill.color}`}></span>
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-[#6B7280] font-mono text-[11px]">
              <span className="material-symbols-outlined text-[14px]">sync</span>
              <span>Ledger Synchronized</span>
            </div>
          </div>
        </div>

        {/* 2-Column Split Table and Inspector */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Left Event Sequence Table (8 Cols) */}
          <div className="xl:col-span-8 bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden flex flex-col">
            <div className="p-4 bg-[#f0f3ff]/40 border-b border-[#D8DEEA]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#10141A]">Cryptographic Event Sequence</span>
                <span className="font-mono text-[10px] font-medium px-2.5 py-0.5 bg-[#E9ECF4] text-[#6B7280] rounded-full">
                  Verified Blocks
                </span>
              </div>
              <button
                onClick={() => {
                  loadStats();
                  loadTimeline();
                  showToast('Refreshed audit ledger feed');
                }}
                className="w-7 h-7 rounded-full text-[#6B7280] hover:text-[#10141A] hover:bg-white flex items-center justify-center transition shadow-2xs"
                title="Refresh Feed"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Custodian</th>
                    <th className="py-3 px-4">Event Class</th>
                    <th className="py-3 px-4">Target Docket</th>
                    <th className="py-3 px-4">IP & Node</th>
                    <th className="py-3 px-4">Checksum</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                  {loading && events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#6B7280]">
                        <span className="material-symbols-outlined text-[28px] animate-spin text-[#3f5e93] block mb-1">sync</span>
                        <p className="text-xs font-medium">Reading cryptographic audit ledger...</p>
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[#6B7280]">
                        <p className="text-xs font-medium">No audit events match current criteria</p>
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => {
                      const isSelected = selectedEventId === ev.id;
                      return (
                        <tr
                          key={ev.id}
                          onClick={() => {
                            setSelectedEventId(ev.id);
                            loadOfficerDossier(ev.actor.id, ev.actor);
                          }}
                          className={`transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#f0f3ff] border-l-4 border-l-[#3f5e93]'
                              : 'hover:bg-[#f0f3ff]/40'
                          }`}
                        >
                          <td className="py-3 px-4 font-mono text-[#6B7280] whitespace-nowrap">
                            <div className="font-semibold text-[#10141A]">{ev.timeUtc}</div>
                            <div className="text-[10px] text-[#9CA3AF]">{new Date(ev.createdAt).toLocaleDateString()}</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#10141A] text-white flex items-center justify-center text-[10px] font-semibold">
                                {ev.actor.initials}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium text-[#10141A] leading-tight">{ev.actor.name}</span>
                                <span className="font-mono text-[10px] text-[#6B7280]">{ev.actor.badge}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${
                              ev.eventClass === 'FILE_UPLOAD'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                                : ev.eventClass === 'DEK_UNWRAP_STREAM'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                                : ev.eventClass === 'VERSION_PROMOTION'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200/50'
                                : ev.eventClass === 'SECTION_65B_CERT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                : ev.isFlagged
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/50'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {ev.eventClass}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono font-semibold text-[#3f5e93]">{ev.targetDocket}</div>
                            <div className="text-[11px] text-[#6B7280] truncate max-w-[140px]">{ev.targetTitle}</div>
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-[#6B7280] whitespace-nowrap">
                            <div>{ev.ipAddress}</div>
                            <div className="text-[10px] text-[#9CA3AF]">{ev.node}</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase ${
                                ev.isFlagged ? 'text-rose-600' : 'text-emerald-700'
                              }`}>
                                <span className="material-symbols-outlined text-[13px]">
                                  {ev.isFlagged ? 'gpp_bad' : 'check_circle'}
                                </span>
                                <span>{ev.result}</span>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(ev.eventHash);
                                  showToast('SHA-256 Hash copied');
                                }}
                                className="font-mono text-[10px] text-[#9CA3AF] hover:text-[#3f5e93] flex items-center gap-1 group text-left"
                                title="Copy SHA-256 hash"
                              >
                                <span>sha256:{ev.eventHash.substring(0, 8)}...</span>
                                <span className="material-symbols-outlined text-[11px] opacity-0 group-hover:opacity-100">content_copy</span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onInspectDocument && ev.targetDocket !== 'SYSTEM_CORE') {
                                  onInspectDocument(ev.targetDocket);
                                } else {
                                  showToast(`Provenance: ${ev.eventType} verified.`);
                                }
                              }}
                              className="w-7 h-7 rounded-full bg-white hover:bg-[#f0f3ff] text-[#10141A] border border-[#D8DEEA] inline-flex items-center justify-center transition"
                              title="Inspect Context"
                            >
                              <span className="material-symbols-outlined text-[15px]">visibility</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3.5 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="font-mono text-[11px] text-[#6B7280]">
                Showing {events.length} of {totalRecords} Records
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded-full bg-white border border-[#D8DEEA] text-[#10141A] font-medium text-xs disabled:opacity-40 hover:bg-[#f0f3ff] transition"
                >
                  Previous
                </button>
                <span className="font-mono text-[11px] text-[#10141A] px-2.5 py-0.5 bg-[#E9ECF4] rounded-full">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded-full bg-white border border-[#D8DEEA] text-[#10141A] font-medium text-xs disabled:opacity-40 hover:bg-[#f0f3ff] transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Right Officer Dossier Inspector (4 Cols) */}
          <div className="xl:col-span-4 space-y-4 sticky top-24">
            
            {/* Officer Activity Card */}
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
                <div className="flex items-center gap-1.5 text-[#10141A]">
                  <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">account_circle</span>
                  <span className="text-xs font-semibold uppercase tracking-wider">Officer Profile & Activity</span>
                </div>
                <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                  Live Feed
                </span>
              </div>

              {/* Selected Profile Header */}
              <div className="p-3.5 rounded-[16px] bg-[#f0f3ff]/60 border border-[#D8DEEA]/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#10141A] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {officerDossier?.initials || 'DO'}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#10141A] truncate">
                      {officerDossier?.name || 'Dealing Officer'}
                    </span>
                    <span className="material-symbols-outlined text-[#3f5e93] text-[15px]" title="Attested Officer">verified</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#6B7280] truncate">
                    {officerDossier?.badge || 'Records Division'}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[10px] font-medium text-emerald-700">
                      {officerDossier?.clearance || 'Clearance Tier-1'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-[#f0f3ff]/40 border border-[#D8DEEA]/40 rounded-[14px] flex flex-col">
                  <span className="text-[10px] font-medium text-[#6B7280] uppercase">Ingested Files</span>
                  <span className="text-sm font-bold text-[#10141A] mt-0.5">
                    {officerDossier?.stats?.ingestedFiles ?? 0} Docs
                  </span>
                  <span className="font-mono text-[10px] text-[#9CA3AF]">100% SHA-256</span>
                </div>
                <div className="p-3 bg-[#f0f3ff]/40 border border-[#D8DEEA]/40 rounded-[14px] flex flex-col">
                  <span className="text-[10px] font-medium text-[#6B7280] uppercase">DEK Unwraps</span>
                  <span className="text-sm font-bold text-[#10141A] mt-0.5">
                    {officerDossier?.stats?.dekUnwraps ?? 0} Streams
                  </span>
                  <span className="font-mono text-[10px] text-[#9CA3AF]">HSM Key</span>
                </div>
                <div className="p-3 bg-[#f0f3ff]/40 border border-[#D8DEEA]/40 rounded-[14px] flex flex-col">
                  <span className="text-[10px] font-medium text-[#6B7280] uppercase">Approvals</span>
                  <span className="text-sm font-bold text-[#10141A] mt-0.5">
                    {officerDossier?.stats?.approvalsGiven ?? 0} Decisions
                  </span>
                  <span className="font-mono text-[10px] text-[#9CA3AF]">Dual-Control</span>
                </div>
                <div className="p-3 bg-[#f0f3ff]/40 border border-[#D8DEEA]/40 rounded-[14px] flex flex-col">
                  <span className="text-[10px] font-medium text-[#6B7280] uppercase">Violations</span>
                  <span className={`text-sm font-bold mt-0.5 ${
                    (officerDossier?.stats?.violations || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {(officerDossier?.stats?.violations || 0) > 0 ? `${officerDossier?.stats?.violations} Flagged` : '0 Clean'}
                  </span>
                  <span className="font-mono text-[10px] text-[#9CA3AF]">Attested</span>
                </div>
              </div>

              {/* Activity History Modal Trigger */}
              <button
                onClick={() => {
                  if (officerDossier?.id && officerDossier.id !== 'sys') {
                    setSelectedDossierUserId(officerDossier.id);
                  } else {
                    showToast('Select an audit event row to inspect that officer', 'warning');
                  }
                }}
                className="w-full py-2 px-4 rounded-full bg-[#000000] text-white font-medium text-xs hover:bg-[#181c22] transition flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(16,20,26,0.22)] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>View Full Activity History</span>
              </button>

              {/* Recent Activity Timeline */}
              <div className="space-y-2 pt-2 border-t border-[#D8DEEA]/60">
                <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-wider">
                  Recent Actions
                </span>
                <div className="space-y-2 text-xs">
                  {(officerDossier?.timeline || []).slice(0, 3).map((node, idx) => (
                    <div key={node.id || idx} className="p-2.5 rounded-[14px] bg-[#f0f3ff]/30 border border-[#D8DEEA]/40 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-[#3f5e93] font-semibold">{node.timeUtc}</span>
                        <span className="text-[9px] font-mono px-2 py-0.2 bg-white rounded-full text-[#6B7280] border border-[#D8DEEA]">
                          {node.eventType.split('_')[0]}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-[#10141A] truncate">{node.title}</div>
                      <div className="font-mono text-[10px] text-[#9CA3AF] truncate">{node.target}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Merkle Proof Non-Repudiation Box */}
              <div className="p-3.5 bg-[#10141A] text-white rounded-[16px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase text-[#83A2DB]">Cryptographic Seal</span>
                  <span className="material-symbols-outlined text-[15px] text-[#83A2DB]">enhanced_encryption</span>
                </div>
                <div className="font-mono text-[10px] text-[#D8DEEA] space-y-0.5">
                  <div>ROOT: <span className="text-emerald-400">{merkleRoot.substring(0, 16)}...</span></div>
                  <div>SEAL: <span className="text-emerald-300">WORM-ACTIVE-CHAINED</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personnel Directory Modal */}
      {personnelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[26px] shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[#D8DEEA]/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                  <span className="material-symbols-outlined text-[20px]">group</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#10141A]">User Activity Directory</h3>
                  <p className="text-[11px] text-[#6B7280]">Select an employee to inspect their audit activity history</p>
                </div>
              </div>
              <button
                onClick={() => setPersonnelModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 border-b border-[#D8DEEA]/60 bg-[#f0f3ff]/40 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#9CA3AF] text-[18px]">search</span>
              <input
                type="text"
                value={personnelSearch}
                onChange={(e) => setPersonnelSearch(e.target.value)}
                placeholder="Search by name, employee code, or department..."
                className="w-full bg-white border border-[#D8DEEA] rounded-full px-4 py-1.5 text-xs text-[#151c27] focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-[#D8DEEA]/40">
              {personnelLoading ? (
                <div className="py-12 text-center text-[#6B7280] text-xs">
                  <span className="material-symbols-outlined text-[24px] animate-spin text-[#3f5e93] block mb-1">sync</span>
                  Loading personnel profiles...
                </div>
              ) : personnelList.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280] text-xs">
                  No personnel found matching &quot;{personnelSearch}&quot;
                </div>
              ) : (
                personnelList.map((person) => (
                  <div
                    key={person.id}
                    className="py-3 flex items-center justify-between hover:bg-[#f0f3ff]/50 px-3 rounded-[16px] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#10141A] text-white flex items-center justify-center text-xs font-bold">
                        {person.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#10141A]">{person.fullName}</span>
                          <span className="font-mono text-[10px] px-2 py-0.2 bg-[#E9ECF4] text-[#6B7280] rounded-full">
                            {person.employeeCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6B7280]">
                          {person.designation} • {person.department}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setPersonnelModalOpen(false);
                        setSelectedDossierUserId(person.id);
                      }}
                      className="px-3 py-1.5 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-medium rounded-full flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">history</span>
                      <span>View Activity</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Dossier Modal */}
      {selectedDossierUserId && (
        <UserProfileDossierModal
          userId={selectedDossierUserId}
          isOpen={!!selectedDossierUserId}
          onClose={() => setSelectedDossierUserId(null)}
        />
      )}

      {/* Floating Micro Notification Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#10141A] text-white px-4 py-2.5 rounded-full shadow-2xl text-xs flex items-center gap-2 border border-[#D8DEEA]/40 animate-slide-up">
          <span className="material-symbols-outlined text-[#83A2DB] text-[18px]">{toast.icon}</span>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
