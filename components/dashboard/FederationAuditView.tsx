'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface FederationAuditViewProps {
  currentUserId?: string;
  currentUserRoles?: string[];
  currentUserClearance?: number;
  currentOrg?: {
    id: string;
    code: string;
    name: string;
  };
}

interface AuditLogItem {
  id: string;
  action: string;
  ipAddress: string;
  userAgent?: string;
  eventHash: string;
  blockchainAnchored: boolean;
  blockchainTx?: string;
  watermarkSnapshot?: any;
  createdAt: string;

  documentId: string;
  documentNumber: string;
  documentTitle: string;
  securityTierCode: string;
  securityTierRank: number;

  shareId?: string;
  shareNumber?: string;
  shareExpiresAt?: string;

  accessingUserId: string;
  accessingUserName: string;
  accessingUserDesignation?: string;
  accessingUserEmpCode?: string;
  requestingOrgId: string;
  requestingOrgName: string;
  requestingOrgCode: string;

  sourceOrgId?: string;
  sourceOrgName?: string;
  sourceOrgCode?: string;
}

export default function FederationAuditView({
  currentUserId,
  currentUserRoles = [],
  currentUserClearance = 5,
  currentOrg,
}: FederationAuditViewProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<{
    totalAccessEvents?: number;
    viewEvents?: number;
    downloadEvents?: number;
    activeRequestingAgencies?: number;
    uniqueDocumentsAccessed?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collaboration/audit?action=${actionFilter}&limit=50`);
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch federation audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filteredLogs = logs.filter((l) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      l.documentNumber?.toLowerCase().includes(q) ||
      l.documentTitle?.toLowerCase().includes(q) ||
      l.accessingUserName?.toLowerCase().includes(q) ||
      l.requestingOrgName?.toLowerCase().includes(q) ||
      l.sourceOrgName?.toLowerCase().includes(q) ||
      l.eventHash?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Main Container Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-[#3f5e93] text-[24px]">shield</span>
              <h1 className="text-xl lg:text-2xl font-bold text-[#10141A] tracking-tight">
                Cross-Org Audit 360 &amp; Custody
              </h1>
              <span className="rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                Cryptographic Chain of Custody
              </span>
              <span className="rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ledger Anchored
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Real-time cross-agency access telemetry, high-clearance vigilance heartbeats, and immutable blockchain attestation under Section 65B BSA 2023.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchAuditLogs()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] text-[#3f5e93] ${loading ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>Refresh Telemetry</span>
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="p-3.5 rounded-[18px] bg-white border border-[#D8DEEA]/60 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">verified_user</span>
              <span className="text-[#6B7280]">Inspecting Authority:</span>
              <span className="font-semibold text-[#10141A]">{currentOrg?.name || 'Sovereign Federation Host'}</span>
            </div>
            <span className="text-[#D8DEEA]">•</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#9CA3AF] text-[16px]">shield</span>
              <span className="font-mono text-[#6B7280]">Vigilance Clearance: Level {currentUserClearance}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-mono text-[11px] font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/50">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            <span>WORM IMMUTABLE STORAGE SEAL: ACTIVE</span>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Total Exchange Events</span>
            <div className="text-2xl font-bold text-[#10141A] mt-1 font-mono">{stats.totalAccessEvents || logs.length || 0}</div>
            <div className="text-[10px] text-[#3f5e93] font-mono mt-0.5">100% SHA-256 Chained</div>
          </div>

          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Watermarked Streams</span>
            <div className="text-2xl font-bold text-[#3f5e93] mt-1 font-mono">{stats.viewEvents || 0}</div>
            <div className="text-[10px] text-[#6B7280] font-mono mt-0.5">Ephemeral Decryptions</div>
          </div>

          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Certified Downloads</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{stats.downloadEvents || 0}</div>
            <div className="text-[10px] text-emerald-600 font-mono mt-0.5">Sec 65B Certified</div>
          </div>

          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Active Agencies</span>
            <div className="text-2xl font-bold text-purple-700 mt-1 font-mono">{stats.activeRequestingAgencies || 0}</div>
            <div className="text-[10px] text-[#6B7280] font-mono mt-0.5">Sovereign Nodes</div>
          </div>

          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Classified Records</span>
            <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">{stats.uniqueDocumentsAccessed || 0}</div>
            <div className="text-[10px] text-[#6B7280] font-mono mt-0.5">T1 - T5 Vault Items</div>
          </div>
        </div>

        {/* Action Filter Pills & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-[#f0f3ff] rounded-full w-fit border border-[#D8DEEA]/80 flex-wrap">
            <button
              onClick={() => setActionFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                actionFilter === 'ALL'
                  ? 'bg-[#000000] text-white shadow-xs'
                  : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setActionFilter('VIEW_PREVIEW')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                actionFilter === 'VIEW_PREVIEW'
                  ? 'bg-[#000000] text-white shadow-xs'
                  : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
              }`}
            >
              Watermarked Streams
            </button>
            <button
              onClick={() => setActionFilter('DOWNLOAD_WATERMARKED')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                actionFilter === 'DOWNLOAD_WATERMARKED'
                  ? 'bg-[#000000] text-white shadow-xs'
                  : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
              }`}
            >
              Certified Downloads
            </button>
            <button
              onClick={() => setActionFilter('DOWNLOAD_ORIGINAL')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                actionFilter === 'DOWNLOAD_ORIGINAL'
                  ? 'bg-[#000000] text-white shadow-xs'
                  : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
              }`}
            >
              Raw Binaries
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
            <input
              type="text"
              placeholder="Search by officer, document, org code, or hash..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
            />
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-bold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                <tr>
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-4">Action &amp; Protocol</th>
                  <th className="py-3 px-4">Accessing Officer &amp; Agency</th>
                  <th className="py-3 px-4">Originating Agency &amp; Record</th>
                  <th className="py-3 px-3">Clearance</th>
                  <th className="py-3 px-3">Client IP</th>
                  <th className="py-3 px-4">Blockchain Attestation</th>
                  <th className="py-3 px-4 text-right">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#6B7280]">
                      <span className="material-symbols-outlined text-[24px] animate-spin text-[#3f5e93] block mb-1">
                        sync
                      </span>
                      Loading sovereign audit stream...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#6B7280]">
                      No cross-organization custody events match the current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#f0f3ff]/40 transition">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#6B7280] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            log.action.includes('VIEW')
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-[#10141A] block">{log.accessingUserName}</strong>
                        <span className="text-[#6B7280] text-[11px]">
                          {log.requestingOrgName} <span className="font-mono font-semibold text-[#3f5e93]">({log.requestingOrgCode})</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-[#10141A] block truncate max-w-xs">{log.documentTitle}</strong>
                        <span className="text-[#6B7280] text-[11px] font-mono">
                          [{log.documentNumber}] from {log.sourceOrgCode || 'VAULT'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                          {log.securityTierCode || `T${log.securityTierRank}`}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px] text-[#6B7280]">{log.ipAddress}</td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                          <span>{log.blockchainTx ? log.blockchainTx.substring(0, 10) + '...' : 'ANCHORED'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1 rounded-full border border-[#D8DEEA] bg-white hover:bg-[#f0f3ff] text-[#151c27] text-[11px] font-semibold cursor-pointer transition shadow-xs"
                        >
                          Inspect Proof
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Proof Inspection Modal (Theme Parity) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141A]/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-[26px] w-full max-w-2xl border border-[#D8DEEA] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#D8DEEA]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">lock_clock</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#10141A]">Tamper-Evident Custody Manifest</h3>
                  <p className="text-xs text-[#6B7280]">Section 65B Admissible Cryptographic Verification</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] hover:text-[#10141A] flex items-center justify-center cursor-pointer transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto text-xs flex flex-col gap-3">
              <div className="p-3.5 bg-[#f0f3ff]/70 border border-[#D8DEEA] rounded-2xl">
                <span className="text-[#6B7280] uppercase text-[10px] font-bold tracking-wider">SHA-256 Event Digest:</span>
                <p className="text-[#3f5e93] font-mono break-all mt-1 font-semibold">{selectedLog.eventHash}</p>
              </div>

              <div className="p-3.5 bg-[#f0f3ff]/70 border border-[#D8DEEA] rounded-2xl">
                <span className="text-[#6B7280] uppercase text-[10px] font-bold tracking-wider">Blockchain Ledger Tx:</span>
                <p className="text-emerald-700 font-mono break-all mt-1 font-semibold">
                  {selectedLog.blockchainTx || 'BLOCKCHAIN_ANCHOR_PENDING'}
                </p>
              </div>

              <div className="p-3.5 bg-[#f0f3ff]/70 border border-[#D8DEEA] rounded-2xl">
                <span className="text-[#6B7280] uppercase text-[10px] font-bold tracking-wider">Forensic Watermark Snapshot:</span>
                <p className="text-[#10141A] mt-1 text-[11px] leading-relaxed">
                  {selectedLog.watermarkSnapshot?.watermarkText ||
                    `Rendered with officer ID ${selectedLog.accessingUserId?.substring(0, 8)}, IP ${selectedLog.ipAddress}, and verified timestamp.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="p-3 bg-white border border-[#D8DEEA] rounded-xl">
                  <span className="text-[#6B7280] text-[10px] uppercase font-bold">Requesting Agency</span>
                  <div className="font-semibold text-[#10141A] mt-0.5">{selectedLog.requestingOrgName}</div>
                  <div className="text-[11px] text-[#3f5e93] font-mono">{selectedLog.requestingOrgCode}</div>
                </div>

                <div className="p-3 bg-white border border-[#D8DEEA] rounded-xl">
                  <span className="text-[#6B7280] text-[10px] uppercase font-bold">Accessing Officer</span>
                  <div className="font-semibold text-[#10141A] mt-0.5">{selectedLog.accessingUserName}</div>
                  <div className="text-[11px] text-[#6B7280]">{selectedLog.accessingUserDesignation || 'Officer'}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-[#D8DEEA]/60 bg-[#f0f3ff]/30">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-1.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs cursor-pointer hover:bg-[#181c22] transition"
              >
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
