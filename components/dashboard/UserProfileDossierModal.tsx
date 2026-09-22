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
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen || !userId) return;

    let active = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '15',
          eventType: actionFilter,
          search: searchTerm,
        });

        const res = await fetch(`/api/auditor/users/${userId}/activity?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch user activity');
        }
        const json = await res.json();
        if (active) setData(json);
      } catch (e: unknown) {
        if (active) {
          const msg = e instanceof Error ? e.message : 'Error loading user activity';
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
  }, [isOpen, userId, page, actionFilter, searchTerm]);

  if (!isOpen) return null;

  const formatActionName = (eventType: string) => {
    if (eventType.includes('UPLOAD')) return 'Uploaded File';
    if (eventType.includes('APPROV')) return 'Approved Docket';
    if (eventType.includes('REJECT')) return 'Rejected Request';
    if (eventType.includes('DEK') || eventType.includes('DOWNLOAD') || eventType.includes('READ')) return 'Decrypted / Downloaded';
    if (eventType.includes('LOGIN') || eventType.includes('AUTH')) return 'Logged In';
    if (eventType.includes('DELETE') || eventType.includes('SHRED')) return 'Crypto-Shred / Delete';
    return eventType.replace(/_/g, ' ');
  };

  const getActionBadge = (eventType: string) => {
    if (eventType.includes('UPLOAD')) {
      return 'bg-blue-50 text-blue-700 border-blue-200/50';
    }
    if (eventType.includes('APPROV')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
    }
    if (eventType.includes('REJECT')) {
      return 'bg-rose-50 text-rose-700 border-rose-200/50';
    }
    if (eventType.includes('DEK') || eventType.includes('DOWNLOAD')) {
      return 'bg-amber-50 text-amber-800 border-amber-200/50';
    }
    return 'bg-[#f0f3ff] text-[#3f5e93] border-[#83A2DB]/30';
  };

  const initials = data?.profile?.fullName
    ? data.profile.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-[26px] shadow-2xl border border-[#D8DEEA]/80 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#D8DEEA]/60 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#000000] text-white flex items-center justify-center font-bold text-sm">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#151c27]">
                  {data?.profile?.fullName || 'User Activity'}
                </h2>
                {data?.profile?.employeeCode && (
                  <span className="font-mono text-xs px-2 py-0.5 bg-[#f0f3ff] text-[#3f5e93] rounded-full font-semibold border border-[#83A2DB]/30">
                    {data.profile.employeeCode}
                  </span>
                )}
                {data?.profile?.status && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    data.profile.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {data.profile.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#45474b] mt-0.5">
                {data?.profile?.designation || 'Institutional User'} • {data?.profile?.department || 'Administration'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f0f3ff] text-[#9CA3AF] hover:text-[#151c27] flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[#151c27]">
          {loading && !data && (
            <div className="py-16 flex flex-col items-center justify-center text-[#9CA3AF] gap-2">
              <div className="w-7 h-7 border-2 border-[#3f5e93] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-semibold font-mono">Loading activity history...</p>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* 4 Simple Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white border border-[#D8DEEA]/80 rounded-[18px] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#9CA3AF] mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Actions</span>
                    <span className="material-symbols-outlined text-[18px] text-[#3f5e93]">history</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#151c27]">
                    {data.stats.totalEvents}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] mt-0.5">Lifetime logged</span>
                </div>

                <div className="p-4 bg-white border border-[#D8DEEA]/80 rounded-[18px] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#9CA3AF] mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Documents</span>
                    <span className="material-symbols-outlined text-[18px] text-blue-600">description</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-blue-700">
                    {data.stats.uploadsCount + data.stats.downloadsCount}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] mt-0.5">{data.stats.uploadsCount} up / {data.stats.downloadsCount} down</span>
                </div>

                <div className="p-4 bg-white border border-[#D8DEEA]/80 rounded-[18px] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#9CA3AF] mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Approvals</span>
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-700">
                    {data.stats.approvalsCount}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] mt-0.5">{data.stats.rejectionsCount} rejected</span>
                </div>

                <div className="p-4 bg-white border border-[#D8DEEA]/80 rounded-[18px] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#9CA3AF] mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Compliance</span>
                    <span className={`material-symbols-outlined text-[18px] ${data.stats.violationsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {data.stats.violationsCount > 0 ? 'warning' : 'shield'}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold font-mono ${data.stats.violationsCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {data.stats.violationsCount > 0 ? `${data.stats.violationsCount} Flags` : '100% Clean'}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] mt-0.5">
                    {data.stats.violationsCount > 0 ? 'Review needed' : 'Zero violations'}
                  </span>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#45474b]">Filter:</span>
                  <div className="flex items-center rounded-full bg-[#f0f3ff] p-1 text-xs font-semibold text-[#45474b] border border-[#D8DEEA]">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'UPLOAD', label: 'Uploads' },
                      { id: 'APPROV', label: 'Approvals' },
                      { id: 'DOWNLOAD', label: 'Downloads' },
                      { id: 'LOGIN', label: 'Logins' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActionFilter(tab.id);
                          setPage(1);
                        }}
                        className={`px-3 py-0.5 rounded-full transition cursor-pointer text-xs ${
                          actionFilter === tab.id
                            ? 'bg-[#000000] text-white shadow-xs'
                            : 'hover:text-[#151c27]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search action or docket..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D8DEEA] rounded-full text-[#151c27] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#3f5e93] w-full sm:w-56"
                  />
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-[15px] text-[#9CA3AF]">
                    search
                  </span>
                </div>
              </div>

              {/* Clean Activity Table */}
              <div className="bg-white border border-[#D8DEEA]/80 rounded-[20px] overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f0f3ff]/60 border-b border-[#D8DEEA]/60 text-[#45474b] font-semibold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Date & Time</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Target Docket / Resource</th>
                        <th className="py-2.5 px-4">IP Address</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8DEEA]/30">
                      {data.events.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#9CA3AF] text-xs">
                            No activity found for the selected filter.
                          </td>
                        </tr>
                      ) : (
                        data.events.map((ev) => (
                          <tr key={ev.id} className="hover:bg-[#f0f3ff]/40 transition">
                            <td className="py-2.5 px-4 font-mono text-[11px] text-[#45474b] whitespace-nowrap">
                              {new Date(ev.createdAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${getActionBadge(ev.eventType)}`}>
                                {formatActionName(ev.eventType)}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-[#151c27] text-[11px] truncate max-w-xs">
                                  {ev.documentTitle || ev.documentNumber || 'System Portal'}
                                </span>
                                {ev.documentNumber && (
                                  <span className="font-mono text-[10px] text-[#3f5e93] font-semibold">
                                    {ev.documentNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-[#45474b] whitespace-nowrap">
                              {ev.ipAddress}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full ${
                                ev.result === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  ev.result === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}></span>
                                {ev.result}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="p-3 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={data.pagination.page <= 1}
                      className="px-3 py-1 rounded-full bg-white border border-[#D8DEEA] text-[#151c27] font-semibold text-xs disabled:opacity-40 hover:bg-[#f0f3ff] transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-[11px] text-[#45474b]">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={data.pagination.page >= data.pagination.totalPages}
                      className="px-3 py-1 rounded-full bg-white border border-[#D8DEEA] text-[#151c27] font-semibold text-xs disabled:opacity-40 hover:bg-[#f0f3ff] transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs text-[#45474b] bg-white shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
            <span>Real-time authenticated audit logs</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#000000] hover:bg-[#181c22] text-white rounded-full text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
