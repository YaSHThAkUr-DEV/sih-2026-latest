'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ServiceSetupModal } from './ServiceSetupModal';
import {
  OrganizationFeatureConfig,
  DEFAULT_FULL_FEATURES,
  MODULE_DESCRIPTIONS,
} from '@/lib/service/service-config-shared';

interface AdministrationViewProps {
  currentUserId?: string;
  currentUserRoles?: string[];
  currentUserPermissions?: string[];
  onNavigateTab?: (tab: string) => void;
}

interface UserItem {
  id: string;
  username: string;
  full_name: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
  employee_code?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'INVITED';
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  team_code?: string | null;
  last_login_at?: string | null;
  created_at: string;
  roles: Array<{ id: string; name: string; code: string }>;
}

interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  status: string;
  parent_department_id?: string | null;
  parent_department_name?: string | null;
  member_count: string;
  team_count: string;
  policy_count: string;
}

interface TeamItem {
  id: string;
  name: string;
  code: string;
  status: string;
  department_id: string;
  department_name: string;
  department_code: string;
  member_count: string;
}

interface RoleItem {
  id: string;
  name: string;
  code: string;
  description: string;
  is_system_role: boolean;
  user_count: string;
  permissions: Array<{ id: string; code: string; description: string }>;
}

interface PermissionItem {
  id: string;
  code: string;
  description: string;
  category: string;
}

interface DocumentTypeItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  active: boolean;
  document_count: string;
  assigned_departments_count: string;
}

interface SecurityTierItem {
  id: string;
  name: string;
  code: string;
  rank: number;
  description: string;
  approval_required: boolean;
  encryption_required: boolean;
  audit_level: number;
  document_count: string;
}

interface DepartmentPolicyItem {
  id: string;
  organization_id: string;
  department_id: string;
  department_name: string;
  department_code: string;
  document_type_id: string;
  document_type_name: string;
  document_type_code: string;
  security_level_id: string;
  security_level_name: string;
  security_level_code: string;
  security_level_rank: number;
  retention_policy_id: string;
  retention_policy_name: string;
  retention_schedule_code: string;
  approval_required: boolean;
  ocr_required: boolean;
  download_allowed: boolean;
  active: boolean;
}

interface RetentionScheduleItem {
  id: string;
  name: string;
  schedule_code: string;
  retention_days: number | null;
  permanent: boolean;
  deletion_requires_approval: boolean;
  action_on_expiry: string;
  statutory_framework: string;
  description: string;
  document_count: string;
  assigned_policies_count: string;
}

interface AdminAuditItem {
  id: string;
  event_type: string;
  result: string;
  created_at: string;
  event_hash: string;
  ip_address: string;
  resource_type: string;
  actor_name?: string;
  actor_email?: string;
  event_metadata?: any;
}

