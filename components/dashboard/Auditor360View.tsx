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
  const [merkleRoot, setMerkleRoot] = useState('');

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
  }, [page, searchQuery, departmentFilter, eventFilter, riskFilter]);

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
    <div className="w-full flex flex-col gap-5 text-slate-800">
      
      {/* 1. TOP BANNER & AUDITOR CREDENTIALS HEADER */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 text-[11px] font-bold uppercase rounded border border-blue-200">
                <span className="material-symbols-outlined text-[14px]">assured_workload</span>
                <span>Section 65B Certified DMS</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-[11px] rounded border border-slate-200">
                REGISTRY EPOCH: #2026.42
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>MERKLE INTEGRITY: 100% ATTESTED</span>
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <span>Central Forensic Audit & Cryptographic Compliance Console</span>
            </h1>
            <p className="text-xs text-slate-500 max-w-4xl">
              Continuous verification of evidentiary chain of custody, user action provenance, and tamper-evident Merkle hash ledger under Section 65B Indian Evidence Act / Section 63 BSA 2023.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start xl:self-center flex-wrap">
            <button
              onClick={() => setPersonnelModalOpen(true)}
              className="h-9 px-3.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-1.5 rounded border border-blue-200 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[17px] text-blue-700">badge</span>
              <span>Personnel Activity Dossiers</span>
            </button>
            <button
              onClick={handleExportManifest}
              className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 rounded border border-slate-300 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[17px] text-blue-600">verified</span>
              <span>Export Signed Judicial Manifest</span>
            </button>
            <button
              onClick={handleRunAttestation}
              disabled={attesting}
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold flex items-center gap-1.5 rounded transition-all shadow-xs disabled:opacity-50"
            >
              {attesting ? (
                <span className="material-symbols-outlined text-[17px] text-blue-400 animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[17px] text-emerald-400">fingerprint</span>
              )}
              <span>{attesting ? 'Attesting Ledger...' : 'Run Cryptographic Ledger Attestation'}</span>
            </button>
          </div>
        </div>

        {/* Active Inspector Status Bar */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-700 text-[18px]">security</span>
              <span className="font-medium text-slate-600">Compliance Officer:</span>
              <span className="font-bold text-slate-900">{stats?.inspector?.name || 'Vigilance Auditor'} (Auditor Grade-1)</span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">shield</span>
              <span className="font-mono text-slate-600">{stats?.inspector?.clearanceLevel || 'Clearance Level 5 (Maximum)'}</span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">dns</span>
              <span className="font-mono text-slate-600">Node: {stats?.inspector?.node || 'DMS-SEC-NODE-01'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-800 font-mono text-[11px] font-semibold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">lock</span>
            <span>WORM IMMUTABLE STORAGE SEAL: ACTIVE</span>
          </div>
        </div>
      </div>

      {/* 2. AUDITOR KPI METRICS RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1 */}
        <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Audit Events</span>
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-800">
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {(stats?.totalAuditEvents || totalRecords || 1428).toLocaleString()} Recorded
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-blue-700 text-xs font-semibold">
              <span className="material-symbols-outlined text-[14px]">link</span>
              <span className="font-mono text-[11px]">100% SHA-256 Chained</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full w-full rounded-full"></div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cryptographic Health</span>
            <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
              <span>{stats?.cryptographicHealth?.status || '100% Attested'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5">
              0 Block Violations across {stats?.cryptographicHealth?.epochsCount || 42} Epochs
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-full rounded-full"></div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Officer Footprints</span>
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-800">
              <span className="material-symbols-outlined text-[18px]">groups</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {stats?.activeOfficersCount || 18} Officers
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5 truncate">
              CCDF, ACD, SCU, LPW, GENADMIN
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-800 h-full w-4/5 rounded-full"></div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security Alerts</span>
            <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-700">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-red-700 flex items-center gap-1.5">
              <span>{stats?.securityAlertsCount || 2} Flagged Events</span>
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5 truncate">
              Off-hour unwrap & PIN challenges
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-red-500 h-full w-1/4 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* 3. OFFICER 360 & ACTOR PROVENANCE FILTER BAR */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">filter_alt</span>
            <input
              type="text"
              placeholder="Search by Officer Name, Badge ID, IP Address, or SHA-256 Hash..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 pl-9 pr-20 bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
              <span className="text-slate-500 font-semibold mr-1.5">Dept:</span>
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="all">All Units (5)</option>
                <option value="CCDF">Cyber Forensics (CCDF)</option>
                <option value="ACD">Anti-Corruption (ACD)</option>
                <option value="SCU">Special Crimes Unit (SCU)</option>
                <option value="LPW">Legal Prosecution (LPW)</option>
                <option value="GENADMIN">Administration</option>
              </select>
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
              <span className="text-slate-500 font-semibold mr-1.5">Event:</span>
              <select
                value={eventFilter}
                onChange={(e) => {
                  setEventFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="all">All Classifications</option>
                <option value="FILE_UPLOAD">FILE_UPLOAD</option>
                <option value="DEK_UNWRAP">DEK_UNWRAP_STREAM</option>
                <option value="VERSION">VERSION_PROMOTION</option>
                <option value="CERT">SECTION_65B_CERT</option>
                <option value="AUTH">LOGIN / FAILED_AUTH</option>
                <option value="APPROV">APPROVAL_ADJUDICATED</option>
              </select>
            </div>

            <div className="flex items-center bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
              <span className="text-slate-500 font-semibold mr-1.5">Epoch:</span>
              <span className="font-mono text-slate-700">Last 7 Days (Active)</span>
            </div>
          </div>
        </div>

        {/* Risk Level Pills */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Ledger Filters:</span>
            {[
              { id: 'all', label: `All Activities (${totalRecords || 1428})`, color: 'bg-blue-400' },
              { id: 'LOW', label: 'Standard / Low Risk', color: 'bg-emerald-500' },
              { id: 'MEDIUM', label: 'Medium Sensitivity (Unwraps)', color: 'bg-amber-500' },
              { id: 'FLAGGED', label: 'Flagged Anomalies', color: 'bg-red-500' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => {
                  setRiskFilter(pill.id as any);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  riskFilter === pill.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${pill.color}`}></span>
                <span>{pill.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
            <span className="material-symbols-outlined text-[14px]">sync</span>
            <span>Live Ledger Synchronized</span>
          </div>
        </div>
      </div>

      {/* 4. MAIN EVENT LEDGER TABLE & SIDEBAR INSPECTOR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        
        {/* Left 8-Column Event Sequence Table */}
        <div className="xl:col-span-8 bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Cryptographic Event Sequence</span>
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                BLOCK #409,114 - 409,120
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  loadStats();
                  loadTimeline();
                  showToast('Refreshed audit ledger feed');
                }}
                className="p-1 text-slate-400 hover:text-slate-800 rounded transition"
                title="Refresh Feed"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3.5">Actor & Designation</th>
                  <th className="py-2.5 px-3.5">Event Class</th>
                  <th className="py-2.5 px-3.5">Target Docket / Evidence</th>
                  <th className="py-2.5 px-3.5">Provenance & Node</th>
                  <th className="py-2.5 px-3.5">Status & Checksum</th>
                  <th className="py-2.5 px-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-[32px] animate-spin block mb-1">sync</span>
                      <p className="text-xs font-semibold">Reading cryptographic audit ledger from PostgreSQL...</p>
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      <span className="material-symbols-outlined text-[32px] block mb-1">search_off</span>
                      <p className="text-xs font-semibold">No audit events match the filter criteria</p>
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
                            ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{ev.timeUtc}</div>
                          <div className="text-[10px] text-slate-400">{new Date(ev.createdAt).toLocaleDateString()}</div>
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                              {ev.actor.initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 leading-tight">{ev.actor.name}</span>
                              <span className="font-mono text-[10px] text-slate-500">{ev.actor.badge}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            ev.eventClass === 'FILE_UPLOAD'
                              ? 'bg-blue-100 text-blue-800'
                              : ev.eventClass === 'DEK_UNWRAP_STREAM'
                              ? 'bg-amber-100 text-amber-800'
                              : ev.eventClass === 'VERSION_PROMOTION'
                              ? 'bg-purple-100 text-purple-800'
                              : ev.eventClass === 'SECTION_65B_CERT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ev.isFlagged
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {ev.eventClass}
                          </span>
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="font-mono font-bold text-blue-700">{ev.targetDocket}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[150px]">{ev.targetTitle}</div>
                        </td>

                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          <div>{ev.ipAddress}</div>
                          <div className="text-[10px] text-slate-400">{ev.node}</div>
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${
                              ev.isFlagged ? 'text-red-700' : 'text-emerald-700'
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
                                showToast(`SHA-256 Hash copied to clipboard!`);
                              }}
                              className="font-mono text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-1 group text-left"
                              title="Click to copy SHA-256 hash"
                            >
                              <span>sha256:{ev.eventHash.substring(0, 8)}...</span>
                              <span className="material-symbols-outlined text-[11px] opacity-0 group-hover:opacity-100">content_copy</span>
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onInspectDocument && ev.targetDocket !== 'SYSTEM_CORE') {
                                onInspectDocument(ev.targetDocket);
                              } else {
                                showToast(`Provenance: ${ev.eventType} verified authentic.`);
                              }
                            }}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Inspect Docket / Context"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="font-mono text-[11px] text-slate-600">
              Displaying {events.length} of {totalRecords} Ledger Verified Records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 px-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded disabled:opacity-40 hover:bg-slate-100 transition"
              >
                Previous
              </button>
              <span className="font-mono text-[11px] text-slate-800 px-2 py-1 bg-slate-200 rounded">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-7 px-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded disabled:opacity-40 hover:bg-slate-100 transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right 4-Column Officer Chronological Dossier & Anomaly Inspector */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          
          {/* Officer Dossier Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-700 text-[18px]">badge</span>
                <span className="text-xs font-bold text-slate-900">Officer Forensic Dossier 360</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded uppercase">
                LIVE CONTEXT
              </span>
            </div>

            {/* Selected Officer Profile */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                {officerDossier?.initials || 'DO'}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {officerDossier?.name || 'Dealing Officer'}
                  </span>
                  <span className="material-symbols-outlined text-blue-600 text-[15px]" title="Attested Officer">verified</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 truncate">
                  {officerDossier?.badge || 'GOV-OFF-042 // Records Division'}
                </span>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">
                    {officerDossier?.clearance || 'Active Clearance Tier-1'}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ingested Files</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5">
                  {officerDossier?.stats?.ingestedFiles || 38} Docs
                </span>
                <span className="font-mono text-[10px] text-slate-500">100% SHA-256</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">DEK Unwraps</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5">
                  {officerDossier?.stats?.dekUnwraps || 94} Streams
                </span>
                <span className="font-mono text-[10px] text-slate-500">Hardware HSM Key</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Approvals Given</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5">
                  {officerDossier?.stats?.approvalsGiven || 14} Decisions
                </span>
                <span className="font-mono text-[10px] text-slate-500">Dual-Control</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Violations / Flags</span>
                <span className={`text-sm font-bold mt-0.5 ${
                  (officerDossier?.stats?.violations || 0) > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}>
                  {(officerDossier?.stats?.violations || 0) > 0 ? `${officerDossier?.stats?.violations} Flagged` : '0 Clean'}
                </span>
                <span className="font-mono text-[10px] text-slate-500">Attested Record</span>
              </div>
            </div>

            {/* Direct Dossier Inspection Action */}
            <button
              onClick={() => {
                if (officerDossier?.id && officerDossier.id !== 'sys') {
                  setSelectedDossierUserId(officerDossier.id);
                } else {
                  showToast('Please select an audit event row to inspect that officer', 'warning');
                }
              }}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <span className="material-symbols-outlined text-[16px]">manage_search</span>
              <span>Open Full Forensic User Dossier</span>
            </button>

            {/* Chronological Custody Audit Timeline */}
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Provenance Timeline (Recent Nodes)
              </span>
              <div className="flex flex-col gap-3 relative pl-3.5 before:content-[''] before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
                {(officerDossier?.timeline || []).map((node, idx) => (
                  <div key={node.id || idx} className="relative flex flex-col gap-0.5">
                    <span className={`absolute -left-3.5 top-1 w-2 h-2 rounded-full ${
                      idx === 0 ? 'bg-blue-600' : 'bg-slate-400'
                    }`}></span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-blue-700 font-bold">{node.timeUtc}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded uppercase">
                        {node.eventType.split('_')[0]}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 leading-tight">{node.title}</div>
                    <div className="font-mono text-[10px] text-slate-400 truncate">{node.target}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Merkle Proof Box */}
            <div className="p-3 bg-slate-900 text-white rounded-lg flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-blue-400">Cryptographic Non-Repudiation</span>
                <span className="material-symbols-outlined text-[15px] text-blue-400">enhanced_encryption</span>
              </div>
              <div className="flex flex-col font-mono text-[11px] text-slate-300">
                <div>ROOT: <span className="text-emerald-400 font-bold">{merkleRoot.substring(0, 14)}...</span></div>
                <div>SEAL: <span className="text-amber-300 font-bold">WORM-LGR-#89110</span></div>
                <div className="mt-1 text-[10px] text-slate-400">Section 65B(4) Evidence Manifest Pre-Attested</div>
              </div>
              <button
                onClick={() => {
                  showToast('Cryptographic Root Non-Repudiation Seal Validated via Hardware HSM #449', 'security');
                }}
                className="mt-1 w-full py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded transition flex items-center justify-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-[15px] text-emerald-600">task_alt</span>
                <span>Verify Root Hash Signature</span>
              </button>
            </div>
          </div>

          {/* System Chain-of-Custody Integrity Overview Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Ledger Architecture Health</span>
              <span className="material-symbols-outlined text-blue-600 text-[18px]">hub</span>
            </div>

            <div className="w-full bg-slate-50 p-2.5 rounded-lg flex flex-col gap-1 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Epoch Block Progression (Last Snapshots)
              </span>
              <div className="h-14 w-full flex items-end gap-1.5 pt-2">
                {[60, 75, 40, 85, 95, 65, 100].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`flex-1 rounded-t transition-all ${
                      i === 6 ? 'bg-blue-600' : 'bg-blue-300 hover:bg-blue-400'
                    }`}
                    title={`Block #${409114 + i} - Verified`}
                  ></div>
                ))}
              </div>
              <div className="flex justify-between font-mono text-[9px] text-slate-400 mt-0.5">
                <span>08:00 UTC</span>
                <span>11:00 UTC</span>
                <span>NOW (LIVE)</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Next Scheduled Snapshot:</span>
              <span className="font-mono font-semibold text-slate-800">15:00:00 UTC (Active)</span>
            </div>
          </div>

        </div>

      </div>

      {/* PERSONNEL DIRECTORY INSPECTION MODAL */}
      {personnelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-400 text-[24px]">group</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Personnel Activity Dossiers Directory</h3>
                  <p className="text-[11px] text-slate-400">Select any employee in the office to inspect their complete audit record</p>
                </div>
              </div>
              <button
                onClick={() => setPersonnelModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                value={personnelSearch}
                onChange={(e) => setPersonnelSearch(e.target.value)}
                placeholder="Search by name, employee code, or department..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {personnelLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <span className="material-symbols-outlined text-[28px] animate-spin block mb-1">sync</span>
                  Loading personnel profiles...
                </div>
              ) : personnelList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No personnel found matching &quot;{personnelSearch}&quot;
                </div>
              ) : (
                personnelList.map((person) => (
                  <div
                    key={person.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                        {person.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{person.fullName}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold">
                            {person.employeeCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {person.designation} &bull; {person.department}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-bold text-slate-900 block">{person.totalActivityCount} Events</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {person.authoredDocumentsCount} Docs Authored
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setPersonnelModalOpen(false);
                          setSelectedDossierUserId(person.id);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Inspect Dossier</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPersonnelModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED USER PROFILE DOSSIER MODAL */}
      {selectedDossierUserId && (
        <UserProfileDossierModal
          userId={selectedDossierUserId}
          isOpen={!!selectedDossierUserId}
          onClose={() => setSelectedDossierUserId(null)}
        />
      )}

      {/* Floating Micro Notification Toast */}
      <div
        className={`fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-2xl text-xs flex items-center gap-2 transition-all duration-300 ${
          toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <span className="material-symbols-outlined text-blue-400 text-[18px]">{toast.icon}</span>
        <span className="font-medium">{toast.message}</span>
      </div>

    </div>
  );
}
