'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OrganizationsManagementView from '@/components/dashboard/OrganizationsManagementView';
import dynamic from 'next/dynamic';

const ShaderGradientBackground = dynamic(
  () => import('@/components/auth/ShaderGradientBackground'),
  { ssr: false }
);

interface TestOrgUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  employeeCode?: string;
  designation?: string;
  status: string;
  maxSecurityLevel: number;
  departmentName?: string;
  departmentCode?: string;
  roles: Array<{ id: string; name: string; code: string }>;
}

interface TestFleetOrg {
  id: string;
  name: string;
  code: string;
  agencyCode?: string;
  status: string;
  isVerified: boolean;
  nodalOfficerName?: string;
  nodalOfficerEmail?: string;
  nodalOfficerPhone?: string;
  features?: any;
  createdAt: string;
  tierName?: string;
  tierColor?: string;
  categoryName?: string;
  categoryIcon?: string;
  regionName?: string;
  stateCode?: string;
  usersCount: number;
  departmentsCount: number;
  documentsCount: number;
  inboundRequestsCount: number;
  outboundRequestsCount: number;
  users: TestOrgUser[];
  defaultPasswordHint: string;
}

export default function FederationAdminStandalonePage() {
  const router = useRouter();

  // Active Main Tab: 'test-accounts' | 'simulator' | 'fleet-admin'
  const [activeTab, setActiveTab] = useState<'test-accounts' | 'simulator' | 'fleet-admin'>('test-accounts');

  // Test Fleet Data
  const [fleetOrgs, setFleetOrgs] = useState<TestFleetOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL');

  // Currently Authenticated Session
  const [currentUser, setCurrentUser] = useState<any>(null);

  // New Login ID Creation Form Modal
  const [createLoginModalOpen, setCreateLoginModalOpen] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [loginForm, setLoginForm] = useState({
    fullName: '',
    email: '',
    username: '',
    employeeCode: '',
    designation: 'Staff Officer',
    password: 'Password@DMS2026!',
    departmentId: '',
    maxSecurityLevel: 3,
    roleCodes: ['OFFICER'],
  });

  // Requisition Simulator Form
  const [simulatorForm, setSimulatorForm] = useState({
    requestingOrgId: '',
    targetOrgId: '',
    subjectTitle: 'Requisition of Cyber Forensic Evidence & FIR Docket for Crime Investigation',
    referenceCaseNumber: 'CR-SPEC-2026/894',
    statutoryPurpose: 'Required for judicial trial and criminal investigation under Section 91 of Bharatiya Nagarik Suraksha Sanhita (BNSS) / CrPC.',
    requestedAccessDays: 7,
    priorityTierId: '',
  });
  const [simulatingReq, setSimulatingReq] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' }>({
    show: false,
    message: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '' }), 4000);
  };

  // Load Current Session & Test Fleet
  const loadFleetData = useCallback(async () => {
    setLoading(true);
    try {
      const [fleetRes, sessionRes] = await Promise.all([
        fetch('/api/collaboration/admin/test-fleet'),
        fetch('/api/auth/session'),
      ]);

      const fleetData = await fleetRes.json();
      if (fleetData.organizations) setFleetOrgs(fleetData.organizations);

      if (sessionRes.ok) {
        const sessData = await sessionRes.json();
        if (sessData.user) setCurrentUser(sessData.user);
      }
    } catch (err) {
      console.error('Failed to load test fleet data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  // 1-Click Session Switcher
  const handleSwitchSession = async (orgId: string, userId?: string) => {
    try {
      const res = await fetch(`/api/collaboration/admin/organizations/${orgId}/switch-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Switched session to ${data.switchedTo?.fullName} (${data.switchedTo?.organizationName})`, 'success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        showToast(data.error || 'Failed to switch session', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error switching session', 'error');
    }
  };

  // Handle Create New Login ID
  const handleCreateLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrgId || !loginForm.fullName || !loginForm.email || !loginForm.password) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/collaboration/admin/organizations/${targetOrgId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Login ID created successfully for ${loginForm.fullName}!`, 'success');
        setCreateLoginModalOpen(false);
        setLoginForm({
          fullName: '',
          email: '',
          username: '',
          employeeCode: '',
          designation: 'Staff Officer',
          password: 'Password@DMS2026!',
          departmentId: '',
          maxSecurityLevel: 3,
          roleCodes: ['OFFICER'],
        });
        loadFleetData();
      } else {
        showToast(data.error || 'Failed to create login ID', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error', 'error');
    }
  };

  // Handle Quick Pre-fill Role Templates
  const handleApplyRoleTemplate = (template: string) => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const org = fleetOrgs.find((o) => o.id === targetOrgId) || fleetOrgs[0];
    const orgCodeClean = (org?.code || 'ORG').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    switch (template) {
      case 'judge':
        setLoginForm({
          ...loginForm,
          fullName: `Hon'ble Justice K. V. Sharma`,
          email: `justice.sharma.${randomNum}@${orgCodeClean}.gov.in`,
          employeeCode: `JUD-${orgCodeClean.toUpperCase()}-${randomNum}`,
          designation: 'High Court Judge / Bench President',
          maxSecurityLevel: 5,
          roleCodes: ['ADMIN', 'OFFICER'],
        });
        break;
      case 'acp_cyber':
        setLoginForm({
          ...loginForm,
          fullName: `ACP Vikramaditya Singh (Cyber Wing)`,
          email: `acp.vikram.${randomNum}@${orgCodeClean}.gov.in`,
          employeeCode: `POL-${orgCodeClean.toUpperCase()}-${randomNum}`,
          designation: 'Assistant Commissioner of Police',
          maxSecurityLevel: 4,
          roleCodes: ['DEPT_HEAD', 'OFFICER'],
        });
        break;
      case 'collector':
        setLoginForm({
          ...loginForm,
          fullName: `District Collector Rajeshwar Rao, IAS`,
          email: `collector.rao.${randomNum}@${orgCodeClean}.gov.in`,
          employeeCode: `IAS-${orgCodeClean.toUpperCase()}-${randomNum}`,
          designation: 'District Magistrate & Collector',
          maxSecurityLevel: 4,
          roleCodes: ['DEPT_HEAD', 'OFFICER'],
        });
        break;
      case 'cbi_sp':
        setLoginForm({
          ...loginForm,
          fullName: `SP Devendra Rathore, IPS`,
          email: `sp.rathore.${randomNum}@${orgCodeClean}.gov.in`,
          employeeCode: `CBI-SP-${randomNum}`,
          designation: 'Superintendent of Police (Special Crimes)',
          maxSecurityLevel: 5,
          roleCodes: ['DEPT_HEAD', 'OFFICER'],
        });
        break;
      default:
        setLoginForm({
          ...loginForm,
          fullName: `Officer Rohit Verma`,
          email: `r.verma.${randomNum}@${orgCodeClean}.gov.in`,
          employeeCode: `EMP-${orgCodeClean.toUpperCase()}-${randomNum}`,
          designation: 'Staff Officer',
          maxSecurityLevel: 3,
          roleCodes: ['OFFICER'],
        });
    }
  };

  // Copy Credentials Helper
  const copyCredentials = (email: string, pass: string, name: string) => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${pass}`);
    showToast(`Copied credentials for ${name}`);
  };

  // Filter Orgs
  const filteredOrgs = useMemo(() => {
    return fleetOrgs.filter((org) => {
      const matchSearch =
        !searchQuery ||
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.users.some(
          (u) =>
            u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.designation?.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchOrg = selectedOrgFilter === 'ALL' || org.id === selectedOrgFilter;
      return matchSearch && matchOrg;
    });
  }, [fleetOrgs, searchQuery, selectedOrgFilter]);

  return (
    <div className="min-h-screen bg-[#f0f3ff] text-[#151c27] flex flex-col font-sans relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
        <ShaderGradientBackground />
      </div>

      {/* Top Universal Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-[#D8DEEA]/80 px-6 py-3.5 shadow-[0_4px_20px_rgba(16,20,26,0.04)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <img
              src="/nirman-logo.png"
              alt="NIRMAN DMS"
              className="w-9 h-9 object-contain rounded-xl shadow-xs bg-white p-0.5 border border-slate-200 group-hover:scale-105 transition"
            />
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-[#151c27]">
                NIRMAN <span className="text-amber-600">DMS</span>
              </span>
              <span className="text-[9px] font-extrabold text-emerald-700 tracking-wider uppercase">
                Inter-Org Sovereign Grid
              </span>
            </div>
          </Link>

          <div className="h-5 w-px bg-[#D8DEEA] mx-2 hidden sm:block" />

          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#000000] text-white shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Inter-Agency Admin &amp; Test Suite</span>
          </span>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f0f3ff] border border-[#D8DEEA] text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[#6B7280]">Logged in as:</span>
              <b className="text-[#10141A]">{currentUser.fullName}</b>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-[#000000] text-white">
                {currentUser.organization?.code || 'ORG'}
              </span>
            </div>
          )}

          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] border border-[#D8DEEA] text-xs font-semibold text-[#151c27] transition shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">dashboard</span>
            <span>Main Dashboard</span>
          </Link>

          <button
            onClick={loadFleetData}
            className="w-9 h-9 rounded-full border border-[#D8DEEA] bg-white hover:bg-[#f0f3ff] text-[#151c27] flex items-center justify-center transition cursor-pointer"
            title="Refresh Fleet Data"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 relative z-10">
        {/* Toast */}
        {toast.show && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-xs font-bold shadow-2xl border transition-all animate-bounce ${
              toast.type === 'error'
                ? 'bg-rose-950 text-rose-100 border-rose-700'
                : 'bg-[#10141A] text-white border-[#D8DEEA]/40'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* Hero Banner */}
        <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="material-symbols-outlined text-[#3f5e93] text-[26px]">hub</span>
                <h1 className="text-2xl font-black text-[#10141A] tracking-tight">
                  Sovereign Inter-Agency Administration &amp; Testing Center
                </h1>
                <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200">
                  Federation Hub
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Test cross-organization exchanges, create custom login IDs for any department or court, simulate dual approvals, and manage sovereign organizations.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setTargetOrgId(fleetOrgs[0]?.id || '');
                  setCreateLoginModalOpen(true);
                }}
                className="px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-semibold shadow-[0_4px_12px_rgba(16,20,26,0.22)] flex items-center gap-1.5 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>Create Test Login ID</span>
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#f0f3ff] rounded-full w-fit border border-[#D8DEEA]/80 flex-wrap">
            <button
              onClick={() => setActiveTab('test-accounts')}
              className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'test-accounts'
                  ? 'bg-[#000000] text-white shadow-xs'
                  : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>Test Accounts &amp; Login Switcher ({fleetOrgs.reduce((acc, o) => acc + o.usersCount, 0)} Logins)</span>
            </button>

            <button
              onClick={() => setActiveTab('fleet-admin')}
              className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'fleet-admin'
                  ? 'bg-[#000000] text-white shadow-xs'
                  : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">corporate_fare</span>
              <span>Full Organization Management Suite</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: TEST ACCOUNTS & 1-CLICK LOGIN SWITCHER */}
        {/* ========================================================================= */}
        {activeTab === 'test-accounts' && (
          <div className="space-y-6">
            {/* Filter and Quick Search */}
            <div className="bg-white rounded-[20px] p-4 border border-[#D8DEEA]/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Filter by officer name, email, designation, or agency..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedOrgFilter}
                  onChange={(e) => setSelectedOrgFilter(e.target.value)}
                  className="h-8 px-3 rounded-full bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] font-semibold outline-none focus:bg-white"
                >
                  <option value="ALL">All Organizations ({fleetOrgs.length})</option>
                  {fleetOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Organizations Grid with Active Logins */}
            <div className="space-y-6">
              {filteredOrgs.map((org) => (
                <div
                  key={org.id}
                  className="bg-white/95 rounded-[24px] p-6 border border-[#D8DEEA]/80 shadow-sm space-y-4 transition hover:border-[#3f5e93]/50"
                >
                  {/* Organization Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8DEEA]/60">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 flex items-center justify-center font-mono font-bold text-sm shrink-0">
                        {org.code.substring(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-[#10141A]">{org.name}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA]">
                            {org.code}
                          </span>
                          {org.isVerified && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                              Verified Node
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#6B7280] mt-0.5">
                          {org.tierName || 'Government Entity'} • {org.categoryName || 'General'} • Jurisdiction: {org.regionName || 'National'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setTargetOrgId(org.id);
                        setCreateLoginModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-[#f0f3ff] hover:bg-[#e2e8f8] border border-[#D8DEEA] text-xs font-semibold text-[#151c27] flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                    >
                      <span className="material-symbols-outlined text-[15px] text-[#3f5e93]">add</span>
                      <span>Add Login ID to this Org</span>
                    </button>
                  </div>

                  {/* Users Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {org.users.map((u) => (
                      <div
                        key={u.id}
                        className="bg-[#f0f3ff]/50 rounded-[18px] p-4 border border-[#D8DEEA]/60 flex flex-col justify-between gap-3 hover:bg-white hover:border-[#83A2DB]/50 transition shadow-2xs"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-xs text-[#10141A]">{u.fullName}</div>
                              <div className="text-[11px] text-[#6B7280]">{u.designation || 'Officer'}</div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono shrink-0 ${
                                u.maxSecurityLevel >= 5
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : u.maxSecurityLevel >= 4
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              T{u.maxSecurityLevel || 3}
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px] font-mono bg-white/70 p-2 rounded-xl border border-[#D8DEEA]/50 text-[#45474b]">
                            <div className="truncate flex items-center gap-1">
                              <span className="text-[#9CA3AF]">User:</span>
                              <b className="text-[#10141A]">{u.email}</b>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span>Pass: <b className="text-[#3f5e93]">{org.defaultPasswordHint}</b></span>
                              {u.employeeCode && <span>ID: {u.employeeCode}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-[#D8DEEA]/40">
                          <button
                            onClick={() => handleSwitchSession(org.id, u.id)}
                            className="flex-1 py-1.5 rounded-full bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                            title="Log In as this user and open Dashboard"
                          >
                            <span className="material-symbols-outlined text-[14px]">login</span>
                            <span>Login &amp; Open</span>
                          </button>

                          <button
                            onClick={() => copyCredentials(u.email, org.defaultPasswordHint, u.fullName)}
                            className="p-1.5 rounded-full border border-[#D8DEEA] bg-white hover:bg-[#f0f3ff] text-[#45474b] hover:text-[#10141A] transition cursor-pointer"
                            title="Copy Credentials"
                          >
                            <span className="material-symbols-outlined text-[15px]">content_copy</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FULL FLEET ADMINISTRATION SUITE */}
        {/* ========================================================================= */}
        {activeTab === 'fleet-admin' && (
          <OrganizationsManagementView
            currentUserId={currentUser?.id}
            currentUserRoles={currentUser?.roles}
            currentOrg={currentUser?.organization}
            onNavigateTab={(tab) => {
              if (tab === 'test-accounts') setActiveTab('test-accounts');
            }}
          />
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: CREATE TEST LOGIN ID */}
      {/* ========================================================================= */}
      {createLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 border border-[#D8DEEA]">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#10141A]">Create Test Login ID</h3>
                  <p className="text-xs text-[#6B7280]">Provision custom credentials into any organization for testing</p>
                </div>
              </div>
              <button onClick={() => setCreateLoginModalOpen(false)} className="text-[#9CA3AF] hover:text-[#10141A]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Quick Template Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                Quick Role Presets
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'judge', label: 'High Court Judge (T5)', icon: 'gavel' },
                  { id: 'acp_cyber', label: 'ACP Cyber Crime (T4)', icon: 'local_police' },
                  { id: 'collector', label: 'District Collector (T4)', icon: 'account_balance' },
                  { id: 'cbi_sp', label: 'CBI Superintendent (T5)', icon: 'shield' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyRoleTemplate(preset.id)}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f0f3ff] hover:bg-[#e2e8f8] border border-[#D8DEEA] text-[#3f5e93] flex items-center gap-1 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateLoginSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#45474b] mb-1">Target Organization *</label>
                <select
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] font-semibold outline-none focus:bg-white"
                >
                  {fleetOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Full Officer Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Inspector Ramesh Mane"
                    value={loginForm.fullName}
                    onChange={(e) => setLoginForm({ ...loginForm, fullName: e.target.value })}
                    required
                    className="w-full h-9 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Login Email Address *</label>
                  <input
                    type="email"
                    placeholder="r.mane@police.gov.in"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                    className="w-full h-9 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Cyber Investigator"
                    value={loginForm.designation}
                    onChange={(e) => setLoginForm({ ...loginForm, designation: e.target.value })}
                    className="w-full h-9 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Employee Service Code</label>
                  <input
                    type="text"
                    placeholder="e.g. POL-CYB-094"
                    value={loginForm.employeeCode}
                    onChange={(e) => setLoginForm({ ...loginForm, employeeCode: e.target.value })}
                    className="w-full h-9 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full font-mono uppercase text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Clearance Tier</label>
                  <select
                    value={loginForm.maxSecurityLevel}
                    onChange={(e) => setLoginForm({ ...loginForm, maxSecurityLevel: Number(e.target.value) })}
                    className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] outline-none focus:bg-white font-mono font-bold"
                  >
                    <option value={1}>T1 - Public Clearance</option>
                    <option value={2}>T2 - Institutional Clearance</option>
                    <option value={3}>T3 - Confidential Regulatory</option>
                    <option value={4}>T4 - Secret Enforcement</option>
                    <option value={5}>T5 - Top Secret Sovereign</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Password *</label>
                  <input
                    type="text"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    className="w-full h-9 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full font-mono text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setCreateLoginModalOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-[#D8DEEA] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs"
                >
                  Create &amp; Add Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
