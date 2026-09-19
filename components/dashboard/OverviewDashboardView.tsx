'use client';

import React from 'react';

export interface CaseDocument {
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

export interface AuditEventItem {
  id: string;
  event_type: string;
  result: string;
  created_at: string;
  event_hash: string;
  ip_address: string;
  actor_name: string;
  actor_designation: string;
  document_number?: string;
  document_title?: string;
}

export interface OverviewDashboardViewProps {
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
  activity?: AuditEventItem[];
  systemHealth?: any;
  onNavigate: (view: any) => void;
  onOpenUpload: () => void;
  onSelectDoc?: (doc: CaseDocument) => void;
  onVerifyDoc?: (doc: CaseDocument) => void;
  onViewDocHistory?: (doc: CaseDocument) => void;
  onGenerate65B?: (doc: CaseDocument) => void;
  onDownloadDoc?: (docId: string, docNumber: string, fileName: string) => void;
  onOpenSearch?: () => void;
}

export default function OverviewDashboardView({
  user,
  stats,
  documents = [],
  activity = [],
  systemHealth,
  onNavigate,
  onOpenUpload,
  onSelectDoc,
  onVerifyDoc,
  onViewDocHistory,
  onGenerate65B,
  onDownloadDoc,
  onOpenSearch,
}: OverviewDashboardViewProps) {
  // Helper: Format bytes to human readable format
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    if (gb < 1024) return `${gb.toFixed(2)} GB`;
    const tb = gb / 1024;
    return `${tb.toFixed(2)} TB`;
  };

