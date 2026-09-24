'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MODULE_DESCRIPTIONS, OrganizationFeatureConfig } from '@/lib/service/service-config-shared';

interface FederationAdminViewProps {
  currentUserId?: string;
  currentUserRoles?: string[];
  currentOrg?: {
    id: string;
    code: string;
    name: string;
  };
}

interface FleetOrganization {
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
}

export default function FederationAdminView({
  currentUserId,
  currentUserRoles = [],
  currentOrg,
}: FederationAdminViewProps) {
  // Tabs: 'fleet', 'onboarding', 'taxonomies'
  const [activeTab, setActiveTab] = useState<'fleet' | 'onboarding' | 'taxonomies'>('fleet');

  const [fleetSummary, setFleetSummary] = useState<any>({});
  const [organizations, setOrganizations] = useState<FleetOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic Taxonomies State
  const [taxonomies, setTaxonomies] = useState<any>({
    tiers: [],
    categories: [],
    regions: [],
    statutoryTemplates: [],
    priorityTiers: [],
    accessModes: [],
  });

  // Selected Org for Feature Configuration Modal
  const [configOrg, setConfigOrg] = useState<FleetOrganization | null>(null);
  const [editFeatures, setEditFeatures] = useState<OrganizationFeatureConfig>({
    feature_approvals: true,
    feature_section_65b: true,
    feature_retention_holds: true,
    feature_blockchain: true,
    feature_deep_ocr: true,
    feature_inter_org_collaboration: true,
  });

  // Onboarding Wizard Form
  const [onboardForm, setOnboardForm] = useState({
    officeName: '',
    officeCode: '',
    agencyCode: '',
    tierId: '',
    domainCategoryId: '',
    jurisdictionRegionId: '',
    nodalOfficerName: '',
    nodalOfficerEmail: '',
    nodalOfficerPhone: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: 'Password@DMS2026!',
    adminEmployeeCode: '',
    adminDesignation: 'System Administrator',
  });

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' }>({
    show: false,
    message: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '' }), 4000);
  };

  const fetchFleetData = useCallback(async () => {
    setLoading(true);
    try {
      const [fleetRes, taxRes] = await Promise.all([
        fetch('/api/collaboration/admin'),
        fetch('/api/collaboration/taxonomies'),
      ]);

      const fleetData = await fleetRes.json();
      const taxData = await taxRes.json();

      if (fleetData.fleetSummary) setFleetSummary(fleetData.fleetSummary);
      if (fleetData.organizations) setOrganizations(fleetData.organizations);
      if (taxData.taxonomies) setTaxonomies(taxData.taxonomies);
    } catch (err) {
      console.error('Failed to load federation fleet data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleetData();
  }, [fetchFleetData]);

  // Handle Onboard Submit
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.officeName || !onboardForm.officeCode || !onboardForm.adminEmail) {
      showToast('Office Name, Code, and Admin Email are required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/collaboration/directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officeName: onboardForm.officeName,
          officeCode: onboardForm.officeCode,
          agencyCode: onboardForm.agencyCode,
          tierId: onboardForm.tierId || null,
          domainCategoryId: onboardForm.domainCategoryId || null,
          jurisdictionRegionId: onboardForm.jurisdictionRegionId || null,
          nodalOfficerName: onboardForm.nodalOfficerName,
          nodalOfficerEmail: onboardForm.nodalOfficerEmail,
          nodalOfficerPhone: onboardForm.nodalOfficerPhone,
          adminUser: {
            fullName: onboardForm.adminFullName || `${onboardForm.officeName} Admin`,
            email: onboardForm.adminEmail,
            employeeCode: onboardForm.adminEmployeeCode || `EMP-${onboardForm.officeCode.toUpperCase()}-001`,
            password: onboardForm.adminPassword,
            designation: onboardForm.adminDesignation,
            username: onboardForm.adminEmail.split('@')[0],
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Organization successfully onboarded!');
        setOnboardForm({
          officeName: '',
          officeCode: '',
          agencyCode: '',
          tierId: '',
          domainCategoryId: '',
          jurisdictionRegionId: '',
          nodalOfficerName: '',
          nodalOfficerEmail: '',
          nodalOfficerPhone: '',
          adminFullName: '',
          adminEmail: '',
          adminPassword: 'Password@DMS2026!',
          adminEmployeeCode: '',
          adminDesignation: 'System Administrator',
        });
        fetchFleetData();
        setActiveTab('fleet');
      } else {
        showToast(data.error || 'Onboarding failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error', 'error');
    }
  };

  // Update Feature Config on Org
  const handleSaveFeatures = async () => {
    if (!configOrg) return;
    try {
      const res = await fetch('/api/collaboration/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: configOrg.id,
          features: editFeatures,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Policies for ${configOrg.name} updated successfully`);
        setConfigOrg(null);
        fetchFleetData();
      } else {
        showToast(data.error || 'Failed to update features', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error', 'error');
    }
  };

  const filteredOrgs = organizations.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.code.toLowerCase().includes(q) ||
      o.agencyCode?.toLowerCase().includes(q) ||
      o.nodalOfficerName?.toLowerCase().includes(q) ||
      o.regionName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-16 animate-fadeIn">
      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white font-medium text-sm flex items-center gap-3 backdrop-blur-md transition-all ${
            toast.type === 'error' ? 'bg-red-600/95 border border-red-400' : 'bg-emerald-600/95 border border-emerald-400'
          }`}
        >
          <span className="material-symbols-outlined text-lg">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0d1522] via-[#14233a] to-[#0a121e] rounded-2xl p-6 text-white border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-purple-600/20 border border-purple-400/30 flex items-center justify-center text-purple-400 shadow-inner">
              <span className="material-symbols-outlined text-3xl">domain_add</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Sovereign Federation Multi-Organization Super Admin</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  National Fleet Governance
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-1">
                Manage and provision 10,000+ courts, police stations, secretariats, and dynamic governance taxonomies.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('onboarding')}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">add_business</span>
            <span>Onboard New Government Entity</span>
          </button>
        </div>

        {/* Fleet KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Registered Agencies</span>
            <div className="text-2xl font-bold text-white mt-1">{fleetSummary.totalOrganizations || organizations.length}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Verified Nodes</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{fleetSummary.verifiedNodes || 0}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Active Officers</span>
            <div className="text-2xl font-bold text-blue-400 mt-1">{fleetSummary.totalActiveUsers || 0}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Vault Documents</span>
            <div className="text-2xl font-bold text-purple-300 mt-1">{fleetSummary.totalDocumentsInVaults || 0}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Inter-Org Exchanges</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{fleetSummary.totalInterOrgRequisitions || 0}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'fleet' ? 'bg-black text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">view_list</span>
          <span>Federation Fleet Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('onboarding')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'onboarding' ? 'bg-black text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">domain_add</span>
          <span>Entity Onboarding Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('taxonomies')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'taxonomies' ? 'bg-black text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <span className="material-symbols-outlined text-lg">tune</span>
          <span>Dynamic Taxonomy &amp; Policy Studio</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FEDERATION FLEET DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'fleet' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <span className="material-symbols-outlined text-gray-400">search</span>
            <input
              type="text"
              placeholder="Search by organization name, code, nodal officer, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
            />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Organization Code</th>
                    <th className="p-3.5">Government Body Name</th>
                    <th className="p-3.5">Domain Category</th>
                    <th className="p-3.5">Jurisdiction</th>
                    <th className="p-3.5">Officers</th>
                    <th className="p-3.5">Vault Docs</th>
                    <th className="p-3.5">Exchanges</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Configure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredOrgs.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-all">
                      <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {org.code}
                      </td>

                      <td className="p-3.5">
                        <strong className="text-gray-900 dark:text-white block">{org.name}</strong>
                        <span className="text-gray-500 text-[11px]">Nodal: {org.nodalOfficerName || 'Registrar'}</span>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {org.categoryName || 'General'}
                        </span>
                      </td>

                      <td className="p-3.5 text-gray-600 dark:text-gray-400">
                        {org.regionName || 'National'}
                      </td>

                      <td className="p-3.5 font-semibold text-gray-800 dark:text-gray-200">{org.usersCount || 0}</td>
                      <td className="p-3.5 font-semibold text-gray-800 dark:text-gray-200">{org.documentsCount || 0}</td>

                      <td className="p-3.5">
                        <span className="text-emerald-600 font-semibold">{org.inboundRequestsCount || 0} In</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-blue-600 font-semibold">{org.outboundRequestsCount || 0} Out</span>
                      </td>

                      <td className="p-3.5">
                        {org.isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                            ● Verified Node
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            ● Pending
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setConfigOrg(org);
                            setEditFeatures({
                              feature_approvals: org.features?.feature_approvals !== false,
                              feature_section_65b: org.features?.feature_section_65b !== false,
                              feature_retention_holds: org.features?.feature_retention_holds !== false,
                              feature_blockchain: org.features?.feature_blockchain !== false,
                              feature_deep_ocr: org.features?.feature_deep_ocr !== false,
                              feature_inter_org_collaboration: org.features?.feature_inter_org_collaboration !== false,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] font-semibold cursor-pointer"
                        >
                          Policies &amp; Flags
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ENTITY ONBOARDING STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'onboarding' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3 pb-6 border-b border-gray-200 dark:border-gray-800">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">add_business</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Organization Onboarding Wizard</h3>
              <p className="text-xs text-gray-500">Register and provision a new sovereign government body into the federation</p>
            </div>
          </div>

          <form onSubmit={handleOnboardSubmit} className="pt-6 flex flex-col gap-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Government Body Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. High Court of Karnataka"
                  value={onboardForm.officeName}
                  onChange={(e) => setOnboardForm({ ...onboardForm, officeName: e.target.value })}
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Unique Organization Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. KA-HC-BLR"
                  value={onboardForm.officeCode}
                  onChange={(e) => setOnboardForm({ ...onboardForm, officeCode: e.target.value })}
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-mono uppercase outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Government Tier</label>
                <select
                  value={onboardForm.tierId}
                  onChange={(e) => setOnboardForm({ ...onboardForm, tierId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                >
                  <option value="">-- Select Government Tier --</option>
                  {taxonomies.tiers.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Domain Category</label>
                <select
                  value={onboardForm.domainCategoryId}
                  onChange={(e) => setOnboardForm({ ...onboardForm, domainCategoryId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                >
                  <option value="">-- Select Domain Category --</option>
                  {taxonomies.categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Jurisdiction Region</label>
                <select
                  value={onboardForm.jurisdictionRegionId}
                  onChange={(e) => setOnboardForm({ ...onboardForm, jurisdictionRegionId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                >
                  <option value="">-- Select Region / State --</option>
                  {taxonomies.regions.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Nodal Officer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Registrar General"
                  value={onboardForm.nodalOfficerName}
                  onChange={(e) => setOnboardForm({ ...onboardForm, nodalOfficerName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Nodal Officer Email</label>
                <input
                  type="email"
                  placeholder="e.g. nodal@karnataka.judiciary.gov.in"
                  value={onboardForm.nodalOfficerEmail}
                  onChange={(e) => setOnboardForm({ ...onboardForm, nodalOfficerEmail: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Nodal Phone</label>
                <input
                  type="text"
                  placeholder="+91-80-22222222"
                  value={onboardForm.nodalOfficerPhone}
                  onChange={(e) => setOnboardForm({ ...onboardForm, nodalOfficerPhone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3">Principal Organization Administrator Credentials</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Admin Email Address *</label>
                  <input
                    type="email"
                    placeholder="admin@karnataka.gov.in"
                    value={onboardForm.adminEmail}
                    onChange={(e) => setOnboardForm({ ...onboardForm, adminEmail: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Initial Password *</label>
                  <input
                    type="password"
                    value={onboardForm.adminPassword}
                    onChange={(e) => setOnboardForm({ ...onboardForm, adminPassword: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm shadow-md cursor-pointer transition-all"
              >
                Provision &amp; Connect Node
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DYNAMIC TAXONOMY & POLICY STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'taxonomies' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Statutory Templates */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-500">gavel</span>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Active Statutory Grounds Templates</h3>
                </div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800 mt-3">
                {taxonomies.statutoryTemplates.map((st: any) => (
                  <div key={st.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <strong className="text-gray-900 dark:text-white">{st.title}</strong>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800">
                        {st.section_citation}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{st.legal_act_name}</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 italic">{st.default_purpose_text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Urgency & SLA Tiers */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">timer</span>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Dynamic Urgency &amp; SLA Tiers</h3>
                </div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800 mt-3">
                {taxonomies.priorityTiers.map((pt: any) => (
                  <div key={pt.id} className="py-3 flex items-center justify-between">
                    <div>
                      <strong className="text-gray-900 dark:text-white">{pt.name}</strong>
                      <p className="text-[11px] text-gray-500 mt-0.5">{pt.description}</p>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-bold font-mono"
                      style={{
                        backgroundColor: pt.badge_color ? `${pt.badge_color}20` : '#3b82f620',
                        color: pt.badge_color || '#3b82f6',
                      }}
                    >
                      {pt.sla_hours}h SLA
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Configuration Modal */}
      {configOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Governance Policies &amp; Flags</h3>
                <p className="text-xs text-gray-500">{configOrg.name} ({configOrg.code})</p>
              </div>

              <button
                onClick={() => setConfigOrg(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 text-xs">
              {(Object.keys(MODULE_DESCRIPTIONS) as Array<keyof OrganizationFeatureConfig>).map((key) => {
                const desc = MODULE_DESCRIPTIONS[key];
                const isEnabled = editFeatures[key] !== false;
                return (
                  <div
                    key={key}
                    onClick={() => setEditFeatures({ ...editFeatures, [key]: !isEnabled })}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-purple-600 dark:text-purple-400">
                        {desc.icon}
                      </span>
                      <div>
                        <strong className="text-gray-900 dark:text-white block">{desc.label}</strong>
                        <p className="text-[11px] text-gray-500 mt-0.5">{desc.description}</p>
                      </div>
                    </div>

                    <span
                      className={`w-10 h-6 rounded-full p-1 transition-all ${
                        isEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-all ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                onClick={() => setConfigOrg(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveFeatures}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer"
              >
                Save Organization Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
