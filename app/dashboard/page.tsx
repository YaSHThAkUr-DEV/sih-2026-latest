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

  // Quick Upload Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocNumber, setUploadDocNumber] = useState('');
  const [uploadDocType, setUploadDocType] = useState('OM');
  const [uploadDept, setUploadDept] = useState('ADMIN');
  const [uploadSecTier, setUploadSecTier] = useState('T2');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Administrative Clearance Gate
  const canAccessAdmin = useMemo(() => {
    if (!user) return true;
    return (
      (user.roles || []).some((r) => ['SUPER_ADMIN', 'ORG_ADMIN'].includes(r)) ||
      (user.permissions || []).includes('PERMISSION_MANAGE') ||
      (user.permissions || []).includes('USER_MANAGE')
    );
  }, [user]);

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

  // Fallback view if module turned off
  useEffect(() => {
    if (!features.feature_approvals && activeView === 'approvals') setActiveView('overview');
    if (!features.feature_deep_ocr && activeView === 'ocr') setActiveView('overview');
    if (!features.feature_retention_holds && activeView === 'retention') setActiveView('overview');
  }, [features, activeView]);

  // System Services Health
  const [systemHealth, setSystemHealth] = useState<{
    database?: { ok: boolean; latencyMs: number };
    storage?: { ok: boolean; latencyMs: number };
    cacheQueue?: { ok: boolean; latencyMs: number };
    kms?: { ok: boolean; latencyMs: number };
  } | null>(null);

  // Toast & UTC Clock
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a document file.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Document title is required.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadStep('Calculating SHA-256 integrity hash...');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle);
      if (uploadDocNumber) formData.append('documentNumber', uploadDocNumber);
      formData.append('docTypeCode', uploadDocType);
      formData.append('deptCode', uploadDept);
      formData.append('secCode', uploadSecTier);
      formData.append('description', uploadDesc);

      setUploadStep('Performing AES-256-GCM envelope encryption...');

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadStep('Writing to storage and recording document...');
      setUploadSuccess(data.document);
      showToast(`Document ${data.document.documentNumber} uploaded and encrypted!`);

      setUploadFile(null);
      setUploadTitle('');
      setUploadDocNumber('');
      setUploadDesc('');

      await loadDashboardData();
    } catch (err: any) {
      setUploadError(err.message || 'Error occurred during document upload.');
    } finally {
      setUploading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded bg-slate-900 text-white flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-2xl">shield</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-xs font-medium">
            <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Verifying Session &amp; Loading Workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 font-sans text-slate-900 min-h-screen flex flex-col antialiased selection:bg-blue-100 selection:text-slate-900">
      {/* 1. Left Fixed Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-screen w-[260px] bg-[#0c101c] border-r border-slate-800/90 z-50 flex flex-col justify-between shadow-xl select-none text-slate-300">
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo Identity */}
          <div className="p-4 flex flex-col gap-2.5 border-b border-slate-800/80 bg-gradient-to-b from-blue-950/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <span className="material-symbols-outlined text-[20px]">cloud_done</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-white tracking-tight truncate">CloudDMS</span>
                <span className="text-[10px] text-blue-400 font-mono tracking-wider uppercase font-semibold">
                  Institutional Custody
                </span>
              </div>
            </div>

            {/* Org Switcher / Indicator */}
            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-blue-400">domain</span>
                <span className="text-xs text-slate-200 font-medium truncate">
                  {user?.organization?.name || 'General Administration'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-600/30 text-blue-300">
                Level {user?.maxSecurityLevel ?? 3}
              </span>
            </div>
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 px-3 space-y-4 py-3 text-xs">
            {/* 1. WORKSPACE */}
            <div className="space-y-1">
              <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Workspace
              </span>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveView('overview')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'overview'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px]">grid_view</span>
                    <span>Overview</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('documents')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'documents'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px]">description</span>
                    <span>Documents</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      activeView === 'documents' ? 'bg-blue-800 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {pagination.total || stats.totalDocuments}
                  </span>
                </button>

                <button
                  onClick={() => setActiveView('upload')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'upload'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span>Upload File</span>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-blue-400">add_circle</span>
                </button>

                {features.feature_deep_ocr && (
                  <button
                    onClick={() => setActiveView('ocr')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                      activeView === 'ocr'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                      <span>Search &amp; OCR</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* 2. PERSONNEL & ACCESS */}
            <div className="space-y-1">
              <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Personnel &amp; Access
              </span>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveView('users')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'users'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                    <span>Users &amp; Clearance</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('departments')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'departments'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
                    <span>Departments</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. GOVERNANCE & OPERATIONS */}
            <div className="space-y-1">
              <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Governance &amp; Operations
              </span>
              <div className="space-y-0.5">
                {features.feature_approvals && (
                  <button
                    onClick={() => setActiveView('approvals')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                      activeView === 'approvals'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px]">fact_check</span>
                      <span>Approvals</span>
                    </div>
                    {stats.pendingApprovals > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {stats.pendingApprovals}
                      </span>
                    )}
                  </button>
                )}

                {features.feature_retention_holds && (
                  <button
                    onClick={() => setActiveView('retention')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                      activeView === 'retention'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="material-symbols-outlined text-[18px]">lock_clock</span>
                      <span className="truncate">Retention Holds</span>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => setActiveView('audit')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'audit'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    <span className="truncate">Audit Trail</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('jobs')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'jobs'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="material-symbols-outlined text-[18px]">sync_saved_locally</span>
                    <span className="truncate">Job Queues</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('notifications')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                    activeView === 'notifications'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                    <span className="truncate">Alerts</span>
                  </div>
                  {unreadNotices > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-mono">
                      {unreadNotices}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 4. ADMINISTRATION */}
            {canAccessAdmin && (
              <div className="space-y-1">
                <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Administration
                </span>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveView('admin')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold transition-all ${
                      activeView === 'admin'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      <span className="truncate">System Settings</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </nav>
        </div>

        {/* User Card & Sign Out */}
        <div className="p-3 m-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.fullName ? user.fullName[0] : 'U'}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0c101c]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-white truncate">{user?.fullName || 'User'}</span>
              <span className="text-[10px] text-slate-400 truncate">{user?.email || 'Active'}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="Sign out"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </aside>

      {/* 2. Top Header Bar */}
      <header className="fixed top-0 left-[260px] right-0 h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 z-40 flex items-center justify-between px-6 shadow-xs">
        {/* Instant Search Bar */}
        <div className="flex items-center flex-1 max-w-lg">
          <div
            onClick={() => setGlobalSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 hover:bg-white text-slate-500 border border-slate-200 hover:border-blue-400 transition-all cursor-pointer group shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-blue-600 transition">search</span>
            <input
              type="text"
              readOnly
              value={searchQuery}
              placeholder="Search documents, taxonomies, or full text... (⌘K)"
              className="w-full bg-transparent border-none outline-none text-xs text-slate-900 placeholder:text-slate-400 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded font-medium">⌘K</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-4">
          {/* Storage Quota Bar */}
          <div className="hidden xl:flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-600 font-medium">
                {(stats.totalStorageBytes || 0) >= 1024 * 1024 * 1024
                  ? `${((stats.totalStorageBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                  : `${((stats.totalStorageBytes || 0) / (1024 * 1024)).toFixed(1)} MB`} stored
              </span>
            </div>
            <div className="w-28 h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1 border border-slate-200">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(3, Math.min(100, stats.storageUsedPercentage || 1))}%` }}
              />
            </div>
          </div>

          {/* Clean Status Pill */}
          <div className="hidden 2xl:flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Database Connected
            </span>
          </div>

          {/* Notifications Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveView('notifications')}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            {unreadNotices > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                {unreadNotices}
              </span>
            )}
          </div>

          {/* + Upload Button */}
          <button
            type="button"
            onClick={() => setActiveView('upload')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Upload</span>
          </button>
        </div>
      </header>

      {/* 3. Main Stage Content */}
      <main className="pl-[260px] pt-16 flex-1 w-full bg-[#f8fafc] min-h-screen">
        <div className="p-6 max-w-7xl mx-auto space-y-6">

          {/* 1. OVERVIEW DASHBOARD */}
          {activeView === 'overview' && (
            <OverviewDashboardView
              user={user}
              stats={stats}
              documents={documents}
              systemHealth={systemHealth}
              onNavigate={(v) => setActiveView(v)}
              onOpenUpload={() => setActiveView('upload')}
              onSelectDoc={(doc) => setSelectedDoc(doc)}
              onVerifyDoc={(doc) => {
                setHashInput(doc.document_number || doc.sha256_hash);
                setHashModalOpen(true);
              }}
            />
          )}

          {/* 2. DOCUMENTS VIEW (With Dynamic Taxonomy Filters & Pagination) */}
          {activeView === 'documents' && (
            <div className="space-y-6">
              {/* Clean Document Registry Header */}
              <section className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded tracking-wider">
                      Document Registry
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      Clearance Gated (Level {user?.maxSecurityLevel ?? 3})
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                    <span>Documents &amp; Records Archive</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono font-bold">
                      {pagination.total} Records
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 max-w-3xl">
                    Search and access institutional documents. Filter by dynamic classification types, clearance tiers, or full-text keywords.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap w-full xl:w-auto">
                  <button
                    onClick={() => {
                      setHashModalOpen(true);
                      setVerificationResult(null);
                    }}
                    className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px] text-blue-600">tag</span>
                    <span>Verify Hash</span>
                  </button>
                  <button
                    onClick={() => setActiveView('upload')}
                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <span>+ Upload Document</span>
                  </button>
                </div>
              </section>

              {/* Full-Width Evidence Registry */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
                {/* Advanced Search & Dynamic Taxonomy Filter Bar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Live Search Input */}
                    <form onSubmit={handleSearchSubmit} className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
                      <input
                        type="text"
                        placeholder="Search document #, title, description, or officer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-9 pr-9 bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            fetchDocuments(1, activeTypeFilter, selectedTierFilter, '');
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </form>

                    {/* Dynamic Security Tier Dropdown */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-slate-600">Clearance:</span>
                      <select
                        value={selectedTierFilter}
                        onChange={(e) => handleTierFilterChange(e.target.value)}
                        className="h-9 px-3 bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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

                  {/* Dynamic Document Type Filter Pills (No Hardcodes!) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-200/60">
                    <button
                      onClick={() => handleTypeFilterChange('ALL')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                        activeTypeFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All Types
                    </button>
                    {docTypes.map((dt) => (
                      <button
                        key={dt.id}
                        onClick={() => handleTypeFilterChange(dt.code)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          activeTypeFilter === dt.code
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
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
                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4">Document Number</th>
                        <th className="py-3 px-4">Title &amp; Summary</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Clearance</th>
                        <th className="py-3 px-4">Version &amp; Size</th>
                        <th className="py-3 px-4">Officer &amp; Department</th>
                        <th className="py-3 px-4">SHA-256 Digest</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                      {docsLoading ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <div className="flex items-center justify-center gap-2">
                              <span className="material-symbols-outlined animate-spin text-blue-600">sync</span>
                              <span>Loading records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : documents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-1">search_off</span>
                            <p className="text-sm font-semibold text-slate-600">No documents match the active filter criteria</p>
                            <p className="text-xs text-slate-400 mt-0.5">Try resetting search or adjusting clearance filter.</p>
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/70 transition font-medium">
                            <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-blue-600">description</span>
                                <span>{doc.document_number}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 max-w-sm">
                              <div className="font-semibold text-slate-900 truncate">{doc.title}</div>
                              <div className="text-[11px] text-slate-500 truncate">{doc.description || 'No notes'}</div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                {doc.document_type_code}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                doc.security_tier === 'T5'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : doc.security_tier === 'T4'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : doc.security_tier === 'T3'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {doc.security_tier} {doc.security_tier_name}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                              <span className="text-slate-800 font-semibold">v{doc.version_number}.0</span>
                              <span className="text-slate-400 block text-[10px]">
                                {(doc.file_size / 1024).toFixed(1)} KB
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="text-slate-900">{doc.owner_name}</div>
                              <div className="text-[10px] text-slate-500">{doc.department_name}</div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[10px]">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(doc.sha256_hash);
                                  showToast(`Copied SHA-256 for ${doc.document_number}`);
                                }}
                                className="text-slate-500 hover:text-blue-600 flex items-center gap-1 group"
                                title="Click to copy hash"
                              >
                                <span>sha256:{doc.sha256_hash.substring(0, 10)}...</span>
                                <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100">content_copy</span>
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleDownloadDocument(doc.id, doc.document_number, doc.file_name)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 text-xs font-semibold rounded-md flex items-center gap-1 transition"
                                  title="Decrypt & Download"
                                >
                                  <span className="material-symbols-outlined text-[14px]">download</span>
                                  <span>Decrypt</span>
                                </button>
                                <button
                                  onClick={() => setVersionHistoryDoc(doc)}
                                  className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition"
                                  title="Version Timeline"
                                >
                                  <span className="material-symbols-outlined text-[18px]">history_edu</span>
                                </button>
                                <button
                                  onClick={() => setSelectedDoc(doc)}
                                  className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                                  title="View Details"
                                >
                                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                                </button>
                                <button
                                  onClick={() => setCustodyDoc(doc)}
                                  className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition"
                                  title="Chain of Custody"
                                >
                                  <span className="material-symbols-outlined text-[18px]">history</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
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
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-mono font-bold text-slate-800">
                      {pagination.page}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages || docsLoading}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition"
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
          {activeView === 'jobs' && (
            <JobQueuesView />
          )}

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
          {activeView === 'users' && (
            <UsersManagementView onNotify={showToast} />
          )}

          {/* 12. DEPARTMENTS */}
          {activeView === 'departments' && (
            <DepartmentsManagementView
              onNotify={showToast}
              onNavigateToUsers={() => setActiveView('users')}
            />
          )}

        </div>
      </main>

      {/* SHA-256 Verification Modal */}
      {hashModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-700">
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Verify Cryptographic SHA-256 Digest</h3>
                  <p className="text-xs text-slate-500">Live Database Attestation Check</p>
                </div>
              </div>
              <button
                onClick={() => setHashModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-700">Enter Document # or SHA-256 Hex Hash</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  placeholder="e.g. DOC-OM-2026-0001 or full sha256..."
                  className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <button
                  onClick={handleVerifyHash}
                  disabled={verifying}
                  className="px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
                >
                  {verifying ? 'Checking...' : 'Verify'}
                </button>
              </div>

              {verificationResult && (
                <div className={`p-3 rounded-lg border text-xs mt-2 ${
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
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Document Dossier Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">description</span>
                <h3 className="text-sm font-bold text-slate-900">{selectedDoc.document_number} — Document Details</h3>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Title</span>
                <span className="text-sm font-bold text-slate-900">{selectedDoc.title}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Summary / Description</span>
                <span className="text-slate-700">{selectedDoc.description || 'No description provided.'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Document Type</span>
                  <span className="font-semibold text-slate-900">{selectedDoc.document_type_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Classification Tier</span>
                  <span className="font-semibold text-slate-900">{selectedDoc.security_tier} ({selectedDoc.security_tier_name})</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Owner / Officer</span>
                  <span className="font-semibold text-slate-900">{selectedDoc.owner_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Department</span>
                  <span className="font-semibold text-slate-900">{selectedDoc.department_name}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-lg space-y-1.5 font-mono text-[11px]">
                <div className="text-blue-400 font-bold uppercase text-[10px]">Encryption &amp; Storage Integrity</div>
                <div>Algorithm: {selectedDoc.encryption_algorithm}</div>
                <div>SHA-256 Digest: {selectedDoc.sha256_hash}</div>
                <div>File Size: {(selectedDoc.file_size / (1024 * 1024)).toFixed(2)} MB</div>
                <div>Checksum Status: {selectedDoc.checksum_verified ? '✓ Verified' : 'Pending'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const doc = selectedDoc;
                    setSelectedDoc(null);
                    setVersionHistoryDoc(doc);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-600">history_edu</span>
                  <span>Version History</span>
                </button>
                {features.feature_section_65b && (
                  <button
                    onClick={() => {
                      const id = selectedDoc.id;
                      setSelectedDoc(null);
                      setCertificateDocId(id);
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                  >
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                    <span>Section 65B Certificate</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chain of Custody History Modal */}
      {custodyDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">history</span>
                <h3 className="text-sm font-bold text-slate-900">Chain of Custody: {custodyDoc.document_number}</h3>
              </div>
              <button onClick={() => setCustodyDoc(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="font-bold text-slate-900">{custodyDoc.title}</div>
                <div className="font-mono text-[11px] text-slate-500">SHA-256: {custodyDoc.sha256_hash}</div>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 block">Initial Upload &amp; Checksum Verification</span>
                    <span className="text-[11px] text-emerald-700">By {custodyDoc.owner_name} ({custodyDoc.department_name})</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-800 font-bold">VERIFIED</span>
                </div>
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-900 block">AES-256 Encryption Envelope</span>
                    <span className="text-[11px] text-blue-700">Algorithm: {custodyDoc.encryption_algorithm}</span>
                  </div>
                  <span className="font-mono text-[10px] text-blue-800 font-bold">SECURE</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button onClick={() => setCustodyDoc(null)} className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
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
        className={`fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-xs flex items-center gap-2.5 transition-all duration-300 ${
          toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <span className="material-symbols-outlined text-blue-400 text-[18px]">verified</span>
        <span>{toast.message}</span>
      </div>

    </div>
  );
}
