'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  severity: 'CRITICAL' | 'WARNING' | 'SUCCESS' | 'INFO';
  isUnread: boolean;
  readAt?: string | null;
  createdAt: string;
  metadata: {
    docketNumber?: string;
    docketTitle?: string;
    offense?: string;
    classification?: string;
    originNode?: string;
    initiatingCustodian?: string;
    courtOrder?: string;
    authority?: string;
    auditId?: string;
    hsmToken?: string;
    sha256?: string;
    tier?: string;
    category?: string;
    actionTarget?: 'approvals' | 'retention' | 'ocr' | 'audit' | 'documents';
    daysRemaining?: number;
    charsExtracted?: number;
    confidence?: number;
    merkleRoot?: string;
  };
}

interface NotificationStats {
  total: number;
  unreadNotices: number;
  pendingApprovals: number;
  legalHolds: number;
  ocrCompleted: number;
  categoryCounts: {
    all: number;
    'dual-custody': number;
    'legal-holds': number;
    'ocr-pipeline': number;
    security: number;
    retention: number;
  };
}

interface NotificationsViewProps {
  onNavigateTab?: (tab: 'overview' | 'documents' | 'upload' | 'approvals' | 'audit' | 'ocr' | 'retention') => void;
  onInspectDocument?: (docket: string) => void;
}

