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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Personnel Forensic Activity Dossier
                </h2>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold rounded uppercase border border-blue-500/30">
                  Section 65B Audit Trail
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Complete chronological event ledger and cryptographic provenance profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-slate-800">
          
          {loading && !data && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="material-symbols-outlined text-[36px] animate-spin text-blue-600">sync</span>
              <p className="text-xs font-semibold">Retrieving authenticated officer activity ledger...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600">error</span>
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* Officer Profile Summary Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-sm">
                    {data.profile.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{data.profile.fullName}</h3>
                      <span className="font-mono text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold">
                        {data.profile.employeeCode}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        data.profile.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {data.profile.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {data.profile.designation} &bull; <span className="font-semibold text-slate-700">{data.profile.department}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Email: <strong className="text-slate-600">{data.profile.email}</strong></span>
                      &bull;
                      <span>Roles: <strong className="text-slate-600">{data.profile.roles.join(', ')}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">table_chart</span>
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={handleExportJson}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Audit Dossier (JSON)</span>
                  </button>
                </div>
              </div>

              {/* Lifetime Activity Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Total Actions</span>
                  <span className="text-xl font-bold text-slate-900 mt-1">{data.stats.totalEvents}</span>
                  <span className="text-[10px] text-slate-500">Recorded events</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-blue-600">Uploads</span>
                  <span className="text-xl font-bold text-blue-700 mt-1">{data.stats.uploadsCount}</span>
                  <span className="text-[10px] text-slate-500">Ingested files</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-amber-600">Downloads/Reads</span>
                  <span className="text-xl font-bold text-amber-700 mt-1">{data.stats.downloadsCount}</span>
                  <span className="text-[10px] text-slate-500">DEK unwrap accesses</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-emerald-600">Approvals</span>
                  <span className="text-xl font-bold text-emerald-700 mt-1">{data.stats.approvalsCount}</span>
                  <span className="text-[10px] text-slate-500">Sign-offs granted</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-purple-600">Rejections</span>
                  <span className="text-xl font-bold text-purple-700 mt-1">{data.stats.rejectionsCount}</span>
                  <span className="text-[10px] text-slate-500">Changes rejected</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-indigo-600">Logins</span>
                  <span className="text-xl font-bold text-indigo-700 mt-1">{data.stats.loginsCount}</span>
                  <span className="text-[10px] text-slate-500">Sessions created</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-red-600">Flags / Errors</span>
                  <span className={`text-xl font-bold mt-1 ${data.stats.violationsCount > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                    {data.stats.violationsCount}
                  </span>
                  <span className="text-[10px] text-slate-500">Failed attempts</span>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">Filter Ledger:</span>
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => {
                      setEventTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="all">All Action Classes</option>
                    <option value="UPLOAD">Uploads & Ingestion</option>
                    <option value="DOWNLOAD">Downloads & Reads</option>
                    <option value="DEK">DEK Cryptographic Unwraps</option>
                    <option value="APPROV">Approvals & Decisions</option>
                    <option value="REJECT">Rejections</option>
                    <option value="LOGIN">Auth & Sessions</option>
                    <option value="FAIL">Errors & Denials</option>
                  </select>
                </div>

                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-[18px] text-slate-400">search</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search docket, hash, or IP..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Forensic Activity Ledger Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Activity Events ({data.pagination.totalRecords} total entries)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5">Timestamp (UTC)</th>
                        <th className="py-2.5 px-3.5">Action Type</th>
                        <th className="py-2.5 px-3.5">Target Docket / Subject</th>
                        <th className="py-2.5 px-3.5">Client IP</th>
                        <th className="py-2.5 px-3.5">Status</th>
                        <th className="py-2.5 px-3.5">Event Hash</th>
                        <th className="py-2.5 px-3.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {data.events.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-semibold">
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
                                  isExpanded ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-2.5 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                                  {ev.timeUtc}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                    ev.eventType.includes('UPLOAD')
                                      ? 'bg-blue-100 text-blue-800'
                                      : ev.eventType.includes('APPROV')
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : ev.eventType.includes('REJECT')
                                      ? 'bg-purple-100 text-purple-800'
                                      : ev.eventType.includes('DEK') || ev.eventType.includes('DOWNLOAD')
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {ev.eventType.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 max-w-xs truncate">
                                  <div className="font-semibold text-slate-900 truncate">
                                    {ev.documentTitle || ev.documentNumber || 'System Session Event'}
                                  </div>
                                  {ev.documentNumber && (
                                    <div className="font-mono text-[10px] text-slate-500">{ev.documentNumber}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                                  {ev.ipAddress}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    ev.result === 'SUCCESS'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}>
                                    {ev.result}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                  {ev.eventHash ? `${ev.eventHash.substring(0, 10)}...` : 'N/A'}
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventId(isExpanded ? null : ev.id);
                                    }}
                                    className="text-slate-400 hover:text-slate-700 text-xs"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      {isExpanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-50/90 border-b border-slate-200">
                                  <td colSpan={7} className="p-4 text-xs font-mono text-slate-700">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">
                                          Provenance Node Details
                                        </span>
                                        <div><strong>Event ID:</strong> {ev.id}</div>
                                        <div><strong>Full SHA-256 Hash:</strong> <span className="text-blue-700">{ev.eventHash}</span></div>
                                        <div><strong>Client Agent:</strong> {ev.userAgent || 'Internal System Client'}</div>
                                        {ev.failureReason && (
                                          <div className="text-red-700"><strong>Failure Reason:</strong> {ev.failureReason}</div>
                                        )}
                                      </div>
                                      <div>
                                        <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">
                                          Attached Event Metadata
                                        </span>
                                        <pre className="text-[10px] bg-white p-2 rounded border border-slate-200 overflow-x-auto max-h-28">
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
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={data.pagination.page <= 1}
                      className="px-3 py-1 text-xs font-semibold bg-white border border-slate-300 rounded disabled:opacity-50 hover:bg-slate-100"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-slate-600">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={data.pagination.page >= data.pagination.totalPages}
                      className="px-3 py-1 text-xs font-semibold bg-white border border-slate-300 rounded disabled:opacity-50 hover:bg-slate-100"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
            <span>All activity records cryptographically sealed with SHA-256 and immutable audit chaining.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition"
          >
            Close Dossier
          </button>
        </div>

      </div>
    </div>
  );
}
