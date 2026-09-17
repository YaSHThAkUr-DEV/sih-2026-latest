'use client';

import React, { useState, useMemo } from 'react';

interface CaseDocument {
  id: string;
  document_number: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  document_type_name: string;
  document_type_code: string;
  security_tier: string;
  security_tier_name: string;
  security_rank: number;
  department_name: string;
  department_code: string;
  owner_name: string;
  owner_designation: string;
  version_number: number;
  file_name: string;
  file_size: number;
  sha256_hash: string;
  encryption_algorithm: string;
  checksum_verified: boolean;
}

interface OverviewDashboardViewProps {
  user: any;
  stats: {
    totalDocuments: number;
    encryptedDocuments: number;
    pendingApprovals: number;
    auditEventsCount: number;
    departmentDocuments: number;
    totalStorageBytes?: number;
    totalStorageQuotaBytes?: number;
    storageUsedPercentage?: number;
    departmentStorage?: Array<{
      departmentId: string;
      name: string;
      code: string;
      docCount: number;
      storageBytes: number;
      percent: number;
    }>;
  };
  documents: CaseDocument[];
  systemHealth: any;
  onNavigate: (view: any) => void;
  onOpenUpload: () => void;
  onSelectDoc: (doc: CaseDocument) => void;
  onVerifyDoc: (doc: CaseDocument) => void;
}