export default function AdministrationView({
  currentUserId,
  currentUserRoles = [],
  currentUserPermissions = [],
  onNavigateTab,
}: AdministrationViewProps) {
  // Active primary tab
  const [activeTab, setActiveTab] = useState<'users' | 'hierarchy' | 'rbac' | 'types_tiers' | 'policies' | 'modules' | 'system'>('users');

  // Office Modules & Service Features state
  const [officeFeatures, setOfficeFeatures] = useState<OrganizationFeatureConfig>({ ...DEFAULT_FULL_FEATURES });
  const [officeInfo, setOfficeInfo] = useState<{ id: string; name: string; code: string; status: string } | null>(null);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  // Global loading and feedback
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Data states
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeItem[]>([]);
  const [securityLevels, setSecurityLevels] = useState<SecurityTierItem[]>([]);
  const [policies, setPolicies] = useState<DepartmentPolicyItem[]>([]);
  const [retentionSchedules, setRetentionSchedules] = useState<RetentionScheduleItem[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [recentAudits, setRecentAudits] = useState<AdminAuditItem[]>([]);

  // Users Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');

  // RBAC Selected Role
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [rolePermissionsState, setRolePermissionsState] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Policy Selected Department
  const [policyDeptFilter, setPolicyDeptFilter] = useState<string>('');

  // Modals state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [editUserModalUser, setEditUserModalUser] = useState<UserItem | null>(null);
  const [createDeptModalOpen, setCreateDeptModalOpen] = useState(false);
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [createDocTypeModalOpen, setCreateDocTypeModalOpen] = useState(false);
  const [createScheduleModalOpen, setCreateScheduleModalOpen] = useState(false);
  const [createPolicyModalOpen, setCreatePolicyModalOpen] = useState(false);

  // Form States
  const [enrollForm, setEnrollForm] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    designation: '',
    employeeCode: '',
    departmentId: '',
    teamId: '',
    password: '',
    roleIds: [] as string[],
  });

  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    designation: '',
    employeeCode: '',
    departmentId: '',
    teamId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
    password: '',
    roleIds: [] as string[],
  });

  const [deptForm, setDeptForm] = useState({ name: '', code: '', parentDepartmentId: '' });
  const [teamForm, setTeamForm] = useState({ departmentId: '', name: '', code: '' });
  const [roleForm, setRoleForm] = useState({ name: '', code: '', description: '' });
  const [docTypeForm, setDocTypeForm] = useState({ name: '', code: '', description: '' });
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    scheduleCode: '',
    retentionDays: 1095,
    permanent: false,
    deletionRequiresApproval: true,
    actionOnExpiry: 'Maker-Checker Review & Cryptographic Zeroization',
    statutoryFramework: 'Administrative Archives Directives 2026',
    description: '',
  });
  const [policyAssignForm, setPolicyAssignForm] = useState({
    departmentId: '',
    documentTypeId: '',
    securityLevelId: '',
    retentionPolicyId: '',
    approvalRequired: false,
    ocrRequired: true,
    downloadAllowed: true,
  });

  // Flash feedback auto-clear
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Initial Fetcher
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        usersRes,
        deptsRes,
        teamsRes,
        rolesRes,
        permsRes,
        typesRes,
        tiersRes,
        policiesRes,
        retSchedulesRes,
        sysRes,
      ] = await Promise.all([
        fetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/admin/departments').then((r) => r.json()),
        fetch('/api/admin/teams').then((r) => r.json()),
        fetch('/api/admin/roles').then((r) => r.json()),
        fetch('/api/admin/permissions').then((r) => r.json()),
        fetch('/api/admin/document-types').then((r) => r.json()),
        fetch('/api/admin/security-levels').then((r) => r.json()),
        fetch('/api/admin/policies').then((r) => r.json()),
        fetch('/api/admin/retention-policies').then((r) => r.json()).catch(() => ({ policies: [] })),
        fetch('/api/admin/system-config').then((r) => r.json()),
      ]);

      if (usersRes.users) setUsers(usersRes.users);
      if (deptsRes.departments) {
        setDepartments(deptsRes.departments);
        if (deptsRes.departments.length > 0 && !policyDeptFilter) {
          setPolicyDeptFilter(deptsRes.departments[0].id);
        }
      }
      if (teamsRes.teams) setTeams(teamsRes.teams);
      if (rolesRes.roles) {
        setRoles(rolesRes.roles);
        if (!selectedRole && rolesRes.roles.length > 0) {
          setSelectedRole(rolesRes.roles[0]);
          setRolePermissionsState(rolesRes.roles[0].permissions.map((p: any) => p.id));
        }
      }
      if (permsRes.permissions) setPermissions(permsRes.permissions);
      if (typesRes.documentTypes) setDocumentTypes(typesRes.documentTypes);
      if (tiersRes.securityLevels) setSecurityLevels(tiersRes.securityLevels);
      if (policiesRes.policies) setPolicies(policiesRes.policies);
      if (retSchedulesRes.policies) setRetentionSchedules(retSchedulesRes.policies);
      if (sysRes.configs) setSystemConfig(sysRes.configs);
      if (sysRes.metrics) setSystemMetrics(sysRes.metrics);
      if (sysRes.recentAdminAudits) setRecentAudits(sysRes.recentAdminAudits);
    } catch (err: any) {
      console.error('Failed to load admin registry:', err);
      setActionFeedback({
        type: 'error',
        message: 'Error retrieving institutional administration registry.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOfficeFeatures = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/organization-features');
      if (res.ok) {
        const data = await res.json();
        if (data.features) setOfficeFeatures(data.features);
        if (data.organization) setOfficeInfo(data.organization);
      }
    } catch (e) {
      console.error('Failed to load office features:', e);
    }
  }, []);

  const handleSaveFeatures = async () => {
    setSavingFeatures(true);
    try {
      const res = await fetch('/api/admin/organization-features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: officeFeatures }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to update feature toggles' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Office modules updated and synchronized.' });
      if (data.features) setOfficeFeatures(data.features);
    } catch (e: any) {
      setActionFeedback({ type: 'error', message: e.message || 'Error updating modules' });
    } finally {
      setSavingFeatures(false);
    }
  };

  useEffect(() => {
    loadAllData();
    loadOfficeFeatures();
  }, [loadOfficeFeatures]);

  // Filtered Users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userStatusFilter !== 'ALL' && u.status !== userStatusFilter) return false;
      if (userDeptFilter && u.department_id !== userDeptFilter) return false;
      if (userSearch) {
        const q = userSearch.toLowerCase();
        const matchName = u.full_name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchUser = u.username?.toLowerCase().includes(q);
        const matchCode = u.employee_code?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchUser && !matchCode) return false;
      }
      return true;
    });
  }, [users, userSearch, userDeptFilter, userStatusFilter]);

  // Handlers
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrollForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to enroll user.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'User enrolled into institutional registry.' });
      setEnrollModalOpen(false);
      setEnrollForm({
        username: '',
        fullName: '',
        email: '',
        phone: '',
        designation: '',
        employeeCode: '',
        departmentId: '',
        teamId: '',
        password: '',
        roleIds: [],
      });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleOpenEditUser = (user: UserItem) => {
    setEditUserModalUser(user);
    setEditUserForm({
      fullName: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      designation: user.designation || '',
      employeeCode: user.employee_code || '',
      departmentId: user.department_id || '',
      teamId: user.team_id || '',
      status: user.status === 'INVITED' ? 'ACTIVE' : user.status,
      password: '',
      roleIds: user.roles.map((r) => r.id),
    });
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModalUser) return;
    try {
      const payload: any = {
        fullName: editUserForm.fullName,
        email: editUserForm.email,
        phone: editUserForm.phone,
        designation: editUserForm.designation,
        employeeCode: editUserForm.employeeCode,
        departmentId: editUserForm.departmentId || null,
        teamId: editUserForm.teamId || null,
        status: editUserForm.status,
        roleIds: editUserForm.roleIds,
      };
      if (editUserForm.password && editUserForm.password.trim().length >= 6) {
        payload.password = editUserForm.password.trim();
      }

      const res = await fetch(`/api/admin/users/${editUserModalUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to update user.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'User privileges and profile updated.' });
      setEditUserModalUser(null);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleSelectRole = async (r: RoleItem) => {
    setSelectedRole(r);
    try {
      const res = await fetch(`/api/admin/roles/${r.id}/permissions`);
      const data = await res.json();
      if (data.permissions) {
        const assignedIds = data.permissions.filter((p: any) => p.assigned).map((p: any) => p.id);
        setRolePermissionsState(assignedIds);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    setSavingPermissions(true);
    try {
      const res = await fetch(`/api/admin/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: rolePermissionsState }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to update permissions.' });
        return;
      }
      setActionFeedback({ type: 'success', message: `Permissions updated for role ${selectedRole.name}.` });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingPermissions(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full text-xs font-medium shadow-2xl border animate-slide-up ${actionFeedback.type === 'success'
              ? 'bg-[#10141A] text-white border-[#D8DEEA]/40'
              : 'bg-rose-950 text-rose-100 border-rose-700'
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {actionFeedback.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Main Surface Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">

        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3f5e93] text-[22px]">admin_panel_settings</span>
              <h1 className="text-xl lg:text-2xl font-semibold text-[#10141A] tracking-tight">
                Administration & System Controls
              </h1>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                Governance Suite
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Unified registry for user credentials, organizational taxonomy, dynamic RBAC, retention policies, and service modular features.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSetupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-medium transition shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
            >
              <span className="material-symbols-outlined text-[16px]">domain_add</span>
              <span>Onboard New Organization</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Layout: Left Vertical Settings Rail + Right Active Configuration Stage */}
        <div className="flex flex-col lg:flex-row items-start gap-6 pt-1">
          {/* Left Vertical Settings Rail */}
          <div className="w-full lg:w-60 shrink-0 bg-[#f0f3ff]/70 rounded-[24px] p-3 border border-[#D8DEEA]/70 flex flex-col gap-1.5 self-start sticky top-24 select-none">
            <span className="text-[10px] font-bold tracking-wider text-[#9CA3AF] uppercase px-3 py-1">
              Settings Modules
            </span>
            {[
              { id: 'users', label: 'User Registry', icon: 'manage_accounts', count: users.length },
              { id: 'hierarchy', label: 'Departments & Teams', icon: 'corporate_fare', count: departments.length },
              { id: 'rbac', label: 'Roles & RBAC', icon: 'shield', count: roles.length },
              { id: 'types_tiers', label: 'Taxonomy & Tiers', icon: 'category', count: documentTypes.length },
              { id: 'policies', label: 'Governance Policies', icon: 'policy', count: policies.length },
              { id: 'modules', label: 'Service Modules', icon: 'toggle_on' },
              { id: 'system', label: 'System Telemetry', icon: 'tune' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#000000] text-white shadow-sm font-semibold'
                    : 'text-[#45474b] hover:text-[#10141A] hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] shrink-0 font-semibold ${
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#E9ECF4] text-[#6B7280]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right Active Configuration Panel */}
          <div className="flex-1 min-w-0 w-full space-y-6">
            {/* TAB 1: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Filter users by name, email, code..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setEnrollModalOpen(true)}
                  className="px-4 py-1.5 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-medium rounded-full flex items-center gap-1.5 shadow-xs transition"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  <span>Enroll User</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Roles</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#6B7280]">
                          <span className="material-symbols-outlined text-[24px] animate-spin text-[#3f5e93] block mb-1">sync</span>
                          Loading user directory...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#6B7280]">No users found</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#f0f3ff]/40 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#10141A]">{u.full_name}</div>
                            <div className="text-[11px] text-[#6B7280] font-mono">{u.email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#10141A]">{u.department_name || 'Unassigned'}</div>
                            <div className="text-[10px] text-[#6B7280]">{u.designation || 'Staff'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map((r) => (
                                <span key={r.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA]">
                                  {r.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[11px] text-[#6B7280]">
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="px-3 py-1 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] text-xs font-medium border border-[#D8DEEA] transition"
                            >
                              Edit
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
        )}

        {/* TAB 2: HIERARCHY */}
        {activeTab === 'hierarchy' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">Departmental Structure</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreateDeptModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition shadow-xs"
                >
                  + Add Department
                </button>
                <button
                  onClick={() => setCreateTeamModalOpen(true)}
                  className="px-3.5 py-1.5 bg-white border border-[#D8DEEA] text-[#151c27] rounded-full text-xs font-medium hover:bg-[#f0f3ff] transition"
                >
                  + Add Team
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => {
                const deptTeams = teams.filter((t) => t.department_id === dept.id);
                return (
                  <div key={dept.id} className="p-5 rounded-[20px] bg-white border border-[#D8DEEA]/60 shadow-[0_2px_8px_rgba(16,20,26,0.03)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA]">
                          {dept.code}
                        </span>
                        <h3 className="text-sm font-semibold text-[#10141A]">{dept.name}</h3>
                      </div>
                      <span className="text-[10px] text-[#6B7280]">{dept.member_count} Members</span>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-[#D8DEEA]/40">
                      <div className="text-[10px] font-medium uppercase text-[#6B7280]">Teams ({deptTeams.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {deptTeams.map((t) => (
                          <span key={t.id} className="px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#6B7280] text-[10px] border border-[#D8DEEA]">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: RBAC */}
        {activeTab === 'rbac' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Roles List */}
            <div className="lg:col-span-4 bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
                <span className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">Roles</span>
                <button
                  onClick={() => setCreateRoleModalOpen(true)}
                  className="px-2.5 py-1 bg-[#000000] text-white rounded-full text-[11px] font-medium hover:bg-[#181c22]"
                >
                  + Add Role
                </button>
              </div>

              <div className="space-y-1.5">
                {roles.map((r) => {
                  const isSelected = selectedRole?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelectRole(r)}
                      className={`p-3 rounded-[16px] cursor-pointer transition flex items-center justify-between border ${isSelected
                          ? 'bg-[#f0f3ff] border-[#83A2DB] shadow-xs'
                          : 'bg-white border-[#D8DEEA]/60 hover:bg-[#f0f3ff]/40'
                        }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-[#10141A]">{r.name}</div>
                        <div className="font-mono text-[10px] text-[#6B7280]">{r.code}</div>
                      </div>
                      <span className="font-mono text-[10px] text-[#9CA3AF]">{r.user_count} Users</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="lg:col-span-8 bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
                <div>
                  <div className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">
                    Permissions: {selectedRole?.name || 'Select Role'}
                  </div>
                  <div className="text-[11px] text-[#6B7280]">{selectedRole?.description}</div>
                </div>
                <button
                  onClick={handleSaveRolePermissions}
                  disabled={savingPermissions || !selectedRole}
                  className="px-4 py-1.5 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition shadow-xs disabled:opacity-40"
                >
                  {savingPermissions ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto">
                {permissions.map((p) => {
                  const isChecked = rolePermissionsState.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`p-3 rounded-[16px] border flex items-start gap-2.5 cursor-pointer transition ${isChecked ? 'bg-[#f0f3ff] border-[#83A2DB]/50' : 'bg-white border-[#D8DEEA]/60'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRolePermissionsState([...rolePermissionsState, p.id]);
                          } else {
                            setRolePermissionsState(rolePermissionsState.filter((id) => id !== p.id));
                          }
                        }}
                        className="mt-0.5 w-3.5 h-3.5 text-[#3f5e93] rounded"
                      />
                      <div>
                        <div className="font-semibold text-xs text-[#10141A]">{p.code}</div>
                        <div className="text-[11px] text-[#6B7280]">{p.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TYPES & TIERS */}
        {activeTab === 'types_tiers' && (
          <div className="space-y-6">
            {/* Document Types */}
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
                <span className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">Document Classifications</span>
                <button
                  onClick={() => setCreateDocTypeModalOpen(true)}
                  className="px-3 py-1 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22]"
                >
                  + Add Document Type
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {documentTypes.map((dt) => (
                  <div key={dt.id} className="p-3.5 rounded-[16px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#3f5e93]">{dt.code}</span>
                      <span className="text-[10px] text-[#6B7280]">{dt.document_count} Files</span>
                    </div>
                    <div className="text-xs font-semibold text-[#10141A]">{dt.name}</div>
                    <div className="text-[11px] text-[#6B7280] truncate">{dt.description || 'Standard Document Class'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Tiers */}
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-3">
              <div className="text-xs font-semibold text-[#10141A] uppercase tracking-wider pb-2 border-b border-[#D8DEEA]/60">
                Security Clearance Tiers
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {securityLevels.map((tier) => (
                  <div key={tier.id} className="p-3.5 rounded-[16px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full text-[10px] font-bold px-2 py-0.5 bg-white text-[#10141A] border border-[#D8DEEA]">
                        Level {tier.rank}
                      </span>
                      <span className="text-[10px] text-[#6B7280]">{tier.document_count} Docs</span>
                    </div>
                    <div className="text-xs font-semibold text-[#10141A]">{tier.name}</div>
                    <div className="text-[11px] text-[#6B7280]">{tier.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: POLICIES */}
        {activeTab === 'policies' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">Departmental Governance Matrix</h2>
              <button
                onClick={() => setCreatePolicyModalOpen(true)}
                className="px-3.5 py-1.5 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition shadow-xs"
              >
                + Assign Policy
              </button>
            </div>

            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                    <tr>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-3">Document Class</th>
                      <th className="py-3 px-3">Security Tier</th>
                      <th className="py-3 px-3">Retention Schedule</th>
                      <th className="py-3 px-3">Dual Approval</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                    {policies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#6B7280]">No governance policies assigned</td>
                      </tr>
                    ) : (
                      policies.map((pol) => (
                        <tr key={pol.id} className="hover:bg-[#f0f3ff]/40">
                          <td className="py-3 px-4 font-semibold text-[#10141A]">{pol.department_name}</td>
                          <td className="py-3 px-3 font-medium text-[#3f5e93]">{pol.document_type_name}</td>
                          <td className="py-3 px-3">{pol.security_level_name}</td>
                          <td className="py-3 px-3 text-[#6B7280]">{pol.retention_policy_name || 'Standard Retention'}</td>
                          <td className="py-3 px-3">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pol.approval_required ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                              {pol.approval_required ? 'Required' : 'Standard'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: MODULES */}
        {activeTab === 'modules' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">
                  Organization Feature Calibration
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Configure active modular features for {officeInfo?.name || 'this organization'}.
                </p>
              </div>
              <button
                onClick={handleSaveFeatures}
                disabled={savingFeatures}
                className="px-4 py-2 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
              >
                {savingFeatures ? 'Saving...' : 'Save Feature Calibration'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(MODULE_DESCRIPTIONS) as Array<keyof OrganizationFeatureConfig>).map((key) => {
                const mod = MODULE_DESCRIPTIONS[key];
                const isChecked = officeFeatures[key];
                return (
                  <div
                    key={key}
                    onClick={() => setOfficeFeatures({ ...officeFeatures, [key]: !isChecked })}
                    className={`p-4 rounded-[20px] border transition cursor-pointer flex items-start justify-between gap-3 ${isChecked
                        ? 'bg-[#f0f3ff] border-[#83A2DB]/60'
                        : 'bg-white border-[#D8DEEA]/60 opacity-80'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => { }}
                        className="mt-1 w-4 h-4 text-[#3f5e93] rounded"
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#3f5e93]">{mod.icon}</span>
                          <span className="text-xs font-semibold text-[#10141A]">{mod.label}</span>
                        </div>
                        <p className="text-xs text-[#6B7280]">{mod.description}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full uppercase shrink-0 ${isChecked ? 'bg-[#000000] text-white' : 'bg-[#E9ECF4] text-[#6B7280]'
                      }`}>
                      {isChecked ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 7: SYSTEM */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-[18px] bg-white border border-[#D8DEEA]/60 space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase text-[#6B7280] font-medium">PostgreSQL Database</span>
                <div className="text-base font-semibold text-[#10141A]">dms_db (Active)</div>
                <div className="text-[11px] text-emerald-700">Multi-tenant schema isolated</div>
              </div>
              <div className="p-4 rounded-[18px] bg-white border border-[#D8DEEA]/60 space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase text-[#6B7280] font-medium">KMS Security Node</span>
                <div className="text-base font-semibold text-[#10141A]">AES-256-GCM Hardware Sealed</div>
                <div className="text-[11px] text-[#3f5e93]">FIPS-140-3 Non-Repudiable</div>
              </div>
              <div className="p-4 rounded-[18px] bg-white border border-[#D8DEEA]/60 space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase text-[#6B7280] font-medium">Audit Trail Status</span>
                <div className="text-base font-semibold text-[#10141A]">100% SHA-256 Chained</div>
                <div className="text-[11px] text-emerald-700">Section 65B Attested</div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-3">
              <span className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">
                Recent Administrative Events
              </span>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Event Type</th>
                      <th className="py-2.5 px-3">Result</th>
                      <th className="py-2.5 px-3">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                    {recentAudits.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2.5 px-3 font-mono text-[#6B7280]">{new Date(a.created_at).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-medium text-[#10141A]">{a.actor_name || 'System Admin'}</td>
                        <td className="py-2.5 px-3 font-mono text-[#3f5e93]">{a.event_type}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            {a.result}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#9CA3AF]">{a.ip_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Enroll User Modal */}
      {enrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <h3 className="text-sm font-semibold text-[#10141A]">Enroll Officer Account</h3>
              <button onClick={() => setEnrollModalOpen(false)} className="text-[#6B7280] hover:text-[#10141A]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.fullName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, fullName: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full"
                  />
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.username}
                    onChange={(e) => setEnrollForm({ ...enrollForm, username: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={enrollForm.email}
                    onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full"
                  />
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={enrollForm.password}
                    onChange={(e) => setEnrollForm({ ...enrollForm, password: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#000000] text-white rounded-full text-xs font-medium shadow-xs"
                >
                  Enroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <h3 className="text-sm font-semibold text-[#10141A]">Edit User Account</h3>
              <button onClick={() => setEditUserModalUser(null)} className="text-[#6B7280] hover:text-[#10141A]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editUserForm.fullName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full"
                  />
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setEditUserModalUser(null)}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#000000] text-white rounded-full text-xs font-medium shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Setup Modal */}
      {setupModalOpen && (
        <ServiceSetupModal
          isOpen={setupModalOpen}
          onClose={() => setSetupModalOpen(false)}
          onSuccess={() => {
            loadAllData();
            loadOfficeFeatures();
          }}
        />
      )}
    </div>
  );
}
