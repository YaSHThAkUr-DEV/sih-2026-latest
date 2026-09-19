'use client';

import React, { useState, useEffect } from 'react';

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
    transactionId?: string;
    blockNumber?: number;
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
    const hash = selectedAlert?.metadata?.sha256 || selectedAlert?.metadata?.transactionId || '';
    if (!hash) return;
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

  // Jump to action target
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
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {rulesSavedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-[#10141A] text-white rounded-full shadow-2xl text-xs font-medium border border-[#D8DEEA]/40 animate-slide-up">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified</span>
          <span>Alert dispatch rules registered to WORM governance ledger</span>
        </div>
      )}

      {/* Main Surface Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3f5e93] text-[22px]">notifications_active</span>
              <h1 className="text-xl lg:text-2xl font-semibold text-[#10141A] tracking-tight">
                Alerts & Security Dispatch Hub
              </h1>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                Live Dispatch
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Real-time operational alerts for legal preservation holds, Maker-Checker authorizations, OCR pipeline completions, and cryptographic ledger updates.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">done_all</span>
              <span>Mark All Read</span>
            </button>
            <button
              onClick={() => setRulesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">tune</span>
              <span>Dispatch Rules</span>
            </button>
            <button
              onClick={handleExportIncidentLog}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-medium transition-all shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export Incident Log</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Unread Notices</span>
              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <span className="material-symbols-outlined text-[18px]">priority_high</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.unreadNotices}</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Requires Officer Acknowledgment</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Dual-Custody Approvals</span>
              <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <span className="material-symbols-outlined text-[18px]">vpn_key</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.pendingApprovals}</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Awaiting Checker Key Sign-Off</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Judicial Legal Holds</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">gavel</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.legalHolds}</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3f5e93]"></span>
                <span>Court Order Immunity Locked</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">OCR Pipeline Ingest</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <span className="material-symbols-outlined text-[18px]">document_scanner</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.ocrCompleted}</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Indexed for Full-Text Search</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Navigation & Search Bar */}
        <div className="bg-white rounded-[20px] p-3 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
            {[
              { id: 'all', label: 'All Notices', count: stats.total },
              { id: 'dual-custody', label: 'Approvals', count: stats.categoryCounts['dual-custody'] },
              { id: 'legal-holds', label: 'Legal Holds', count: stats.categoryCounts['legal-holds'] },
              { id: 'ocr-pipeline', label: 'OCR Pipeline', count: stats.categoryCounts['ocr-pipeline'] },
              { id: 'security', label: 'Security', count: stats.categoryCounts['security'] },
              { id: 'retention', label: 'Retention', count: stats.categoryCounts['retention'] },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeCategory === tab.id
                    ? 'bg-[#000000] text-white shadow-sm'
                    : 'text-[#6B7280] hover:text-[#10141A] hover:bg-[#f0f3ff]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    activeCategory === tab.id ? 'bg-white/20 text-white' : 'bg-[#E9ECF4] text-[#6B7280]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center min-w-[220px] flex-1">
              <span className="material-symbols-outlined absolute left-3 text-[#9CA3AF] text-[16px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadNotifications()}
                placeholder="Search notices, docket, or signer..."
                className="w-full h-8 pl-9 pr-3 rounded-full bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
              />
            </div>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="h-8 px-3 rounded-full bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] font-medium focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="critical">Severity: Critical</option>
            </select>
          </div>
        </div>

        {/* Two-Column Split Feed and Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Feed List (8 Cols) */}
          <div className="lg:col-span-8 space-y-3">
            {loading ? (
              <div className="p-12 text-center text-[#6B7280] text-xs bg-white rounded-[20px] border border-[#D8DEEA]/60 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px] animate-spin text-[#3f5e93]">sync</span>
                <span>Streaming live alerts...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-[#6B7280] text-xs bg-white rounded-[20px] border border-[#D8DEEA]/60">
                No alerts found matching current filter parameters.
              </div>
            ) : (
              notifications.map((item) => {
                const isSelected = selectedAlert?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectAlert(item)}
                    className={`cursor-pointer rounded-[20px] bg-white border border-[#D8DEEA]/60 shadow-[0_2px_8px_rgba(16,20,26,0.03)] hover:shadow-[0_4px_16px_rgba(16,20,26,0.06)] transition-all p-4 border-l-4 ${
                      item.severity === 'CRITICAL'
                        ? 'border-l-rose-500'
                        : item.type === 'LEGAL_HOLD'
                        ? 'border-l-[#3f5e93]'
                        : item.severity === 'WARNING'
                        ? 'border-l-amber-500'
                        : item.severity === 'SUCCESS'
                        ? 'border-l-emerald-500'
                        : 'border-l-slate-400'
                    } ${isSelected ? 'ring-2 ring-[#3f5e93] bg-[#f0f3ff]/40' : ''}`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.type === 'APPROVAL_REQUEST' && (
                            <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50">
                              Maker-Checker
                            </span>
                          )}
                          {item.type === 'LEGAL_HOLD' && (
                            <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                              Legal Hold
                            </span>
                          )}
                          {item.type === 'OCR_COMPLETE' && (
                            <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                              OCR Indexed
                            </span>
                          )}
                          {item.type === 'RETENTION_EXPIRY' && (
                            <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50">
                              Retention Warning
                            </span>
                          )}
                          {item.type === 'AUDIT_ATTESTATION' && (
                            <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200/50">
                              Auditor 360
                            </span>
                          )}
                          {item.type === 'BLOCKCHAIN_ANCHOR' && (
                            <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Blockchain Sealed
                            </span>
                          )}
                          <span className="font-mono text-[#10141A] font-semibold text-xs select-all">
                            {item.metadata?.docketNumber || item.resourceType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[#6B7280] font-mono text-[11px]">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {item.isUnread && (
                            <span className="w-2 h-2 rounded-full bg-[#3f5e93] ml-1 animate-pulse" title="Unread Notice"></span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-xs font-semibold text-[#10141A]">
                          {item.title}
                        </h2>
                        <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-2 mt-0.5">
                          {item.message}
                        </p>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#D8DEEA]/40 text-[11px]">
                        <div className="flex items-center gap-1 font-mono text-[#6B7280]">
                          <span>Audit ID:</span>
                          <span className="font-medium text-[#10141A]">
                            {item.metadata?.auditId || item.id.substring(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAlert(item);
                            handleJumpToAction();
                          }}
                          className="px-3 py-1 rounded-full bg-[#000000] text-white font-medium text-[11px] hover:bg-[#181c22] transition shadow-xs"
                        >
                          {item.type === 'APPROVAL_REQUEST'
                            ? 'Review in Queue'
                            : item.type === 'LEGAL_HOLD'
                            ? 'Inspect Order'
                            : item.type === 'OCR_COMPLETE'
                            ? 'View Extracted Text'
                            : item.type === 'RETENTION_EXPIRY'
                            ? 'View Schedule'
                            : item.type === 'BLOCKCHAIN_ANCHOR'
                            ? 'Inspect in Ledger'
                            : 'Inspect Dossier'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Alert Dossier Inspector (4 Cols) */}
          <div className="lg:col-span-4 sticky top-24">
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
                <div className="flex items-center gap-1.5 text-[#10141A]">
                  <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">quick_reference_all</span>
                  <span className="text-xs font-semibold uppercase tracking-wider">Alert Inspector</span>
                </div>
                <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Telemetry
                </span>
              </div>

              {selectedAlert ? (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-[16px] bg-[#f0f3ff]/60 border border-[#D8DEEA]/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-wider">Target Docket</span>
                      <span className={`rounded-full text-[9px] font-semibold px-2 py-0.5 uppercase ${
                        selectedAlert.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                        selectedAlert.severity === 'WARNING' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {selectedAlert.metadata?.tier || (selectedAlert.severity === 'CRITICAL' ? 'T5 Critical' : 'Standard')}
                      </span>
                    </div>
                    <div className="font-mono text-sm text-[#10141A] font-bold tracking-tight select-all">
                      {selectedAlert.metadata?.docketNumber || 'N/A'}
                    </div>
                    <div className="text-[11px] text-[#6B7280] truncate">
                      {selectedAlert.metadata?.docketTitle || selectedAlert.title}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-[#D8DEEA]/40">
                      <span className="text-[#6B7280]">Classification:</span>
                      <span className="text-[#10141A] font-medium text-right truncate max-w-[170px]">
                        {selectedAlert.metadata?.classification || selectedAlert.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#D8DEEA]/40">
                      <span className="text-[#6B7280]">Origin Node:</span>
                      <span className="font-mono text-[#10141A] text-[11px]">
                        {selectedAlert.metadata?.originNode || 'DMS-SEC-NODE-01'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#D8DEEA]/40">
                      <span className="text-[#6B7280]">Recorded UTC:</span>
                      <span className="font-mono text-[#10141A] text-[11px]">
                        {new Date(selectedAlert.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-wider">Payload SHA-256</span>
                      <button
                        onClick={handleCopyHash}
                        className="text-[#3f5e93] hover:text-[#10141A] font-mono text-[10px] flex items-center gap-1 font-medium"
                      >
                        <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        <span>{copyHashSuccess ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-2 rounded-xl bg-[#f0f3ff] font-mono text-[10px] text-[#10141A] break-all select-all border border-[#D8DEEA]">
                      {selectedAlert.metadata?.sha256 || selectedAlert.metadata?.transactionId || 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 rounded-[16px] bg-[rgba(131,162,219,0.1)] border border-[#83A2DB]/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-[#3f5e93] font-medium text-xs">
                      <span className="material-symbols-outlined text-[15px]">verified</span>
                      <span>Statutory Custody Mandate</span>
                    </div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">
                      Electronic records governance requires dual-custody verification with distinct cryptographic signing tokens for any modification.
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleJumpToAction}
                      className="w-full py-2 px-4 rounded-full bg-[#000000] text-white font-medium text-xs hover:bg-[#181c22] transition flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Jump to Action Target</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-[#6B7280] text-xs">Select an alert notice to view telemetry</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Dispatch & Rules Modal */}
      {rulesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-[26px] p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#10141A]">Alert Dispatch Preferences</h3>
                  <span className="font-mono text-[10px] text-[#6B7280]">POLICY SPEC: DMS-NOTIF-2026</span>
                </div>
              </div>
              <button
                onClick={() => setRulesModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start justify-between gap-3 p-3.5 rounded-[16px] bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#10141A]">Dual-Custody Push Notifications</div>
                  <p className="text-[#6B7280] text-[11px]">
                    Alert assigned Checker Officers upon submission of Maker revisions.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.dualCustodyPush}
                  onChange={(e) => setRules({ ...rules, dualCustodyPush: e.target.checked })}
                  className="w-4 h-4 text-[#3f5e93] rounded mt-1 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between gap-3 p-3.5 rounded-[16px] bg-[rgba(131,162,219,0.1)] border border-[#83A2DB]/30">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#10141A]">Judicial Legal Holds</span>
                    <span className="rounded-full text-[9px] font-semibold px-2 py-0.2 bg-[rgba(131,162,219,0.2)] text-[#3f5e93]">
                      Mandatory
                    </span>
                  </div>
                  <p className="text-[#6B7280] text-[11px]">
                    Court injunctions and legal holds cannot be muted or suppressed.
                  </p>
                </div>
                <input type="checkbox" checked={true} disabled className="w-4 h-4 rounded mt-1 cursor-not-allowed opacity-60" />
              </div>

              <div className="flex items-start justify-between gap-3 p-3.5 rounded-[16px] bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#10141A]">OCR Pipeline Completion Pings</div>
                  <p className="text-[#6B7280] text-[11px]">
                    Notify investigators when text extraction vectors are completed.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.ocrPings}
                  onChange={(e) => setRules({ ...rules, ocrPings: e.target.checked })}
                  className="w-4 h-4 text-[#3f5e93] rounded mt-1 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between gap-3 p-3.5 rounded-[16px] bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#10141A]">Retention Expiry Warning Digests</div>
                  <p className="text-[#6B7280] text-[11px]">
                    Scheduled alerts for records entering statutory retention disposal window.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.retentionDigests}
                  onChange={(e) => setRules({ ...rules, retentionDigests: e.target.checked })}
                  className="w-4 h-4 text-[#3f5e93] rounded mt-1 cursor-pointer"
                />
              </div>

              <div className="flex items-start justify-between gap-3 p-3.5 rounded-[16px] bg-[#f0f3ff]/60 border border-[#D8DEEA]/60">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#10141A]">HSM Hardware Integrity Alerts</div>
                  <p className="text-[#6B7280] text-[11px]">
                    Immediate alerts upon cryptographic anomaly or tamper detection.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rules.hsmTamperAlerts}
                  onChange={(e) => setRules({ ...rules, hsmTamperAlerts: e.target.checked })}
                  className="w-4 h-4 text-[#3f5e93] rounded mt-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8DEEA]/60">
              <button
                onClick={() => setRulesModalOpen(false)}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRulesModalOpen(false);
                  setRulesSavedToast(true);
                  setTimeout(() => setRulesSavedToast(false), 3500);
                }}
                className="px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-medium transition shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
              >
                Save Dispatch Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