export default function OverviewDashboardView({
  user,
  stats,
  documents,
  systemHealth,
  onNavigate,
  onOpenUpload,
  onSelectDoc,
  onVerifyDoc,
}: OverviewDashboardViewProps) {
  const [docSearch, setDocSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'all' | 'shared' | 'starred' | 'archived'>('all');

  // Extract unique departments from documents
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.department_name) set.add(d.department_name);
    });
    return Array.from(set);
  }, [documents]);

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedDeptFilter !== 'ALL' && doc.department_name !== selectedDeptFilter) {
        return false;
      }
      if (docSearch) {
        const q = docSearch.toLowerCase();
        const matchesTitle = doc.title?.toLowerCase().includes(q);
        const matchesNum = doc.document_number?.toLowerCase().includes(q);
        const matchesDept = doc.department_name?.toLowerCase().includes(q);
        const matchesOwner = doc.owner_name?.toLowerCase().includes(q);
        const matchesFile = doc.file_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNum && !matchesDept && !matchesOwner && !matchesFile) {
          return false;
        }
      }
      return true;
    });
  }, [documents, selectedDeptFilter, docSearch]);

  // Dynamic department storage from PostgreSQL
  const departmentStorageList = useMemo(() => {
    if (stats.departmentStorage && stats.departmentStorage.length > 0) {
      return stats.departmentStorage;
    }
    const map = new Map<string, { name: string; code: string; docCount: number; storageBytes: number }>();
    documents.forEach((d) => {
      const name = d.department_name || 'General';
      const cur = map.get(name) || { name, code: d.department_code || 'GEN', docCount: 0, storageBytes: 0 };
      cur.docCount += 1;
      cur.storageBytes += Number(d.file_size || 0);
      map.set(name, cur);
    });
    const total = Array.from(map.values()).reduce((acc, v) => acc + v.storageBytes, 0);
    return Array.from(map.values()).map((v) => ({
      departmentId: v.code,
      name: v.name,
      code: v.code,
      docCount: v.docCount,
      storageBytes: v.storageBytes,
      percent: total > 0 ? Math.round((v.storageBytes / total) * 100) : 0,
    }));
  }, [stats.departmentStorage, documents]);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const deptColors = [
    { bg: 'bg-blue-600', pill: 'bg-blue-500' },
    { bg: 'bg-indigo-600', pill: 'bg-indigo-500' },
    { bg: 'bg-purple-600', pill: 'bg-purple-500' },
    { bg: 'bg-emerald-600', pill: 'bg-emerald-500' },
    { bg: 'bg-amber-600', pill: 'bg-amber-500' },
    { bg: 'bg-rose-600', pill: 'bg-rose-500' },
  ];

  // Helper for file extension badge
  const getFileExt = (filename: string) => {
    if (!filename) return 'DOC';
    const ext = filename.split('.').pop()?.toUpperCase() || 'DOC';
    return ext.length <= 4 ? ext : 'DOC';
  };

  const getExtBadgeClass = (ext: string) => {
    switch (ext) {
      case 'PDF':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'DOCX':
      case 'DOC':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'XLSX':
      case 'CSV':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PNG':
      case 'JPG':
      case 'JPEG':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Dynamic user greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Ambient Backdrop */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 lg:p-8 shadow-md">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/30">
                {user?.organization?.name || 'CloudDMS Enterprise Platform'}
              </span>
              <span className="text-xs text-blue-300 font-mono">Protected Storage Pool</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
              {getGreeting()}, {user?.fullName || 'User'}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your organizational workspace is fully operational. All repositories are synced with zero-trust encryption and verified hash ledgers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenUpload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span>Upload Document</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('search-ocr')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">document_scanner</span>
              <span>OCR Search</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Quick Action Ribbon Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={onOpenUpload}
          className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Upload Document
            </h3>
            <p className="text-xs text-slate-500 mt-1">Ingest new corporate files with automated encryption.</p>
          </div>
          <div className="flex items-center gap-1 mt-3 text-blue-600 text-xs font-semibold">
            <span>Start upload</span>
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('users')}
          className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">person_add</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Add Team Member
            </h3>
            <p className="text-xs text-slate-500 mt-1">Invite colleagues and configure department access.</p>
          </div>
          <div className="flex items-center gap-1 mt-3 text-indigo-600 text-xs font-semibold">
            <span>Send invite</span>
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('departments')}
          className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-cyan-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center mb-3 group-hover:bg-cyan-700 group-hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">domain_add</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
              Create Department
            </h3>
            <p className="text-xs text-slate-500 mt-1">Organize divisions, squads, and storage boundaries.</p>
          </div>
          <div className="flex items-center gap-1 mt-3 text-cyan-700 text-xs font-semibold">
            <span>Configure setup</span>
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('retention')}
          className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">lock_clock</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              Set Retention Schedule
            </h3>
            <p className="text-xs text-slate-500 mt-1">Configure automated archival &amp; preservation locks.</p>
          </div>
          <div className="flex items-center gap-1 mt-3 text-emerald-700 text-xs font-semibold">
            <span>Manage policies</span>
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </div>
        </div>
      </div>

      {/* Storage Allocation by Department & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Storage Allocation by Department</h3>
                <p className="text-xs text-slate-500">
                  Breakdown of storage consumed across core organizational units.
                </p>
              </div>
              <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                {formatBytes(stats.totalStorageBytes || 0)} / 1,000 GB
              </span>
            </div>

            {/* Storage Progress Segments from PostgreSQL */}
            <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden flex my-4 border border-slate-200">
              {departmentStorageList.map((ds, idx) => (
                <div
                  key={ds.departmentId || ds.code || idx}
                  className={`h-full ${deptColors[idx % deptColors.length].bg} transition-all duration-500`}
                  style={{ width: `${Math.max(3, ds.percent)}%` }}
                  title={`${ds.name}: ${ds.percent}% (${formatBytes(ds.storageBytes)})`}
                />
              ))}
            </div>

            {/* Department Breakdown Mini-Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {departmentStorageList.slice(0, 4).map((ds, idx) => (
                <div key={ds.departmentId || ds.code || idx} className="flex flex-col p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${deptColors[idx % deptColors.length].pill}`} />
                    <span className="text-xs font-semibold text-slate-800 truncate" title={ds.name}>{ds.name}</span>
                  </div>
                  <div className="text-base font-bold text-slate-900">{ds.percent}%</div>
                  <span className="font-mono text-[11px] text-slate-500">{formatBytes(ds.storageBytes)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-4 text-xs text-slate-600 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
              <span>Storage quotas healthy. Automatic expansion enabled at 85% capacity.</span>
            </div>
            <button
              onClick={() => onNavigate('departments')}
              className="text-blue-600 font-semibold hover:underline"
            >
              Manage Quotas
            </button>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-xl bg-white border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">System Health</h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operational
              </span>
            </div>

            <div className="space-y-2 mt-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">bolt</span>
                  <span className="text-xs font-medium text-slate-800">OCR &amp; Search Indexer</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-600">99.98%</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">verified_user</span>
                  <span className="text-xs font-medium text-slate-800">Preservation Lock Service</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-600">Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600 text-[18px]">backup</span>
                  <span className="text-xs font-medium text-slate-800">Offsite S3 Replication</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">Synced just now</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigate('jobs')}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
            >
              <span>View Worker Queue Telemetry</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Documents Table Section */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Table Header & Controls */}
        <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Documents</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Browse and manage latest uploaded corporate files and approvals.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Filter current list..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
            </div>

            <div className="relative">
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 cursor-pointer font-medium"
              >
                <option value="ALL">All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center px-5 gap-2 overflow-x-auto bg-slate-50/50 border-b border-slate-200/70 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-white border-t-2 border-blue-600 text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>All Files</span>
            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full text-slate-700">
              {filteredDocs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shared')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 ${
              activeTab === 'shared'
                ? 'bg-white border-t-2 border-blue-600 text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Shared with Me</span>
            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full text-slate-500">
              {Math.min(filteredDocs.length, 6)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('starred')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 ${
              activeTab === 'starred'
                ? 'bg-white border-t-2 border-blue-600 text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Starred</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 ${
              activeTab === 'archived'
                ? 'bg-white border-t-2 border-blue-600 text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Archived</span>
          </button>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-semibold tracking-wider border-b border-slate-200">
                <th className="py-3 px-5">Document Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4">Upload Date</th>
                <th className="py-3 px-4">Security Tier</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl">folder_off</span>
                    <p className="mt-1 font-medium">No documents found matching current filter.</p>
                  </td>
                </tr>
              ) : (
                filteredDocs.slice(0, 10).map((doc) => {
                  const ext = getFileExt(doc.file_name || doc.title);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${getExtBadgeClass(
                              ext
                            )}`}
                          >
                            {ext}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span
                              onClick={() => onSelectDoc(doc)}
                              className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer truncate max-w-xs md:max-w-md"
                            >
                              {doc.title}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {doc.document_number} • {(Number(doc.file_size || 0) / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium">
                          {doc.department_name || 'General Operations'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">
                            {doc.owner_name ? doc.owner_name[0] : 'U'}
                          </div>
                          <span className="font-medium text-slate-800">{doc.owner_name || 'Official'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                          <span className="material-symbols-outlined text-[12px]">lock</span>
                          {doc.security_tier_name || 'Confidential'}
                        </span>
                      </td>

                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectDoc(doc)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition"
                            title="View Document Details"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onVerifyDoc(doc)}
                            className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition"
                            title="Verify Hash & Chain of Custody"
                          >
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                          </button>
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
    </div>
  );
}
