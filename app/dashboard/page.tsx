'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EvidenceIngestionView from '@/components/dashboard/EvidenceIngestionView';
import SensitiveApprovalsView from '@/components/dashboard/SensitiveApprovalsView';
import { GlobalSearchModal } from '@/components/dashboard/GlobalSearchModal';
import { OcrIntelligenceView } from '@/components/dashboard/OcrIntelligenceView';
import { VersionHistoryModal } from '@/components/dashboard/VersionHistoryModal';
import { Section65BCertificateModal } from '@/components/dashboard/Section65BCertificateModal';
import Auditor360View from '@/components/dashboard/Auditor360View';
import RetentionHoldStudioView from '@/components/dashboard/RetentionHoldStudioView';
import NotificationsView from '@/components/dashboard/NotificationsView';
import JobQueuesView from '@/components/dashboard/JobQueuesView';
import AdministrationView from '@/components/dashboard/AdministrationView';
import UsersManagementView from '@/components/dashboard/UsersManagementView';
import DepartmentsManagementView from '@/components/dashboard/DepartmentsManagementView';
import OverviewDashboardView from '@/components/dashboard/OverviewDashboardView';
import BlockchainLedgerView from '@/components/dashboard/BlockchainLedgerView';
import { SquareLoader } from '@/components/ui/SquareLoader';

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  employeeCode: string;
  designation: string;
  maxSecurityLevel?: number;
  organization: {
    id: string;
    code: string;
    name: string;
    features?: {
      feature_approvals?: boolean;
      feature_section_65b?: boolean;
      feature_retention_holds?: boolean;
      feature_blockchain?: boolean;
      feature_deep_ocr?: boolean;
    };
  };
  department: {
    id: string;
    code: string;
    name: string;
  } | null;
  roles: string[];
  permissions: string[];
  lastLoginAt: string;
}

interface DashboardStats {
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
}

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

