'use client';

import React, { useState, useEffect } from 'react';

interface UserProfileDossierModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfileData {
  profile: {
    id: string;
    fullName: string;
    email: string;
    employeeCode: string;
    designation: string;
    department: string;
    departmentCode: string;
    status: string;
    roles: string[];
    createdAt: string;
    lastLoginAt: string | null;
  };
  stats: {
    totalEvents: number;
    uploadsCount: number;
    downloadsCount: number;
    approvalsCount: number;
    rejectionsCount: number;
    loginsCount: number;
    violationsCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
  events: Array<{
    id: string;
    eventType: string;
    result: string;
    ipAddress: string;
    userAgent?: string;
    failureReason?: string;
    metadata?: Record<string, unknown>;
    eventHash: string;
    createdAt: string;
    timeUtc: string;
    documentId?: string;
    documentNumber?: string;
    documentTitle?: string;
    fileName?: string;
    fileSize?: number;
  }>;
}

export function UserProfileDossierModal({
  userId,
  isOpen,
  onClose,
}: UserProfileDossierModalProps) {
  const [data, setData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [page, setPage] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let active = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          eventType: eventTypeFilter,
          search: searchTerm,
        });

        const res = await fetch(`/api/auditor/users/${userId}/activity?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch user dossier');
        }
        const json = await res.json();
        if (active) setData(json);
      } catch (e: unknown) {
        if (active) {
          const msg = e instanceof Error ? e.message : 'Error loading activity dossier';
          setError(msg);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      active = false;
    };
  }, [isOpen, userId, page, eventTypeFilter, searchTerm]);

  if (!isOpen) return null;

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit_Dossier_${data.profile.employeeCode}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!data || !data.events.length) return;
    const headers = ['Timestamp_UTC', 'Event_Type', 'Result', 'IP_Address', 'Document_Number', 'Document_Title', 'Event_Hash'];
    const rows = data.events.map((e) => [
      `"${e.timeUtc}"`,
      `"${e.eventType}"`,
      `"${e.result}"`,
      `"${e.ipAddress}"`,
      `"${e.documentNumber || 'N/A'}"`,
      `"${(e.documentTitle || '').replace(/"/g, '""')}"`,
      `"${e.eventHash || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Activity_Ledger_${data.profile.employeeCode}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-[26px] shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#D8DEEA]/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#10141A] tracking-tight">
                  Forensic Activity Dossier
                </h2>
                <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 uppercase">
                  Section 65B Audit Trail
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Chronological event ledger and cryptographic provenance profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[#10141A]">
          
          {loading && !data && (
            <div className="py-20 flex flex-col items-center justify-center text-[#6B7280] gap-2">
              <span className="material-symbols-outlined text-[32px] animate-spin text-[#3f5e93]">sync</span>
              <p className="text-xs font-medium">Retrieving authenticated activity ledger...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-[16px] text-rose-700 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600">error</span>
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* Profile Summary Banner */}
              <div className="bg-[#f0f3ff]/60 border border-[#D8DEEA]/60 rounded-[20px] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#10141A] text-white flex items-center justify-center font-bold text-sm">
                    {data.profile.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[#10141A]">{data.profile.fullName}</h3>
                      <span className="font-mono text-xs px-2 py-0.5 bg-[#E9ECF4] text-[#6B7280] rounded-full">
                        {data.profile.employeeCode}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${
                        data.profile.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                      }`}>
                        {data.profile.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {data.profile.designation} • <span className="font-medium text-[#10141A]">{data.profile.department}</span>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] mt-1 flex items-center gap-2">
                      <span>Email: <strong className="text-[#6B7280] font-medium">{data.profile.email}</strong></span>
                      <span>•</span>
                      <span>Roles: <strong className="text-[#6B7280] font-medium">{data.profile.roles.join(', ')}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  <button
                    onClick={handleExportCsv}
                    className="px-3.5 py-1.5 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full text-xs font-medium flex items-center gap-1.5 shadow-xs transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">table_chart</span>
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={handleExportJson}
                    className="px-3.5 py-1.5 bg-[#000000] hover:bg-[#181c22] text-white rounded-full text-xs font-medium flex items-center gap-1.5 shadow-[0_6px_18px_rgba(16,20,26,0.22)] transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Dossier JSON</span>
                  </button>
                </div>
              </div>

              {/* Lifetime Activity Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex flex-col shadow-xs">
                  <span className="text-[10px] font-medium uppercase text-[#6B7280]">Total Actions</span>
                  <span className="text-lg font-bold text-[#10141A] mt-1">{data.stats.totalEvents}</span>
                  <span className="text-[10px] text-[#9CA3AF]">Recorded events</span>
                </div>
                <div className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex flex-col shadow-xs">
                  <span className="text-[10px] font-medium uppercase text-[#3f5e93]">Uploads</span>
                  <span className="text-lg font-bold text-[#3f5e93] mt-1">{data.stats.uploadsCount}</span>
                  <span className="text-[10px] text-[#9CA3AF]">Ingested files</span>
                </div>
                <div className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex flex-col shadow-xs">
                  <span className="text-[10px] font-medium uppercase text-amber-600">Downloads</span>
                  <span className="text-lg font-bold text-amber-600 mt-1">{data.stats.downloadsCount}</span>
                  <span className="text-[10px] text-[#9CA3AF]">DEK unwrap</span>
                </div>
                <div className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex flex-col shadow-xs">
                  <span className="text-[10px] font-medium uppercase text-emerald-600">Approvals</span>
                  <span className="text-lg font-bold text-emerald-600 mt-1">{data.stats.approvalsCount}</span>
                  <span className="text-[10px] text-[#9CA3AF]">Sign-offs</span>
                </div>
                <div className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex flex-col shadow-xs">
                  <span className="text-[10px] font-medium uppercase text-purple-600">Rejections</span>
                  <span className="text-lg font-bold text-purple-600 mt-1">{data.stats.rejectionsCount}</span>
                  <span className="text-[10px] text-[#9CA3AF]">Denied</span>
                </div>
                <div className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex flex-col shadow-xs">
                  <span className="text-[10px] font-medium uppercase text-indigo-600">Logins</span>
                  <span className="text-lg font-bold text-indigo-600 mt-1">{data.stats.loginsCount}</span>
                  <span className="text-[10px] text-[#9CA3AF]">Sessions</span>
                </div>
                <div className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex flex-col shadow-xs">
                  <span className="text-[10px] font-medium uppercase text-rose-600">Flags</span>
                  <span className={`text-lg font-bold mt-1 ${data.stats.violationsCount > 0 ? 'text-rose-600' : 'text-[#9CA3AF]'}`}>
                    {data.stats.violationsCount}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF]">Denials</span>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-[#6B7280]">Filter:</span>
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => {
                      setEventTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-[#151c27] font-medium focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Action Classes</option>
                    <option value="UPLOAD">Uploads & Ingestion</option>
                    <option value="DOWNLOAD">Downloads & Reads</option>
                    <option value="DEK">DEK Unwraps</option>
                    <option value="APPROV">Approvals</option>
                    <option value="REJECT">Rejections</option>
                    <option value="LOGIN">Auth & Sessions</option>
                    <option value="FAIL">Errors & Denials</option>
                  </select>
                </div>

                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2 text-[16px] text-[#9CA3AF]">search</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search docket, hash, or IP..."
                    className="pl-9 pr-3 py-1.5 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Activity Ledger Table */}
              <div className="bg-white border border-[#D8DEEA]/60 rounded-[20px] overflow-hidden shadow-xs">
                <div className="p-3 bg-[#f0f3ff]/40 border-b border-[#D8DEEA]/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#10141A]">
                    Activity Events ({data.pagination.totalRecords} entries)
                  </span>
                  <span className="text-[11px] text-[#6B7280]">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                      <tr>
                        <th className="py-2.5 px-3.5">Timestamp (UTC)</th>
                        <th className="py-2.5 px-3.5">Action Type</th>
                        <th className="py-2.5 px-3.5">Target Docket</th>
                        <th className="py-2.5 px-3.5">Client IP</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5">Event Hash</th>
                        <th className="py-2.5 px-3.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                      {data.events.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#6B7280] text-xs font-medium">
                            No activity events found for the selected filter.
                          </td>
                        </tr>
                      ) : (
                        data.events.map((ev) => {
                          const isExpanded = selectedEventId === ev.id;
                          return (
                            <React.Fragment key={ev.id}>
                              <tr
                                onClick={() => setSelectedEventId(isExpanded ? null : ev.id)}
                                className={`cursor-pointer transition ${
                                  isExpanded ? 'bg-[#f0f3ff]' : 'hover:bg-[#f0f3ff]/40'
                                }`}
                              >
                                <td className="py-2.5 px-3.5 font-mono text-[#6B7280] whitespace-nowrap">
                                  {ev.timeUtc}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${
                                    ev.eventType.includes('UPLOAD')
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                                      : ev.eventType.includes('APPROV')
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                      : ev.eventType.includes('REJECT')
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200/50'
                                      : ev.eventType.includes('DEK') || ev.eventType.includes('DOWNLOAD')
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {ev.eventType.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 max-w-xs truncate">
                                  <div className="font-medium text-[#10141A] truncate">
                                    {ev.documentTitle || ev.documentNumber || 'System Session Event'}
                                  </div>
                                  {ev.documentNumber && (
                                    <div className="font-mono text-[10px] text-[#6B7280]">{ev.documentNumber}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5 font-mono text-[#6B7280] whitespace-nowrap">
                                  {ev.ipAddress}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                    ev.result === 'SUCCESS'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                                  }`}>
                                    {ev.result}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 font-mono text-[11px] text-[#9CA3AF] whitespace-nowrap">
                                  {ev.eventHash ? `${ev.eventHash.substring(0, 10)}...` : 'N/A'}
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventId(isExpanded ? null : ev.id);
                                    }}
                                    className="text-[#6B7280] hover:text-[#10141A] text-xs"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      {isExpanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-[#f0f3ff]/40 border-b border-[#D8DEEA]/60">
                                  <td colSpan={7} className="p-4 text-xs font-mono text-[#10141A]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <span className="font-medium text-[#6B7280] uppercase text-[10px] block mb-1">
                                          Provenance Details
                                        </span>
                                        <div><strong>Event ID:</strong> {ev.id}</div>
                                        <div><strong>SHA-256:</strong> <span className="text-[#3f5e93]">{ev.eventHash}</span></div>
                                        <div><strong>Agent:</strong> {ev.userAgent || 'Internal System Client'}</div>
                                        {ev.failureReason && (
                                          <div className="text-rose-600"><strong>Failure Reason:</strong> {ev.failureReason}</div>
                                        )}
                                      </div>
                                      <div>
                                        <span className="font-medium text-[#6B7280] uppercase text-[10px] block mb-1">
                                          Event Metadata
                                        </span>
                                        <pre className="text-[10px] bg-white p-2 rounded-[12px] border border-[#D8DEEA] overflow-x-auto max-h-28">
                                          {typeof ev.metadata === 'object' ? JSON.stringify(ev.metadata, null, 2) : ev.metadata || 'No metadata payload'}
                                        </pre>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {data.pagination.totalPages > 1 && (
                  <div className="p-3 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex items-center justify-between">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={data.pagination.page <= 1}
                      className="px-3 py-1 text-xs font-medium bg-white border border-[#D8DEEA] rounded-full disabled:opacity-50 hover:bg-[#f0f3ff]"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-[#6B7280]">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={data.pagination.page >= data.pagination.totalPages}
                      className="px-3 py-1 text-xs font-medium bg-white border border-[#D8DEEA] rounded-full disabled:opacity-50 hover:bg-[#f0f3ff]"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs text-[#6B7280] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
            <span>All activity records cryptographically sealed with SHA-256.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full text-xs font-medium transition"
          >
            Close Dossier
          </button>
        </div>

      </div>
    </div>
  );
}