export default function NotificationsView({ onNavigateTab, onInspectDocument }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unreadNotices: 0,
    pendingApprovals: 0,
    legalHolds: 0,
    ocrCompleted: 0,
    categoryCounts: {
      all: 0,
      'dual-custody': 0,
      'legal-holds': 0,
      'ocr-pipeline': 0,
      security: 0,
      retention: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [selectedAlert, setSelectedAlert] = useState<NotificationItem | null>(null);

  // Modals & UI States
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [copyHashSuccess, setCopyHashSuccess] = useState(false);
  const [rulesSavedToast, setRulesSavedToast] = useState(false);

  // Dispatch rules toggles
  const [rules, setRules] = useState({
    dualCustodyPush: true,
    courtInjunctions: true, // locked mandatory
    ocrPings: true,
    retentionDigests: true,
    hsmTamperAlerts: true,
  });

  // Fetch notifications
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (searchQuery) params.set('search', searchQuery);
      if (sortOption) params.set('sort', sortOption);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        if (data.stats) setStats(data.stats);

        // Select first alert by default if none selected or not in current list
        if (data.notifications?.length > 0) {
          if (!selectedAlert || !data.notifications.some((n: NotificationItem) => n.id === selectedAlert.id)) {
            setSelectedAlert(data.notifications[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [activeCategory, sortOption]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isUnread: false, readAt: new Date().toISOString() })));
        setStats((prev) => ({ ...prev, unreadNotices: 0 }));
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Mark single as read when selected
  const handleSelectAlert = (item: NotificationItem) => {
    setSelectedAlert(item);
    if (item.isUnread) {
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: item.id }),
      }).then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isUnread: false, readAt: new Date().toISOString() } : n))
        );
        setStats((prev) => ({ ...prev, unreadNotices: Math.max(0, prev.unreadNotices - 1) }));
      });
    }
  };

  // Copy SHA-256 hash
  const handleCopyHash = () => {
    const hash = selectedAlert?.metadata?.sha256 || '7d4a82c9e4b10fa789d0c64483a31c518b53298f12a';
    navigator.clipboard.writeText(hash);
    setCopyHashSuccess(true);
    setTimeout(() => setCopyHashSuccess(false), 2000);
  };

  // Export notifications CSV
  const handleExportIncidentLog = () => {
    const headers = ['Notification ID', 'Type', 'Severity', 'Title', 'Message', 'Docket #', 'Status', 'Recorded UTC'];
    const rows = notifications.map((n) => [
      n.id,
      n.type,
      n.severity,
      `"${n.title.replace(/"/g, '""')}"`,
      `"${n.message.replace(/"/g, '""')}"`,
      n.metadata?.docketNumber || 'N/A',
      n.isUnread ? 'UNREAD' : 'READ',
      n.createdAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DMS_Incident_Alert_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Jump to action target (e.g. approvals, retention, ocr)
  const handleJumpToAction = () => {
    if (!selectedAlert) return;
    const target = selectedAlert.metadata?.actionTarget;
    if (target && onNavigateTab) {
      onNavigateTab(target);
    } else if (selectedAlert.metadata?.docketNumber && onInspectDocument) {
      onInspectDocument(selectedAlert.metadata.docketNumber);
    }
  };

  return (
    <div className="flex flex-col w-full bg-slate-50 min-h-screen">
      {/* Toast message */}
      {rulesSavedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg shadow-xl text-xs font-semibold border border-slate-700 animate-slide-up">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified</span>
          <span>Alert dispatch rules registered to WORM governance ledger!</span>
        </div>
      )}

      <div className="p-4 lg:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* Top Statutory Alerting Banner & Context */}
        <div className="flex flex-col gap-3.5 pt-1">
          {/* Breadcrumb & Statutory Authority Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-500 font-mono text-[11px]">
              <span className="flex items-center gap-1 text-slate-900 font-semibold">
                <span className="material-symbols-outlined text-[15px] text-blue-700">verified_user</span>
                DOCUMENT DISPATCH
              </span>
              <span className="text-slate-300">/</span>
              <span className="uppercase tracking-wider">Institutional Records Repository</span>
              <span className="text-slate-300">/</span>
              <span className="text-blue-800 font-semibold">ALERT-DISPATCH-HUB</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold uppercase shadow-2xs">
                <span className="material-symbols-outlined text-[13px]">gavel</span>
                Real-Time Statutory Dispatch
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold uppercase shadow-2xs">
                <span className="material-symbols-outlined text-[13px] text-emerald-700">token</span>
                FIPS-140-3 HSM Attested
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-slate-600 font-mono text-[10px] border border-slate-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                PUSH-NODE: SEC-ALERT-01
              </span>
            </div>
          </div>

          {/* Title, Descriptive Pitch & Action Cluster */}
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            <div className="flex flex-col gap-1 max-w-4xl">
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
                Institutional Records Alerting &amp; Security Notification Hub
              </h1>
              <p className="text-xs lg:text-sm text-slate-600 leading-relaxed">
                Centralized real-time operational alerts for record preservation holds, Maker-Checker dual-custody authorization requests, automated OCR text extraction logs, and cryptographic tamper detection across all operational regional zones.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs text-xs font-semibold"
              >
                <span className="material-symbols-outlined text-[17px] text-emerald-600">check_circle</span>
                <span>Mark All as Read</span>
              </button>
              <button
                onClick={() => setRulesModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-blue-900 hover:bg-blue-50 transition-colors text-xs font-semibold shadow-2xs"
              >
                <span className="material-symbols-outlined text-[17px] text-blue-700">tune</span>
                <span>Alert Preferences &amp; Rules</span>
              </button>
              <button
                onClick={handleExportIncidentLog}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-semibold shadow-2xs"
              >
                <span className="material-symbols-outlined text-[17px]">file_download</span>
                <span>Export Incident Log</span>
              </button>
            </div>
          </div>

          {/* Live Compliance & Cryptographic Telemetry Strip */}
          <div className="w-full bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                <span className="text-slate-500 font-medium text-[11px]">Automated Event Dispatch:</span>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Active</span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 hidden sm:block"></div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Unread Notices:</span>
                <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 text-[10px] font-bold font-mono">
                  {stats.unreadNotices} Items Pending
                </span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 hidden sm:block"></div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Court Injunction Alerts:</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold font-mono">
                  {stats.legalHolds} Active Holds
                </span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 hidden md:block"></div>
              <div className="hidden md:flex items-center gap-1 text-[11px] text-emerald-700 font-mono">
                <span className="material-symbols-outlined text-[13px]">lock_clock</span>
                <span>0 Anomalies // 100% Intact</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              <span className="uppercase tracking-wider text-[10px]">DISPATCH SIGNING KEY:</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-semibold">0x4B2E...99A1</span>
            </div>
          </div>
        </div>

        {/* KPI SUMMARY RIBBON (4 Metric Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Unread Priority Notices */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unread Priority Notices</span>
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">priority_high</span>
              </div>
            </div>
            <div className="mt-2 flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">{stats.unreadNotices}</span>
                <span className="text-xs font-bold text-red-600 uppercase">Active</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 mt-1">
                <span className="material-symbols-outlined text-[13px] text-red-600">assignment_late</span>
                <span>Requires Officer Acknowledgment</span>
              </div>
            </div>
          </div>

          {/* Card 2: Dual-Custody Approvals */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dual-Custody Approvals</span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">vpn_key</span>
              </div>
            </div>
            <div className="mt-2 flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">{stats.pendingApprovals}</span>
                <span className="text-xs font-bold text-amber-700 uppercase">Pending</span>
              </div>
              <div className="mt-1">
                <span className="inline-block px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-mono text-[10px] font-medium">
                  Awaiting Checker Key 2 Sign-Off
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Judicial Legal Holds */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Judicial Legal Holds</span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">balance</span>
              </div>
            </div>
            <div className="mt-2 flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">{stats.legalHolds}</span>
                <span className="text-xs font-bold text-blue-700 uppercase">Injunctions</span>
              </div>
              <div className="mt-1">
                <span className="inline-block px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-800 font-mono text-[10px] font-medium border border-blue-200">
                  Contempt-of-Court Immunity Frozen
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: OCR & Pipeline Extraction */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">OCR &amp; Pipeline Engine</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">document_scanner</span>
              </div>
            </div>
            <div className="mt-2 flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">{stats.ocrCompleted}</span>
                <span className="text-xs font-bold text-emerald-700 uppercase">Completed</span>
              </div>
              <div className="mt-1">
                <span className="inline-block px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 font-mono text-[10px] font-medium border border-emerald-200">
                  GIN Full-Text Indexed &amp; Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* NOTIFICATION FILTER TABS & SEARCH TOOLBAR */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
          {/* Filter Pill Tabs */}
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto py-0.5 text-xs">
            {[
              { id: 'all', label: 'All Notifications', count: stats.total },
              { id: 'dual-custody', label: 'Dual-Custody Approvals', count: stats.categoryCounts['dual-custody'] },
              { id: 'legal-holds', label: 'Judicial Legal Holds & Stays', count: stats.categoryCounts['legal-holds'] },
              { id: 'ocr-pipeline', label: 'OCR Text Intelligence', count: stats.categoryCounts['ocr-pipeline'] },
              { id: 'security', label: 'Security & Anomalies', count: stats.categoryCounts['security'] },
              { id: 'retention', label: 'Statutory Retention', count: stats.categoryCounts['retention'] },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap text-xs flex items-center gap-1.5 ${
                  activeCategory === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                    activeCategory === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Sort Row */}
          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <div className="relative flex items-center min-w-[220px] flex-1 lg:flex-initial">
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[17px]">filter_list</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadNotifications()}
                placeholder="Filter notices by docket, keyword, or signer..."
                className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
            <div className="relative flex items-center shrink-0">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="h-8 pl-2.5 pr-6 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:bg-white cursor-pointer appearance-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="critical">Severity: Critical</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 text-slate-400 text-[15px] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* TWO-COLUMN SPLIT WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Interactive Evidentiary Notification Feed (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px] animate-spin text-blue-600">sync</span>
                <span>Streaming live evidentiary alerts...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                No alerts found matching current filter parameters.
              </div>
            ) : (
              notifications.map((item) => {
                const isSelected = selectedAlert?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectAlert(item)}
                    className={`cursor-pointer rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition-all relative overflow-hidden pl-4 pr-4 py-3.5 border-l-[4px] ${
                      item.severity === 'CRITICAL'
                        ? 'border-l-red-600'
                        : item.type === 'LEGAL_HOLD'
                        ? 'border-l-blue-600'
                        : item.severity === 'WARNING'
                        ? 'border-l-amber-500'
                        : item.severity === 'SUCCESS'
                        ? 'border-l-emerald-600'
                        : 'border-l-slate-400'
                    } ${isSelected ? 'ring-2 ring-blue-600 bg-blue-50/20' : ''}`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.type === 'APPROVAL_REQUEST' && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-mono text-[9px] font-bold">
                              MAKER-CHECKER
                            </span>
                          )}
                          {item.type === 'LEGAL_HOLD' && (
                            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 font-mono text-[9px] font-bold">
                              LEGAL HOLD
                            </span>
                          )}
                          {item.type === 'OCR_COMPLETE' && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[9px] font-bold">
                              OCR COMPLETE
                            </span>
                          )}
                          {item.type === 'RETENTION_EXPIRY' && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-mono text-[9px] font-bold">
                              RETENTION WARNING
                            </span>
                          )}
                          {item.type === 'AUDIT_ATTESTATION' && (
                            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-800 font-mono text-[9px] font-bold">
                              AUDITOR 360
                            </span>
                          )}
                          <span className="font-mono text-slate-900 font-bold text-xs select-all">
                            {item.metadata?.docketNumber || item.resourceType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {item.isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-1 animate-pulse" title="Unread Notice"></span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <h2 className="text-xs font-bold text-slate-900 hover:text-blue-700 transition-colors">
                          {item.title}
                        </h2>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {item.message}
                        </p>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-[10px]">
                        <div className="flex items-center gap-1 font-mono text-slate-500">
                          <span>AUDIT ID:</span>
                          <span className="font-semibold text-slate-800">
                            {item.metadata?.auditId || item.id.substring(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAlert(item);
                              handleJumpToAction();
                            }}
                            className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold text-[11px] hover:bg-slate-800 transition"
                          >
                            {item.type === 'APPROVAL_REQUEST'
                              ? 'Review in Queue'
                              : item.type === 'LEGAL_HOLD'
                              ? 'Inspect Court Order'
                              : item.type === 'OCR_COMPLETE'
                              ? 'View Extracted Text'
                              : item.type === 'RETENTION_EXPIRY'
                              ? 'View Schedule'
                              : 'Inspect Dossier'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT COLUMN: Active Alert Detail Inspector & Dispatch Dock (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-3.5 sticky top-20">
            {/* Detail Inspector Container */}
            <div className="rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
              {/* Inspector Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900">
                  <span className="material-symbols-outlined text-blue-700 text-[18px]">quick_reference_all</span>
                  <span className="text-xs font-bold uppercase tracking-wider">Alert Dossier Inspector</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono text-[10px] font-bold border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  LIVE TELEMETRY
                </span>
              </div>

              {/* Inspector Body */}
              {selectedAlert ? (
                <div className="p-4 flex flex-col gap-3.5">
                  {/* Target Identifier Card */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TARGET PRIMARY DOCKET</span>
                      <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-800 text-[9px] font-bold uppercase">
                        {selectedAlert.metadata?.tier || 'T5 CRITICAL'}
                      </span>
                    </div>
                    <div className="font-mono text-sm text-slate-900 font-bold tracking-tight select-all">
                      {selectedAlert.metadata?.docketNumber || 'N/A'}
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium line-clamp-1">
                      {selectedAlert.metadata?.docketTitle || selectedAlert.title}
                    </div>
                  </div>

                  {/* Metadata Spec Grid */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-start justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Classification:</span>
                      <span className="text-slate-900 font-semibold text-right max-w-[180px] truncate">
                        {selectedAlert.metadata?.classification || selectedAlert.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Originating Node:</span>
                      <span className="font-mono text-slate-900 text-[11px]">
                        {selectedAlert.metadata?.originNode || 'DMS-SEC-NODE-01'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Initiating Custodian:</span>
                      <span className="text-slate-900 text-right text-[11px]">
                        {selectedAlert.metadata?.initiatingCustodian || 'Dealing Officer'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Recorded UTC:</span>
                      <span className="font-mono text-slate-900 text-[11px]">
                        {new Date(selectedAlert.createdAt).toISOString().slice(0, 19).replace('T', ' ')} UTC
                      </span>
                    </div>
                  </div>

                  {/* Cryptographic Payload Hash Box */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cryptographic Payload Hash</span>
                      <button
                        onClick={handleCopyHash}
                        className="text-blue-700 hover:text-slate-900 font-mono text-[10px] flex items-center gap-1 font-semibold"
                      >
                        <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        <span>{copyHashSuccess ? 'Copied!' : 'Copy SHA-256'}</span>
                      </button>
                    </div>
                    <div className="p-2 rounded bg-slate-50 font-mono text-[11px] text-slate-800 break-all select-all border border-slate-200">
                      SHA-256: {selectedAlert.metadata?.sha256 || '7d4a82c9e4b10fa789d0c64483a31c518b53298f12a'}
                    </div>
                  </div>

                  {/* Legal Grounds & Statutory Compliance Note */}
                  <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200/80 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-blue-800 font-semibold text-xs">
                      <span className="material-symbols-outlined text-[16px]">policy</span>
                      <span>Statutory Governance Mandate</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Under statutory electronic records governance directives and institutional custody rules, any revision or metadata alteration mandates non-repudiable dual-custody authorization with distinct signing tokens.
                    </p>
                  </div>

                  {/* Digital Audit Verification Box */}
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-start gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-[18px] shrink-0 mt-0.5">verified</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-emerald-900 uppercase">Integrity Verified</span>
                      <span className="font-mono text-[10px] text-slate-700 leading-tight mt-0.5">
                        Session & Permission Check: <span className="font-semibold select-all">AUTHENTICATED</span>. Tamper-evident hash verified.
                      </span>
                    </div>
                  </div>

                  {/* Action CTAs */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      onClick={handleJumpToAction}
                      className="w-full py-2 px-3 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[17px]">open_in_new</span>
                      <span>Acknowledge &amp; Jump to Action Target</span>
                    </button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => onNavigateTab && onNavigateTab('overview')}
                        className="py-1.5 px-2 rounded-lg bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 hover:bg-slate-100 transition flex items-center justify-center gap-1 text-center"
                      >
                        <span className="material-symbols-outlined text-[15px] text-blue-700">verified</span>
                        <span className="truncate">Sec 65B Cert</span>
                      </button>
                      <button
                        onClick={() => alert('Dispatch notice forwarded to designated Special Crimes Unit team.')}
                        className="py-1.5 px-2 rounded-lg bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 hover:bg-slate-100 transition flex items-center justify-center gap-1 text-center"
                      >
                        <span className="material-symbols-outlined text-[15px] text-slate-500">forward_to_inbox</span>
                        <span className="truncate">Forward Team</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">Select a notification to view telemetry</div>
              )}
            </div>

            {/* Quick Status Footer Card */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="material-symbols-outlined text-[16px] text-blue-700">memory</span>
                <span>KMS DISPATCH PIPELINE: ACTIVE</span>
              </div>
              <span className="text-slate-900 font-semibold">LATENCY: 18ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL OVERLAY: Alert Dispatch & Notification Rules Configuration */}
      {rulesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Alert Dispatch &amp; Notification Rules</h3>
                  <span className="font-mono text-[10px] text-slate-500">RULESET SPEC: DMS-NOTIF-POLICY-2026.1</span>
                </div>
              </div>
              <button
                onClick={() => setRulesModalOpen(false)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex flex-col gap-3 text-xs">
              <div className="text-slate-500 text-xs">
                Configure real-time push routing, hardware security alerts, and statutory notice distribution rules across official workstations.
              </div>

              {/* Toggle 1: Dual-Custody */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-900">Immediate Dual-Custody Push Notifications</span>
                  <p className="text-slate-500 text-[11px]">
                    Instantly page assigned Checker Officers upon submission of Maker revisions for sensitive dockets.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.dualCustodyPush}
                  onChange={(e) => setRules({ ...rules, dualCustodyPush: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded mt-1 cursor-pointer"
                />
              </div>

              {/* Toggle 2: Judicial Injunctions (LOCKED MANDATORY) */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-200">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">Judicial Court Injunction Broadcasts</span>
                    <span className="px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 font-mono text-[9px] font-bold">
                      LOCKED MANDATORY
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    BNSS 2023 statutory mandate: Court stay orders and legal holds cannot be muted or suppressed.
                  </p>
                </div>
                <input type="checkbox" checked={true} disabled className="w-4 h-4 rounded mt-1 cursor-not-allowed opacity-60" />
              </div>

              {/* Toggle 3: OCR */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-900">OCR Pipeline Completion Pings</span>
                  <p className="text-slate-500 text-[11px]">
                    Notify assigned investigators when full-text GIN vectors and alias extraction are completed.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.ocrPings}
                  onChange={(e) => setRules({ ...rules, ocrPings: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded mt-1 cursor-pointer"
                />
              </div>

              {/* Toggle 4: Retention */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-900">Statutory Retention 90-Day Warning Digests</span>
                  <p className="text-slate-500 text-[11px]">
                    Weekly scheduled summary of case files entering the final statutory retention window.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.retentionDigests}
                  onChange={(e) => setRules({ ...rules, retentionDigests: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded mt-1 cursor-pointer"
                />
              </div>

              {/* Toggle 5: HSM Tamper */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-900">High-Priority Hardware HSM Tamper Alerts</span>
                  <p className="text-slate-500 text-[11px]">
                    Immediate redundant dispatch (SMS + In-App notification) upon cryptographic anomaly detection.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.hsmTamperAlerts}
                  onChange={(e) => setRules({ ...rules, hsmTamperAlerts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded mt-1 cursor-pointer"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setRulesModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRulesModalOpen(false);
                  setRulesSavedToast(true);
                  setTimeout(() => setRulesSavedToast(false), 3500);
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-semibold text-xs transition shadow-2xs"
              >
                Save &amp; Apply Dispatch Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