  // Helper: Format relative time
  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffSecs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return `${Math.floor(diffSecs / 86400)}d ago`;
    } catch {
      return dateStr;
    }
  };

  // Helper: Format UTC date
  const formatUtcDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toISOString().replace('T', ' ').substring(0, 19);
    } catch {
      return dateStr;
    }
  };

  // Helper: User initials
  const getInitials = (name: string) => {
    if (!name) return 'SO';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  // Helper: Format audit event action badge
  const getEventBadge = (eventType: string, result: string) => {
    const type = (eventType || '').toUpperCase();
    if (type.includes('APPROVE') || type.includes('SIGN')) {
      return { label: 'Approval Granted', bg: 'bg-[#83A2DB]/15 text-[#305184]' };
    }
    if (type.includes('UPLOAD') || type.includes('INGEST') || type.includes('CREATE')) {
      return { label: 'Document Ingested', bg: 'bg-[#E4E4E4] text-[#151c27]' };
    }
    if (type.includes('VERIF') || type.includes('CHECK')) {
      return { label: 'Integrity Verified', bg: 'bg-[#83A2DB]/15 text-[#305184]' };
    }
    if (type.includes('ACCESS') || type.includes('READ') || type.includes('KEY') || type.includes('DOWNLOAD')) {
      return { label: 'Key Access', bg: 'bg-[rgba(206,105,105,0.14)] text-[#ca6666]' };
    }
    if (type.includes('ARCHIVE') || type.includes('BACKUP') || type.includes('JOB')) {
      return { label: 'Auto-Archive', bg: 'bg-[#e7eefe] text-[#45474b]' };
    }
    return { label: result || 'Recorded', bg: 'bg-[#83A2DB]/15 text-[#305184]' };
  };

  // Real live storage calculations from PostgreSQL
  const totalStorageBytes = stats?.totalStorageBytes ?? documents.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const quotaBytes = stats?.totalStorageQuotaBytes || (1000 * 1024 * 1024 * 1024); // 1,000 GB Standard Quota
  const usedPercent = stats?.storageUsedPercentage ?? (quotaBytes > 0 ? (totalStorageBytes / quotaBytes) * 100 : 0);

  // Department storage breakdown purely from PostgreSQL
  const departmentStorageList =
    stats?.departmentStorage && stats.departmentStorage.length > 0
      ? stats.departmentStorage
      : [
          {
            departmentId: user?.department?.id || 'default',
            name: user?.department?.name || 'General Administration',
            code: user?.department?.code || 'GEN',
            docCount: stats?.totalDocuments ?? documents.length,
            storageBytes: totalStorageBytes,
            percent: totalStorageBytes > 0 ? 100 : 0,
          },
        ];

  const totalActiveDocs = stats?.totalDocuments ?? documents.length;
  const totalEncryptedDocs = stats?.encryptedDocuments ?? documents.length;
  const totalPendingApprovals = stats?.pendingApprovals ?? 0;
  const totalAuditEvents = stats?.auditEventsCount ?? activity.length;

  return (
    <div className="flex flex-col w-full gap-7 font-sans">
      {/* 1. Top Greeting & Operational Action Bar */}
      <section className="w-full bg-white/85 backdrop-blur-xl rounded-[26px] p-6 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-4">
          {/* Profile Slot */}
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-[#000000] text-white font-semibold text-sm shadow-[0_4px_14px_rgba(16,20,26,0.18)]">
            {getInitials(user?.fullName || user?.username || 'Officer')}
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3f5e93]"></span>
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold text-[#151c27]">
                {user?.fullName || user?.username || 'Dealing Officer'}
              </span>
              <span className="text-[11px] font-mono bg-[#f0f3ff] text-[#151c27] px-2.5 py-1 rounded-full tracking-wider">
                {user?.organization?.code || user?.organization?.name || 'INSTITUTION'}
              </span>
            </div>
            <span className="text-[13px] text-[#45474b]">
              {user?.designation || (user?.department?.name ? `${user.department.name} Officer` : 'Authorized Officer')}
            </span>
          </div>

          {/* Live Operational Gateway & Services Health Badge */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] px-3 py-1.5 rounded-full text-[11px] font-mono border border-[#83A2DB]/30">
              <span className={`w-2 h-2 rounded-full ${systemHealth?.database?.ok !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span>PostgreSQL {systemHealth?.database?.latencyMs ? `${systemHealth.database.latencyMs}ms` : 'Connected'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] px-3 py-1.5 rounded-full text-[11px] font-mono border border-[#83A2DB]/30">
              <span className={`w-2 h-2 rounded-full ${systemHealth?.kms?.ok !== false ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span>Vault KMS {systemHealth?.kms?.latencyMs ? `${systemHealth.kms.latencyMs}ms` : 'Active'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] px-3 py-1.5 rounded-full text-[11px] font-mono border border-[#83A2DB]/30">
              <span className={`w-2 h-2 rounded-full ${systemHealth?.cacheQueue?.ok !== false ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span>Redis {systemHealth?.cacheQueue?.latencyMs ? `${systemHealth.cacheQueue.latencyMs}ms` : 'Ready'}</span>
            </div>
          </div>
        </div>

        {/* Actions Area */}
        <div className="flex items-center gap-3 self-start xl:self-auto flex-wrap">
          <button
            onClick={() => {
              if (onOpenSearch) onOpenSearch();
              else onNavigate('documents');
            }}
            className="h-10 px-4 rounded-full bg-white hover:bg-[#e7eefe] text-[#151c27] transition-colors border border-[#D8DEEA] shadow-xs flex items-center gap-2 text-[13px] font-medium cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-[#45474b]">search</span>
            <span>Quick Search</span>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-[#e2e8f8] text-[#45474b] font-mono text-[10px]">⌘K</kbd>
          </button>

          <button
            onClick={onOpenUpload}
            className="h-10 px-5 rounded-full bg-[#000000] text-white hover:bg-[#181c22] transition-all shadow-[0_6px_18px_rgba(16,20,26,0.22)] flex items-center gap-2 text-[13px] font-medium group cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-y-0.5 transition-transform">
              upload_file
            </span>
            <span>+ Ingest Record</span>
          </button>
        </div>
      </section>

      {/* 2. KPI Metrics Grid (4 Equal Columns) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Documents */}
        <div
          onClick={() => onNavigate('documents')}
          className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between gap-4 group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#45474b]">Active Documents</span>
            <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">folder_copy</span>
            </div>
          </div>
          <div>
            <div className="text-[26px] font-semibold text-[#151c27] tracking-tight">
              {totalActiveDocs.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">verified</span>
              <span className="text-[11px] text-[#3f5e93] font-medium">
                {stats?.departmentDocuments
                  ? `${stats.departmentDocuments} in your department`
                  : `${totalActiveDocs} total records in vault`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Encrypted Documents */}
        <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between gap-4 group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#45474b]">Hardware Encrypted</span>
            <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">verified_user</span>
            </div>
          </div>
          <div>
            <div className="text-[26px] font-semibold text-[#151c27] tracking-tight">
              {totalEncryptedDocs.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#9CA3AF] font-mono">
              <span className="material-symbols-outlined text-[15px] text-[#9CA3AF]">lock</span>
              <span>
                {totalActiveDocs > 0
                  ? `${Math.min(100, Math.round((totalEncryptedDocs / Math.max(1, totalActiveDocs)) * 100))}% Sealed (AES-256)`
                  : 'AES-256-GCM / SHA-256'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div
          onClick={() => onNavigate('approvals')}
          className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between gap-4 group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#45474b]">Pending Approvals</span>
            <div className="w-9 h-9 rounded-full bg-[rgba(206,105,105,0.14)] text-[#ca6666] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">schedule</span>
            </div>
          </div>
          <div>
            <div className="text-[26px] font-semibold text-[#151c27] tracking-tight">
              {totalPendingApprovals}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#ca6666] font-medium">
              {totalPendingApprovals > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ca6666] animate-ping"></span>
                  <span>{totalPendingApprovals} awaiting sign-off</span>
                </>
              ) : (
                <span className="text-[#9CA3AF]">Zero pending requests</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Audit Logs Count */}
        <div
          onClick={() => onNavigate('audit')}
          className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between gap-4 group hover:shadow-[0_8px_30px_rgba(16,20,26,0.08)] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#45474b]">Immutable Logs</span>
            <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">receipt_long</span>
            </div>
          </div>
          <div>
            <div className="text-[26px] font-semibold text-[#151c27] tracking-tight">
              {totalAuditEvents >= 1000 ? `${(totalAuditEvents / 1000).toFixed(1)}k` : totalAuditEvents.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#9CA3AF]">
              <span className="material-symbols-outlined text-[15px] text-[#9CA3AF]">link</span>
              <span>Tamper-proof Merkle chain</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Storage Quota & Allocation Panel */}
      <section className="w-full bg-white rounded-[26px] p-6 shadow-[0_4px_24px_rgba(16,20,26,0.05)] border border-[#D8DEEA]/60 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#45474b]">hard_drive</span>
            <h2 className="text-[18px] font-semibold text-[#151c27]">Storage Allocation &amp; Vault Capacity</h2>
          </div>
          <span className="text-[11px] font-mono bg-[#f0f3ff] text-[#151c27] px-3 py-1.5 rounded-full font-medium self-start sm:self-auto border border-[#D8DEEA]/50">
            {usedPercent < 0.01 && usedPercent > 0
              ? '<0.01%'
              : `${usedPercent.toFixed(2)}%`}{' '}
            Used ({formatBytes(totalStorageBytes)} / {formatBytes(quotaBytes)})
          </span>
        </div>

        {/* Real Progress Bar */}
        <div className="w-full h-3 bg-[#E9ECF4] rounded-full overflow-hidden flex p-0.5">
          <div
            className="h-full bg-[#000000] rounded-full transition-all duration-500"
            style={{ width: `${Math.max(usedPercent > 0 ? 1 : 0, Math.min(100, usedPercent))}%` }}
            title={`Used: ${formatBytes(totalStorageBytes)} (${usedPercent.toFixed(2)}%)`}
          ></div>
        </div>

        {/* Breakdown Grid from PostgreSQL */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {departmentStorageList.slice(0, 4).map((dept, idx) => {
            const dotColor =
              idx === 0
                ? 'bg-[#000000]'
                : idx === 1
                ? 'bg-[#3f5e93]'
                : idx === 2
                ? 'bg-[#ca6666]'
                : 'bg-[#9CA3AF]';
            return (
              <div key={dept.departmentId || idx} className="flex flex-col gap-1 p-3 rounded-xl bg-[#f0f3ff]/50 border border-[#D8DEEA]/40">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
                  <span className="text-[11px] text-[#45474b] font-medium truncate">{dept.name}</span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-[15px] font-semibold text-[#151c27]">{formatBytes(dept.storageBytes)}</span>
                  <span className="text-[11px] text-[#9CA3AF] font-mono">{dept.docCount?.toLocaleString()} files</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Two-Column Content Grid (65% Left / 35% Right) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (65% - 8 cols of 12) */}
        <div className="lg:col-span-8 bg-white rounded-[26px] p-6 shadow-[0_4px_24px_rgba(16,20,26,0.05)] border border-[#D8DEEA]/60 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-[18px] font-semibold text-[#151c27]">Recent Documents</h2>
              <span className="text-[11px] text-[#9CA3AF]">
                {documents.length > 0 ? `Showing latest ${Math.min(5, documents.length)} vault records` : 'No documents in archive'}
              </span>
            </div>
            <button
              onClick={() => onNavigate('documents')}
              className="text-[13px] font-medium text-[#3f5e93] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              type="button"
            >
              <span>View All Documents</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f0f3ff]/60 rounded-xl">
                  <th className="py-3 px-4 text-[11px] text-[#45474b] font-medium uppercase tracking-wider rounded-l-xl">
                    Document ID &amp; Title
                  </th>
                  <th className="py-3 px-4 text-[11px] text-[#45474b] font-medium uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="py-3 px-4 text-[11px] text-[#45474b] font-medium uppercase tracking-wider">
                    Security Tier
                  </th>
                  <th className="py-3 px-4 text-[11px] text-[#45474b] font-medium uppercase tracking-wider">
                    Timestamp (UTC)
                  </th>
                  <th className="py-3 px-4 text-[11px] text-[#45474b] font-medium uppercase tracking-wider text-right rounded-r-xl">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DEEA]/30">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#9CA3AF]">
                      <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-1">folder_off</span>
                      <p className="text-sm font-semibold text-slate-600">No documents in active vault</p>
                      <p className="text-xs text-slate-400 mt-0.5">Click &quot;+ Ingest Record&quot; to securely upload documents.</p>
                    </td>
                  </tr>
                ) : (
                  documents.slice(0, 5).map((doc) => {
                    const tierBadgeClass =
                      doc.security_rank >= 4
                        ? 'bg-[rgba(206,105,105,0.14)] text-[#ca6666]'
                        : doc.security_rank === 3
                        ? 'bg-[rgba(131,162,219,0.14)] text-[#3f5e93]'
                        : 'bg-[#E4E4E4] text-[#45474b]';

                    return (
                      <tr key={doc.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="text-[15px] font-semibold text-[#151c27] group-hover:text-[#3f5e93] transition-colors">
                              {doc.title}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF] font-mono">{doc.document_number}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[13px] text-[#45474b]">
                          {doc.document_type_name || doc.document_type_code || 'General'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${tierBadgeClass}`}>
                            {doc.security_tier_name || doc.security_tier}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[13px] text-[#45474b] font-mono text-[12px] whitespace-nowrap">
                          {formatUtcDate(doc.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {onDownloadDoc && (
                              <button
                                aria-label="Download Document"
                                title="Download Decrypted File"
                                onClick={() => onDownloadDoc(doc.id, doc.document_number, doc.file_name)}
                                className="w-8 h-8 rounded-full hover:bg-[#e2e8f8] text-[#45474b] flex items-center justify-center transition-colors cursor-pointer"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[17px]">download</span>
                              </button>
                            )}
                            {onViewDocHistory && (
                              <button
                                aria-label="Version History"
                                title="Version History"
                                onClick={() => onViewDocHistory(doc)}
                                className="w-8 h-8 rounded-full hover:bg-[#e2e8f8] text-[#45474b] flex items-center justify-center transition-colors cursor-pointer"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[17px]">history</span>
                              </button>
                            )}
                            {onGenerate65B && (
                              <button
                                aria-label="Verification Certificate"
                                title="Legal Attestation Certificate"
                                onClick={() => onGenerate65B(doc)}
                                className="w-8 h-8 rounded-full hover:bg-[#e2e8f8] text-[#45474b] flex items-center justify-center transition-colors cursor-pointer"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[17px]">verified</span>
                              </button>
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

        {/* Right Column (35% - 4 cols of 12) */}
        <div className="lg:col-span-4 bg-white rounded-[26px] p-6 shadow-[0_4px_24px_rgba(16,20,26,0.05)] border border-[#D8DEEA]/60 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-[#151c27]">Activity Stream</h2>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(131,162,219,0.14)] text-[11px] font-medium text-[#3f5e93]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3f5e93] animate-ping"></span>
              Live Feed
            </span>
          </div>

          {/* Vertical Timeline */}
          <div className="relative flex flex-col pl-4">
            {/* Vertical connector line background */}
            <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-[#D8DEEA]/60"></div>

            {activity.length === 0 ? (
              <div className="py-10 text-center text-[#9CA3AF]">
                <span className="material-symbols-outlined text-[32px] text-slate-300 block mb-1">history_toggle_off</span>
                <p className="text-xs font-semibold text-slate-500">No activity logged yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Audit actions will stream here in real time.</p>
              </div>
            ) : (
              activity.slice(0, 5).map((ev) => {
                const badge = getEventBadge(ev.event_type, ev.result);
                return (
                  <div key={ev.id} className="relative flex items-start gap-3 py-3 group">
                    <div className="w-4 h-4 rounded-full bg-white border-2 border-[#3f5e93] z-10 flex items-center justify-center shrink-0 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3f5e93]"></span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-medium text-[#151c27] truncate">
                          {ev.actor_name || 'System Operator'}{' '}
                          {ev.actor_designation ? `(${ev.actor_designation})` : ''}
                        </span>
                        <span className="text-[11px] text-[#9CA3AF] shrink-0 font-mono">
                          {formatTimeAgo(ev.created_at)}
                        </span>
                      </div>
                      <span className="text-[13px] text-[#45474b]">
                        {ev.document_number
                          ? `${ev.event_type.replace(/_/g, ' ')}: ${ev.document_number}`
                          : ev.event_type.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {ev.event_hash && (
                          <span className="font-mono text-[11px] text-[#9CA3AF]">
                            {ev.event_hash.startsWith('0x')
                              ? `${ev.event_hash.slice(0, 6)}...${ev.event_hash.slice(-4)}`
                              : `0x${ev.event_hash.slice(0, 4)}...${ev.event_hash.slice(-4)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* 5. Bottom Quick-Access Bar */}
      <section className="w-full bg-white/75 backdrop-blur-xl rounded-[26px] p-4 shadow-[0_4px_20px_rgba(16,20,26,0.04)] border border-[#D8DEEA]/60 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#9CA3AF]">bolt</span>
          <span className="text-[11px] uppercase text-[#9CA3AF] font-semibold tracking-wider">
            Quick Navigation
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('documents')}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#e7eefe] text-[#151c27] transition-all shadow-xs border border-[#D8DEEA]/60 flex items-center gap-2 text-[13px] font-medium cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-[#3f5e93]">folder</span>
            <span>Vault File Browser</span>
          </button>

          <button
            onClick={() => onNavigate('approvals')}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#e7eefe] text-[#151c27] transition-all shadow-xs border border-[#D8DEEA]/60 flex items-center gap-2 text-[13px] font-medium cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-[#ca6666]">draw</span>
            <span>Signature Queue</span>
            {totalPendingApprovals > 0 && (
              <span className="text-[11px] font-medium bg-[rgba(206,105,105,0.14)] text-[#ca6666] px-1.5 py-0.5 rounded-full font-mono font-bold">
                {totalPendingApprovals}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('audit')}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#e7eefe] text-[#151c27] transition-all shadow-xs border border-[#D8DEEA]/60 flex items-center gap-2 text-[13px] font-medium cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-[#3f5e93]">fact_check</span>
            <span>Compliance Audit Log</span>
          </button>

          <button
            onClick={() => onNavigate('admin')}
            className="h-9 px-4 rounded-full bg-white hover:bg-[#e7eefe] text-[#151c27] transition-all shadow-xs border border-[#D8DEEA]/60 flex items-center gap-2 text-[13px] font-medium cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-[#45474b]">admin_panel_settings</span>
            <span>Access Control Matrix</span>
          </button>
        </div>
      </section>
    </div>
  );
}