interface AuditEventItem {
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

interface TaxonomyDocType {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface TaxonomyDepartment {
  id: string;
  name: string;
  code: string;
}

interface TaxonomySecurityLevel {
  id: string;
  name: string;
  code: string;
  rank: number;
  isAccessible: boolean;
}

export default function DashboardPage() {
  const router = useRouter();

  // Data states
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    encryptedDocuments: 0,
    pendingApprovals: 0,
    auditEventsCount: 0,
    departmentDocuments: 0,
  });
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [activity, setActivity] = useState<AuditEventItem[]>([]);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);

  // Dynamic Taxonomies
  const [docTypes, setDocTypes] = useState<TaxonomyDocType[]>([]);
  const [departments, setDepartments] = useState<TaxonomyDepartment[]>([]);
  const [securityLevels, setSecurityLevels] = useState<TaxonomySecurityLevel[]>([]);

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  // Active View Tab
  const [activeView, setActiveView] = useState<
    | 'overview'
    | 'documents'
    | 'upload'
    | 'approvals'
    | 'audit'
    | 'blockchain'
    | 'ocr'
    | 'search-ocr'
    | 'retention'
    | 'notifications'
    | 'jobs'
    | 'admin'
    | 'users'
    | 'departments'
  >('overview');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [ocrInitialQuery, setOcrInitialQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Filter & Search states
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('ALL');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Details
  const [selectedDoc, setSelectedDoc] = useState<CaseDocument | null>(null);
  const [custodyDoc, setCustodyDoc] = useState<CaseDocument | null>(null);
  const [versionHistoryDoc, setVersionHistoryDoc] = useState<CaseDocument | null>(null);
  const [certificateDocId, setCertificateDocId] = useState<string | null>(null);
  const [hashModalOpen, setHashModalOpen] = useState(false);
  const [hashInput, setHashInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Modular DMS Feature Flags
  const features = useMemo(() => {
    const raw = user?.organization?.features;
    return {
      feature_approvals: raw?.feature_approvals !== false,
      feature_section_65b: raw?.feature_section_65b !== false,
      feature_retention_holds: raw?.feature_retention_holds !== false,
      feature_blockchain: raw?.feature_blockchain !== false,
      feature_deep_ocr: raw?.feature_deep_ocr !== false,
    };
  }, [user]);

  // ─── RBAC Sidebar Visibility Helper ────────────────────────────────────────
  // Derived from the authenticated session's permissions & roles.
  // SUPER_ADMIN bypasses all checks (full visibility).
  const canDo = useMemo(() => {
    const perms: string[] = user?.permissions || [];
    const roles: string[] = user?.roles || [];
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    const has = (...codes: string[]) =>
      isSuperAdmin || codes.some((c) => perms.includes(c));

    return {
      // Workspace
      viewDocuments:  has('DOCUMENT_VIEW'),
      uploadDocument: has('DOCUMENT_CREATE'),
      viewOcr:        has('DOCUMENT_VIEW'),
      // Personnel & Access
      manageUsers:       has('PERMISSION_MANAGE', 'USER_MANAGE'),
      manageDepartments: has('PERMISSION_MANAGE', 'DEPARTMENT_MANAGE'),
      showPersonnelSection: has('PERMISSION_MANAGE', 'USER_MANAGE', 'DEPARTMENT_MANAGE'),
      // Governance
      viewApprovals:  has('DOCUMENT_APPROVE_CHANGE', 'DOCUMENT_REJECT_CHANGE', 'DOCUMENT_REQUEST_CHANGE'),
      viewRetention:  has('RETENTION_MANAGE'),
      viewAudit:      has('AUDIT_VIEW'),
      viewBlockchain: has('BLOCKCHAIN_VIEW', 'AUDIT_VIEW', 'PERMISSION_MANAGE', 'DOCUMENT_VIEW'),
      viewJobs:       has('DOCUMENT_CREATE', 'PERMISSION_MANAGE'),   // officers + admins
      // Administration
      viewSystemSettings: has('PERMISSION_MANAGE'),
    };
  }, [user]);

  // Fallback view if module turned off OR permission revoked
  useEffect(() => {
    if (!features.feature_approvals && activeView === 'approvals') setActiveView('overview');
    if (!features.feature_deep_ocr && activeView === 'ocr') setActiveView('overview');
    if (!features.feature_retention_holds && activeView === 'retention') setActiveView('overview');
    if (!features.feature_blockchain && activeView === 'blockchain') setActiveView('overview');
    // Permission-based fallbacks
    if (!canDo.viewDocuments && activeView === 'documents') setActiveView('overview');
    if (!canDo.uploadDocument && activeView === 'upload') setActiveView('overview');
    if (!canDo.viewOcr && activeView === 'ocr') setActiveView('overview');
    if (!canDo.manageUsers && activeView === 'users') setActiveView('overview');
    if (!canDo.manageDepartments && activeView === 'departments') setActiveView('overview');
    if (!canDo.viewApprovals && activeView === 'approvals') setActiveView('overview');
    if (!canDo.viewRetention && activeView === 'retention') setActiveView('overview');
    if (!canDo.viewAudit && activeView === 'audit') setActiveView('overview');
    if (!canDo.viewBlockchain && activeView === 'blockchain') setActiveView('overview');
    if (!canDo.viewSystemSettings && activeView === 'admin') setActiveView('overview');
  }, [features, canDo, activeView]);

  // System Services Health
  const [systemHealth, setSystemHealth] = useState<{
    database?: { ok: boolean; latencyMs: number };
    storage?: { ok: boolean; latencyMs: number };
    cacheQueue?: { ok: boolean; latencyMs: number };
    kms?: { ok: boolean; latencyMs: number };
  } | null>(null);

  // Keyboard shortcut ⌘K / Ctrl+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch paginated documents
  const fetchDocuments = useCallback(async (page = 1, type = activeTypeFilter, tier = selectedTierFilter, query = searchQuery) => {
    setDocsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (type && type !== 'ALL') params.set('type', type);
      if (tier && tier !== 'ALL') params.set('tier', tier);
      if (query.trim()) params.set('search', query.trim());

      const res = await fetch(`/api/dashboard/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.documents) setDocuments(data.documents);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setDocsLoading(false);
    }
  }, [activeTypeFilter, selectedTierFilter, searchQuery]);

  const loadDashboardData = async () => {
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/login');
        return;
      }
      const userData = await userRes.json();
      setUser(userData.user);

      // Fetch Taxonomies
      const taxRes = await fetch('/api/taxonomies');
      if (taxRes.ok) {
        const taxData = await taxRes.json();
        if (taxData.documentTypes) setDocTypes(taxData.documentTypes);
        if (taxData.departments) setDepartments(taxData.departments);
        if (taxData.securityLevels) setSecurityLevels(taxData.securityLevels);
      }

      // Fetch Stats
      const statsRes = await fetch('/api/dashboard/stats');
      if (statsRes.ok) {
        const s = await statsRes.json();
        if (s.stats) setStats(s.stats);
      }

      // Fetch Paginated Documents
      await fetchDocuments(1);

      // Fetch Activity
      const actRes = await fetch('/api/dashboard/activity');
      if (actRes.ok) {
        const a = await actRes.json();
        if (a.events) setActivity(a.events);
      }

      // Fetch System Services Health
      const healthRes = await fetch('/api/system/status');
      if (healthRes.ok) {
        const h = await healthRes.json();
        if (h.services) setSystemHealth(h.services);
      }

      // Fetch Notifications Count
      const notifsRes = await fetch('/api/notifications');
      if (notifsRes.ok) {
        const n = await notifsRes.json();
        if (n.stats) setUnreadNotices(n.stats.unreadNotices || 0);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [router]);

  // Refetch documents when filters change
  const handleTypeFilterChange = (typeCode: string) => {
    setActiveTypeFilter(typeCode);
    fetchDocuments(1, typeCode, selectedTierFilter, searchQuery);
  };

  const handleTierFilterChange = (tierCode: string) => {
    setSelectedTierFilter(tierCode);
    fetchDocuments(1, activeTypeFilter, tierCode, searchQuery);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchDocuments(1, activeTypeFilter, selectedTierFilter, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchDocuments(newPage, activeTypeFilter, selectedTierFilter, searchQuery);
    }
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 4000);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      router.push('/login');
    }
  };

  const handleDownloadDocument = async (docId: string, docNumber: string, fileName: string) => {
    showToast(`Decrypting and preparing ${docNumber}...`);
    try {
      const res = await fetch(`/api/documents/${docId}/download?download=true`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to decrypt document stream');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `${docNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`✓ Decryption complete. File downloaded.`);
    } catch (err: any) {
      showToast(`Download failed: ${err.message}`);
    }
  };

  const handleVerifyHash = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch('/api/documents/verify-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashOrNumber: hashInput }),
      });
      const data = await res.json();
      setVerificationResult(data);
    } catch (err) {
      setVerificationResult({ verified: false, message: 'Verification service unreachable.' });
    } finally {
      setVerifying(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'AT';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#E9ECF4] to-[#DCE3F2] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-5 bg-white/80 backdrop-blur-xl p-10 rounded-[26px] shadow-[0_8px_32px_rgba(16,20,26,0.08)] border border-[#D8DEEA]">
          <SquareLoader size="md" color="#3f5e93" />
          <span className="text-[#151c27] text-xs font-semibold">Verifying Session &amp; Loading Vault Records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E9ECF4] to-[#DCE3F2] font-sans text-[#151c27] antialiased selection:bg-[#83A2DB]/30 selection:text-[#151c27]">
      {/* 1. Full Expanded Google Stitch Sidebar */}
      <aside className="fixed left-4 top-4 bottom-4 w-60 bg-white/95 backdrop-blur-xl rounded-[26px] shadow-[0_8px_32px_rgba(16,20,26,0.08)] border border-[#D8DEEA]/80 z-40 hidden md:flex flex-col justify-between p-3.5 overflow-y-auto [&::-webkit-scrollbar]:hidden select-none">
        <div className="flex flex-col gap-3.5">
          {/* Brand Logo & Name */}
          <div
            onClick={() => setActiveView('overview')}
            className="flex items-center gap-2.5 px-2 py-0.5 cursor-pointer"
          >
            <img src="/nirman-logo.png" alt="NIRMAN DMS" className="w-9 h-9 object-contain rounded-xl shadow-xs shrink-0 bg-white p-0.5 border border-slate-200" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-[#151c27]">
                  NIRMAN <span className="text-amber-600">DMS</span>
                </span>
              </div>
              <span className="text-[9px] font-extrabold text-emerald-700 tracking-wider uppercase truncate">
                Organise • Secure • Progress
              </span>
            </div>
          </div>

          {/* Navigation Sections — RBAC-gated: only permitted items render */}
          <nav className="flex flex-col gap-3 text-xs">

            {/* SECTION 1: WORKSPACE — always visible, items gated by DOCUMENT_VIEW / DOCUMENT_CREATE */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold tracking-wider text-[#9CA3AF] uppercase px-3 py-0.5">
                Workspace
              </span>

              {/* Overview — always visible */}
              <button
                onClick={() => setActiveView('overview')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeView === 'overview'
                    ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                    : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px]">grid_view</span>
                  <span>Overview</span>
                </div>
              </button>

              {/* Documents — requires DOCUMENT_VIEW */}
              {canDo.viewDocuments && (
                <button
                  onClick={() => setActiveView('documents')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'documents'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">description</span>
                    <span>Documents</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-semibold ${
                      activeView === 'documents'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#f0f3ff] text-[#45474b] border border-[#D8DEEA]'
                    }`}
                  >
                    {stats.totalDocuments || documents.length}
                  </span>
                </button>
              )}

              {/* Upload File — requires DOCUMENT_CREATE */}
              {canDo.uploadDocument && (
                <button
                  onClick={() => setActiveView('upload')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'upload'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">upload_file</span>
                    <span>Upload File</span>
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      activeView === 'upload'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#3f5e93] text-white'
                    }`}
                  >
                    +
                  </span>
                </button>
              )}

              {/* Search & OCR — requires DOCUMENT_VIEW and feature flag */}
              {canDo.viewOcr && features.feature_deep_ocr && (
                <button
                  onClick={() => setActiveView('ocr')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'ocr'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">document_scanner</span>
                    <span>Search &amp; OCR</span>
                  </div>
                </button>
              )}
            </div>

            {/* SECTION 2: PERSONNEL & ACCESS — only if user can manage users/departments */}
            {canDo.showPersonnelSection && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold tracking-wider text-[#9CA3AF] uppercase px-3 py-0.5">
                  Personnel &amp; Access
                </span>

                {/* Users & Clearance — requires USER_MANAGE or PERMISSION_MANAGE */}
                {canDo.manageUsers && (
                  <button
                    onClick={() => setActiveView('users')}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                      activeView === 'users'
                        ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                        : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px]">manage_accounts</span>
                      <span>Users &amp; Clearance</span>
                    </div>
                  </button>
                )}

                {/* Departments — requires DEPARTMENT_MANAGE or PERMISSION_MANAGE */}
                {canDo.manageDepartments && (
                  <button
                    onClick={() => setActiveView('departments')}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                      activeView === 'departments'
                        ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                        : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px]">corporate_fare</span>
                      <span>Departments</span>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* SECTION 3: GOVERNANCE & OPERATIONS */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold tracking-wider text-[#9CA3AF] uppercase px-3 py-0.5">
                Governance &amp; Operations
              </span>

              {/* Approvals — requires approval permission + feature flag */}
              {canDo.viewApprovals && features.feature_approvals && (
                <button
                  onClick={() => setActiveView('approvals')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'approvals'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">rule</span>
                    <span>Approvals</span>
                  </div>
                  {stats.pendingApprovals > 0 && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold ${
                        activeView === 'approvals'
                          ? 'bg-amber-400 text-black'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {stats.pendingApprovals}
                    </span>
                  )}
                </button>
              )}

              {/* Retention Holds — requires RETENTION_MANAGE + feature flag */}
              {canDo.viewRetention && features.feature_retention_holds && (
                <button
                  onClick={() => setActiveView('retention')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'retention'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">lock_clock</span>
                    <span>Retention Holds</span>
                  </div>
                </button>
              )}

              {/* Audit Trail — requires AUDIT_VIEW */}
              {canDo.viewAudit && (
                <button
                  onClick={() => setActiveView('audit')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'audit'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">receipt_long</span>
                    <span>Audit Trail</span>
                  </div>
                </button>
              )}

              {/* Blockchain Ledger — requires viewBlockchain + feature flag */}
              {canDo.viewBlockchain && features.feature_blockchain && (
                <button
                  onClick={() => setActiveView('blockchain')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'blockchain'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">token</span>
                    <span>Blockchain Ledger</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-semibold ${
                      activeView === 'blockchain'
                        ? 'bg-cyan-400 text-black font-bold'
                        : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                    }`}
                  >
                    Fabric
                  </span>
                </button>
              )}

              {/* Job Queues — visible to anyone with create/admin perms */}
              {canDo.viewJobs && (
                <button
                  onClick={() => setActiveView('jobs')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'jobs'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">hourglass_top</span>
                    <span>Job Queues</span>
                  </div>
                </button>
              )}

              {/* Alerts & Notices — always visible to authenticated users */}
              <button
                onClick={() => setActiveView('notifications')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeView === 'notifications'
                    ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                    : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px]">notifications</span>
                  <span>Alerts &amp; Notices</span>
                </div>
                {unreadNotices > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                )}
              </button>
            </div>

            {/* SECTION 4: ADMINISTRATION — requires PERMISSION_MANAGE */}
            {canDo.viewSystemSettings && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold tracking-wider text-[#9CA3AF] uppercase px-3 py-0.5">
                  Administration
                </span>

                <button
                  onClick={() => setActiveView('admin')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeView === 'admin'
                      ? 'bg-[#000000] text-white font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.20)]'
                      : 'text-[#45474b] hover:bg-[#f0f3ff] hover:text-[#151c27] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px]">settings</span>
                    <span>System Settings</span>
                  </div>
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* User Card at Bottom of Sidebar */}
        <div className="pt-2.5 border-t border-[#D8DEEA]/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#000000] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
              {getInitials(user?.fullName || user?.username || 'Officer')}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#151c27] truncate">
                {user?.fullName || 'Active Officer'}
              </span>
              <span className="text-[10px] text-[#3f5e93] font-mono truncate">
                Level {user?.maxSecurityLevel ?? 3} Clearance
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="w-7 h-7 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
          </button>
        </div>
      </aside>

      {/* 2. Top Floating Navigation Header */}
      <header className="fixed top-4 left-4 md:left-68 right-4 z-30">
        <div className="h-16 max-w-[1440px] mx-auto bg-white/90 backdrop-blur-xl rounded-full px-5 shadow-[0_8px_32px_rgba(16,20,26,0.08)] border border-[#D8DEEA]/80 flex items-center justify-between gap-4">
          {/* Active View Title & Breadcrumb */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
              {activeView === 'overview' && 'Dashboard'}
              {activeView === 'documents' && 'Workspace / Documents'}
              {activeView === 'upload' && 'Workspace / Ingestion'}
              {activeView === 'ocr' && 'Workspace / Search & OCR'}
              {activeView === 'users' && 'Personnel / Users & Clearance'}
              {activeView === 'departments' && 'Personnel / Departments'}
              {activeView === 'approvals' && 'Governance / Sensitive Approvals'}
              {activeView === 'retention' && 'Governance / Retention Holds'}
              {activeView === 'audit' && 'Governance / Audit Trail'}
              {activeView === 'jobs' && 'Operations / Job Queues'}
              {activeView === 'notifications' && 'Operations / Alerts'}
              {activeView === 'admin' && 'Administration / Governance'}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[#f0f3ff] rounded-full border border-[#D8DEEA]/50">
              <span className="w-2 h-2 rounded-full bg-[#3f5e93] animate-pulse"></span>
              <span className="text-[11px] text-[#45474b] font-mono">Vault Operational</span>
            </div>

            <button
              aria-label="Global Search"
              onClick={() => setGlobalSearchOpen(true)}
              className="h-9 px-3 sm:px-3.5 rounded-full bg-white sm:bg-[#f0f3ff] text-[#45474b] hover:bg-white hover:text-[#151c27] border border-[#D8DEEA] hover:border-[#3f5e93]/50 flex items-center gap-2 transition-all shadow-2xs group cursor-pointer"
              title="Quick search records across vault and OCR index (Press ⌘K or Ctrl+K)"
            >
              <span className="material-symbols-outlined text-[18px] text-[#3f5e93] group-hover:scale-110 transition-transform">search</span>
              <span className="hidden sm:inline text-xs font-medium text-[#45474b] group-hover:text-[#151c27]">Quick search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#f0f3ff] group-hover:bg-[#e2e8f8] border border-[#D8DEEA]/60 text-[10px] font-mono font-bold text-[#6B7280]">
                <span>⌘</span><span>K</span>
              </kbd>
            </button>

            <button
              aria-label="System Notifications"
              onClick={() => setActiveView('notifications')}
              className="bell-btn cursor-pointer"
              title="Alerts & System Notifications"
            >
              <div className="bell-container">
                <div className="bell"></div>
              </div>
              {unreadNotices > 0 && (
                <span className="bell-badge">
                  {unreadNotices > 9 ? '9+' : unreadNotices}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveView('upload')}
              className="h-9 px-4 bg-[#000000] text-white hover:bg-[#181c22] text-xs font-semibold rounded-full shadow-[0_6px_18px_rgba(16,20,26,0.22)] flex items-center gap-1.5 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Stage Content Container */}
      <div className="md:pl-68 transition-all">
        <main className="w-full max-w-[1440px] mx-auto pt-24 px-6 pb-12">
          {/* 1. OVERVIEW VIEW */}
          {activeView === 'overview' && (
            <OverviewDashboardView
              user={user}
              stats={stats}
              documents={documents}
              activity={activity}
              systemHealth={systemHealth}
              onNavigate={(v) => setActiveView(v)}
              onOpenUpload={() => setActiveView('upload')}
              onSelectDoc={(doc) => setSelectedDoc(doc)}
              onVerifyDoc={(doc) => {
                setHashInput(doc.document_number || doc.sha256_hash);
                setHashModalOpen(true);
              }}
              onViewDocHistory={(doc) => setVersionHistoryDoc(doc)}
              onGenerate65B={(doc) => setCertificateDocId(doc.id)}
              onDownloadDoc={handleDownloadDocument}
              onOpenSearch={() => setGlobalSearchOpen(true)}
            />
          )}

          {/* 2. DOCUMENTS VIEW */}
          {activeView === 'documents' && (
            <div className="flex flex-col gap-6">
              {/* Header */}
              <section className="bg-white/90 backdrop-blur-xl rounded-[26px] p-6 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-semibold">
                      Document Registry
                    </span>
                    <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full">
                      Clearance Level {user?.maxSecurityLevel ?? 3}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-[#151c27] tracking-tight mt-1 flex items-center gap-2">
                    <span>Documents &amp; Records Archive</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#000000] text-white font-mono font-semibold">
                      {pagination.total} Records
                    </span>
                  </h1>
                  <p className="text-xs text-[#45474b]">
                    Search and access institutional documents. Filter by dynamic classification types, clearance tiers, or keywords.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => {
                      setHashModalOpen(true);
                      setVerificationResult(null);
                    }}
                    className="h-10 px-4 bg-white hover:bg-[#f0f3ff] text-[#151c27] text-xs font-semibold rounded-full border border-[#D8DEEA] shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">tag</span>
                    <span>Verify Hash</span>
                  </button>
                  <button
                    onClick={() => setActiveView('upload')}
                    className="h-10 px-5 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full shadow-[0_6px_18px_rgba(16,20,26,0.22)] transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <span>+ Upload Document</span>
                  </button>
                </div>
              </section>

              {/* Table Card */}
              <div className="bg-white rounded-[26px] border border-[#D8DEEA]/80 shadow-xs flex flex-col overflow-hidden">
                {/* Search & Filter Bar */}
                <div className="p-5 border-b border-[#D8DEEA]/60 bg-[#f0f3ff]/30 flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[18px]">search</span>
                      <input
                        type="text"
                        placeholder="Search document #, title, description, or officer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-10 pl-9 pr-9 bg-white border border-[#D8DEEA] text-xs text-[#151c27] placeholder:text-[#9CA3AF] rounded-full focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            fetchDocuments(1, activeTypeFilter, selectedTierFilter, '');
                          }}
                          className="absolute right-3 top-3 text-[#9CA3AF] hover:text-[#151c27]"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </form>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-[#45474b]">Clearance:</span>
                      <select
                        value={selectedTierFilter}
                        onChange={(e) => handleTierFilterChange(e.target.value)}
                        className="h-10 px-3 bg-white border border-[#D8DEEA] text-xs font-medium text-[#151c27] rounded-full focus:outline-none focus:ring-2 focus:ring-[#3f5e93] cursor-pointer"
                      >
                        <option value="ALL">All Clearance Levels</option>
                        {securityLevels.map((sl) => (
                          <option key={sl.id} value={sl.code}>
                            {sl.code} — {sl.name} (Rank {sl.rank})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Document Type Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                    <button
                      onClick={() => handleTypeFilterChange('ALL')}
                      className={`px-3.5 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                        activeTypeFilter === 'ALL'
                          ? 'bg-[#000000] text-white shadow-xs'
                          : 'bg-white text-[#45474b] border border-[#D8DEEA] hover:bg-[#f0f3ff]'
                      }`}
                    >
                      All Types
                    </button>
                    {docTypes.map((dt) => (
                      <button
                        key={dt.id}
                        onClick={() => handleTypeFilterChange(dt.code)}
                        className={`px-3.5 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                          activeTypeFilter === dt.code
                            ? 'bg-[#3f5e93] text-white shadow-xs'
                            : 'bg-white text-[#45474b] border border-[#D8DEEA] hover:bg-[#f0f3ff]'
                        }`}
                      >
                        {dt.name} ({dt.code})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f0f3ff]/60 text-[#45474b] text-[11px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                        <th className="py-3 px-4">Document Number</th>
                        <th className="py-3 px-4">Title &amp; Summary</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Clearance</th>
                        <th className="py-3 px-4">Version &amp; Size</th>
                        <th className="py-3 px-4">Officer &amp; Dept</th>
                        <th className="py-3 px-4">SHA-256 Digest</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8DEEA]/30 text-xs text-[#151c27]">
                      {docsLoading ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <div className="flex items-center justify-center gap-2">
                              <span className="material-symbols-outlined animate-spin text-[#3f5e93]">sync</span>
                              <span>Loading vault records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : documents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-1">search_off</span>
                            <p className="text-sm font-semibold text-slate-600">No documents match the active filter</p>
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc, index) => (
                          <tr key={`${doc.id}-${doc.version_number || index}`} className="hover:bg-[#f0f3ff]/40 transition font-medium">
                            <td className="py-3.5 px-4 font-mono font-semibold text-[#151c27] whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">description</span>
                                <span>{doc.document_number}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 max-w-sm">
                              <div className="font-semibold text-[#151c27] truncate">{doc.title}</div>
                              <div className="text-[11px] text-[#9CA3AF] truncate">{doc.description || 'No notes'}</div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-[#f0f3ff] text-[#151c27] rounded-full border border-[#D8DEEA]">
                                {doc.document_type_code}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                                doc.security_rank >= 4
                                  ? 'bg-[rgba(206,105,105,0.14)] text-[#ca6666]'
                                  : doc.security_rank === 3
                                  ? 'bg-[rgba(131,162,219,0.14)] text-[#3f5e93]'
                                  : 'bg-[#E4E4E4] text-[#45474b]'
                              }`}>
                                {doc.security_tier_name || doc.security_tier}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                              <span className="text-[#151c27] font-semibold">v{doc.version_number}.0</span>
                              <span className="text-[#9CA3AF] block text-[10px]">
                                {(doc.file_size / 1024).toFixed(1)} KB
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="text-[#151c27]">{doc.owner_name}</div>
                              <div className="text-[10px] text-[#9CA3AF]">{doc.department_name}</div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[10px]">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(doc.sha256_hash);
                                  showToast(`Copied SHA-256 for ${doc.document_number}`);
                                }}
                                className="text-[#9CA3AF] hover:text-[#3f5e93] flex items-center gap-1 group cursor-pointer"
                                title="Click to copy hash"
                              >
                                <span>sha256:{doc.sha256_hash.substring(0, 8)}...</span>
                                <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100">content_copy</span>
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleDownloadDocument(doc.id, doc.document_number, doc.file_name)}
                                  className="w-8 h-8 rounded-full hover:bg-[#e2e8f8] text-[#45474b] flex items-center justify-center transition cursor-pointer"
                                  title="Download Decrypted File"
                                >
                                  <span className="material-symbols-outlined text-[17px]">download</span>
                                </button>
                                <button
                                  onClick={() => setVersionHistoryDoc(doc)}
                                  className="w-8 h-8 rounded-full hover:bg-[#e2e8f8] text-[#45474b] flex items-center justify-center transition cursor-pointer"
                                  title="Version Timeline"
                                >
                                  <span className="material-symbols-outlined text-[17px]">history</span>
                                </button>
                                <button
                                  onClick={() => setSelectedDoc(doc)}
                                  className="w-8 h-8 rounded-full hover:bg-[#e2e8f8] text-[#45474b] flex items-center justify-center transition cursor-pointer"
                                  title="View Details"
                                >
                                  <span className="material-symbols-outlined text-[17px]">visibility</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#45474b]">
                  <div className="flex items-center gap-2">
                    <span>
                      Showing <b>{documents.length}</b> of <b>{pagination.total}</b> documents
                    </span>
                    <span>•</span>
                    <span>Page <b>{pagination.page}</b> of <b>{pagination.totalPages || 1}</b></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1 || docsLoading}
                      className="px-3 py-1.5 rounded-full border border-[#D8DEEA] bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-mono font-bold text-[#151c27]">
                      {pagination.page}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages || docsLoading}
                      className="px-3 py-1.5 rounded-full border border-[#D8DEEA] bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. UPLOAD STUDIO */}
          {activeView === 'upload' && (
            <EvidenceIngestionView
              onSuccess={() => {
                setActiveView('documents');
                loadDashboardData();
                showToast('Document successfully uploaded and encrypted!');
              }}
              onCancel={() => setActiveView('overview')}
              userDepartment={user?.department?.name}
              userDesignation={user?.designation}
              userEmployeeCode={user?.employeeCode}
            />
          )}

          {/* 4. SENSITIVE APPROVALS */}
          {activeView === 'approvals' && (
            <SensitiveApprovalsView
              currentUser={user}
              onDecisionMade={() => {
                loadDashboardData();
                showToast('Approval decision recorded and audit logged.');
              }}
              onReturnToOverview={() => setActiveView('overview')}
            />
          )}

          {/* 5. AUDITOR 360 */}
          {activeView === 'audit' && (
            <Auditor360View
              onInspectDocument={(docket) => {
                const doc = documents.find((d) => d.document_number === docket);
                if (doc) setSelectedDoc(doc);
                else showToast(`Inspecting docket: ${docket}`);
              }}
              onReturnToOverview={() => setActiveView('overview')}
            />
          )}

          {/* 5.1 BLOCKCHAIN LEDGER (MODULE 21) */}
          {activeView === 'blockchain' && <BlockchainLedgerView />}

          {/* 6. OCR INTELLIGENCE */}
          {activeView === 'ocr' && (
            <OcrIntelligenceView
              initialQuery={ocrInitialQuery}
              onInspectDocument={(doc) => setSelectedDoc(doc)}
              onDownloadDocument={handleDownloadDocument}
              onReturnToOverview={() => setActiveView('overview')}
            />
          )}

          {/* 7. RETENTION & HOLDS */}
          {activeView === 'retention' && (
            <RetentionHoldStudioView
              onReturnToOverview={() => setActiveView('overview')}
              onInspectDocument={(docket) => {
                const doc = documents.find((d) => d.document_number === docket);
                if (doc) setSelectedDoc(doc);
                else showToast(`Inspecting docket: ${docket}`);
              }}
            />
          )}

          {/* 8. NOTIFICATIONS */}
          {activeView === 'notifications' && (
            <NotificationsView
              onNavigateTab={(tab) => setActiveView(tab)}
              onInspectDocument={(docket) => {
                const doc = documents.find((d) => d.document_number === docket);
                if (doc) setSelectedDoc(doc);
                else showToast(`Inspecting docket: ${docket}`);
              }}
            />
          )}

          {/* 9. JOB QUEUES */}
          {activeView === 'jobs' && <JobQueuesView />}

          {/* 10. SYSTEM ADMIN */}
          {activeView === 'admin' && (
            <AdministrationView
              currentUserId={user?.id}
              currentUserRoles={user?.roles}
              currentUserPermissions={user?.permissions}
              onNavigateTab={(tab) => setActiveView(tab as any)}
            />
          )}

          {/* 11. USERS & ACCESS */}
          {activeView === 'users' && <UsersManagementView onNotify={showToast} />}

          {/* 12. DEPARTMENTS */}
          {activeView === 'departments' && (
            <DepartmentsManagementView
              onNotify={showToast}
              onNavigateToUsers={() => setActiveView('users')}
            />
          )}
        </main>
      </div>

      {/* SHA-256 Verification Modal */}
      {hashModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 border border-[#D8DEEA]">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] flex items-center justify-center text-[#3f5e93]">
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#151c27]">Verify SHA-256 Integrity</h3>
                  <p className="text-xs text-[#9CA3AF]">Live Cryptographic Hash Verification</p>
                </div>
              </div>
              <button
                onClick={() => setHashModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#151c27] p-1 rounded-full"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#45474b]">Document # or SHA-256 Digest</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  placeholder="e.g. DOC-9824 or 64-char sha256..."
                  className="flex-1 h-10 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] font-mono text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
                <button
                  onClick={handleVerifyHash}
                  disabled={verifying}
                  className="px-4 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {verifying ? 'Checking...' : 'Verify'}
                </button>
              </div>

              {verificationResult && (
                <div className={`p-3.5 rounded-2xl border text-xs mt-2 ${
                  verificationResult.verified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  <p className="font-semibold mb-1">{verificationResult.message}</p>
                  {verificationResult.document && (
                    <div className="space-y-1 text-[11px] font-mono mt-2 pt-2 border-t border-emerald-200 text-emerald-800">
                      <div>File: {verificationResult.document.fileName} ({verificationResult.document.fileSize})</div>
                      <div>Hash: {verificationResult.document.sha256Hash}</div>
                      <div>Clearance: {verificationResult.document.securityTier}</div>
                      <div>Owner: {verificationResult.document.officer} ({verificationResult.document.department})</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setHashModalOpen(false)}
                className="px-4 py-2 bg-[#f0f3ff] hover:bg-[#e2e8f8] text-[#151c27] text-xs font-semibold rounded-full transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Document Dossier Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto border border-[#D8DEEA]">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93]">description</span>
                <h3 className="text-sm font-bold text-[#151c27]">{selectedDoc.document_number} — Record Details</h3>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-[#9CA3AF] hover:text-[#151c27] p-1 rounded-full">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#9CA3AF] block text-[10px] uppercase font-bold">Title</span>
                <span className="text-sm font-bold text-[#151c27]">{selectedDoc.title}</span>
              </div>
              <div>
                <span className="text-[#9CA3AF] block text-[10px] uppercase font-bold">Summary</span>
                <span className="text-[#45474b]">{selectedDoc.description || 'No description provided.'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#f0f3ff]/60 rounded-2xl border border-[#D8DEEA]">
                <div>
                  <span className="text-[#9CA3AF] text-[10px] uppercase font-bold block">Document Type</span>
                  <span className="font-semibold text-[#151c27]">{selectedDoc.document_type_name}</span>
                </div>
                <div>
                  <span className="text-[#9CA3AF] text-[10px] uppercase font-bold block">Classification Tier</span>
                  <span className="font-semibold text-[#151c27]">{selectedDoc.security_tier} ({selectedDoc.security_tier_name})</span>
                </div>
                <div>
                  <span className="text-[#9CA3AF] text-[10px] uppercase font-bold block">Officer</span>
                  <span className="font-semibold text-[#151c27]">{selectedDoc.owner_name}</span>
                </div>
                <div>
                  <span className="text-[#9CA3AF] text-[10px] uppercase font-bold block">Department</span>
                  <span className="font-semibold text-[#151c27]">{selectedDoc.department_name}</span>
                </div>
              </div>

              <div className="p-3.5 bg-[#10141A] text-white rounded-2xl space-y-1.5 font-mono text-[11px]">
                <div className="text-[#83A2DB] font-bold uppercase text-[10px]">Encryption &amp; Storage Integrity</div>
                <div>Algorithm: {selectedDoc.encryption_algorithm}</div>
                <div>SHA-256 Digest: {selectedDoc.sha256_hash}</div>
                <div>File Size: {(selectedDoc.file_size / (1024 * 1024)).toFixed(2)} MB</div>
                <div>Checksum Status: {selectedDoc.checksum_verified ? '✓ Verified' : 'Pending'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#D8DEEA]/60 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const doc = selectedDoc;
                    setSelectedDoc(null);
                    setVersionHistoryDoc(doc);
                  }}
                  className="px-3.5 py-1.5 bg-[#f0f3ff] hover:bg-[#e2e8f8] text-[#151c27] text-xs font-semibold rounded-full flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#3f5e93]">history</span>
                  <span>Version History</span>
                </button>
                {features.feature_section_65b && (
                  <button
                    onClick={() => {
                      const id = selectedDoc.id;
                      setSelectedDoc(null);
                      setCertificateDocId(id);
                    }}
                    className="px-3.5 py-1.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 text-xs font-semibold rounded-full flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px] text-[#3f5e93]">verified</span>
                    <span>Section 65B Certificate</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-1.5 bg-[#000000] text-white text-xs font-semibold rounded-full cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onSelectDocument={(doc) => setSelectedDoc(doc)}
        onDownloadDocument={handleDownloadDocument}
        onOpenOcrView={(q) => {
          setOcrInitialQuery(q);
          setActiveView('ocr');
        }}
      />

      {/* Version History Modal */}
      {versionHistoryDoc && (
        <VersionHistoryModal
          documentId={versionHistoryDoc.id}
          documentNumber={versionHistoryDoc.document_number}
          documentTitle={versionHistoryDoc.title}
          securityTier={versionHistoryDoc.security_tier}
          isOpen={!!versionHistoryDoc}
          onClose={() => setVersionHistoryDoc(null)}
          onDownloadVersion={(docId, verNum, fname) => handleDownloadDocument(docId, `${versionHistoryDoc.document_number}_v${verNum}`, fname)}
          onVersionUploaded={() => {
            loadDashboardData();
            showToast('New document version registered and audit logged!');
          }}
        />
      )}

      {/* Section 65B Certificate Modal */}
      {certificateDocId && (
        <Section65BCertificateModal
          documentId={certificateDocId}
          isOpen={!!certificateDocId}
          onClose={() => setCertificateDocId(null)}
        />
      )}

      {/* Toast Notification Popup */}
      <div
        className={`fixed bottom-6 right-6 z-50 bg-[#10141A] text-white px-4 py-3 rounded-full shadow-2xl text-xs flex items-center gap-2.5 transition-all duration-300 border border-white/10 ${
          toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <span className="material-symbols-outlined text-[#83A2DB] text-[18px]">verified</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
