'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ServiceSetupModal } from './ServiceSetupModal';
import {
  OrganizationFeatureConfig,
  DEFAULT_FULL_FEATURES,
  MINIMAL_RECEIPTS_FEATURES,
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

  // Hierarchy Expansion State
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

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
  const [editTierModalTier, setEditTierModalTier] = useState<SecurityTierItem | null>(null);

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
  const [tierForm, setTierForm] = useState({
    name: '',
    description: '',
    approvalRequired: false,
    encryptionRequired: true,
    auditLevel: 2,
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
        message: 'Network or authorization error while retrieving institutional registry.',
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
      setActionFeedback({ type: 'success', message: 'Office modules updated! Dashboard features synchronized.' });
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
        const matchRole = u.roles?.some((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
        if (!matchName && !matchEmail && !matchUser && !matchCode && !matchRole) return false;
      }
      return true;
    });
  }, [users, userSearch, userDeptFilter, userStatusFilter]);

  // Teams grouped by department
  const teamsByDept = useMemo(() => {
    const map = new Map<string, TeamItem[]>();
    for (const t of teams) {
      const arr = map.get(t.department_id) || [];
      arr.push(t);
      map.set(t.department_id, arr);
    }
    return map;
  }, [teams]);

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
        setActionFeedback({ type: 'error', message: data.error || 'Failed to enroll officer.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Officer enrolled into institutional registry.' });
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
        setActionFeedback({ type: 'error', message: data.error || 'Failed to update credentials.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Officer privileges and profile updated.' });
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
      console.error('Error fetching role permissions:', err);
    }
  };

  const handleTogglePermission = (permId: string) => {
    if (!selectedRole) return;
    // Check if Super Admin critical permission
    if (selectedRole.code === 'SUPER_ADMIN') {
      const permObj = permissions.find((p) => p.id === permId);
      if (permObj && ['PERMISSION_MANAGE', 'DOCUMENT_VIEW', 'AUDIT_VIEW'].includes(permObj.code)) {
        setActionFeedback({
          type: 'info',
          message: `Institutional safety guard: "${permObj.code}" cannot be revoked from Super Administrator.`,
        });
        return;
      }
    }

    setRolePermissionsState((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
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
      setActionFeedback({ type: 'success', message: `Privileges committed for ${selectedRole.name}.` });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleCreateDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to create division.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Departmental division commissioned.' });
      setCreateDeptModalOpen(false);
      setDeptForm({ name: '', code: '', parentDepartmentId: '' });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to form tactical team.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Tactical investigation squad registered.' });
      setCreateTeamModalOpen(false);
      setTeamForm({ departmentId: '', name: '', code: '' });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to create role.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'New administrative role created.' });
      setCreateRoleModalOpen(false);
      setRoleForm({ name: '', code: '', description: '' });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCreateDocTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/document-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docTypeForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to add classification.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Document classification type established.' });
      setCreateDocTypeModalOpen(false);
      setDocTypeForm({ name: '', code: '', description: '' });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleToggleDocTypeStatus = async (type: DocumentTypeItem) => {
    try {
      const res = await fetch(`/api/admin/document-types/${type.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !type.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error });
        return;
      }
      setActionFeedback({
        type: 'info',
        message: `Classification ${type.code} ${!type.active ? 'Activated' : 'Suspended'}.`,
      });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleEditTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTierModalTier) return;
    try {
      const res = await fetch(`/api/admin/security-levels/${editTierModalTier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tierForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Security clearance tier updated.' });
      setEditTierModalTier(null);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleTogglePolicyFlag = async (
    policyId: string,
    field: 'approval_required' | 'ocr_required' | 'download_allowed' | 'active',
    currentVal: boolean
  ) => {
    try {
      const fieldMap: Record<string, string> = {
        approval_required: 'approvalRequired',
        ocr_required: 'ocrRequired',
        download_allowed: 'downloadAllowed',
        active: 'active',
      };
      const res = await fetch(`/api/admin/policies/${policyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldMap[field]]: !currentVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Departmental policy rule synchronized.' });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCreateScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/retention-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create retention schedule');

      setActionFeedback({ type: 'success', message: `Statutory retention schedule "${scheduleForm.name}" created.` });
      setCreateScheduleModalOpen(false);
      setScheduleForm({
        name: '',
        scheduleCode: '',
        retentionDays: 1095,
        permanent: false,
        deletionRequiresApproval: true,
        actionOnExpiry: 'Maker-Checker Review & Cryptographic Zeroization',
        statutoryFramework: 'Administrative Archives Directives 2026',
        description: '',
      });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteSchedule = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete retention schedule "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/retention-policies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete retention schedule');
      setActionFeedback({ type: 'success', message: `Retention schedule "${name}" deleted.` });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleAssignPolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyAssignForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save department policy');

      setActionFeedback({ type: 'success', message: 'Retention schedule & security policy mapped successfully.' });
      setCreatePolicyModalOpen(false);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  // Grouped permissions for RBAC matrix
  const permissionsByCategory = useMemo(() => {
    const groups: Record<string, PermissionItem[]> = {};
    for (const p of permissions) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [permissions]);

  return (
    <div className="space-y-6">
      {/* Institutional Admin Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-400 text-[28px]">admin_panel_settings</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white">Institutional Administration &amp; Governance</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Centralized sovereign authority console governing user identities, tactical investigation teams, role-based
                capability boundaries, mandatory classification tiers, and tamper-evident configuration controls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadAllData}
              disabled={loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Refresh Institutional State"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
              <span>Sync Ledger</span>
            </button>
            <button
              onClick={() => setEnrollModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Enrol Officer</span>
            </button>
          </div>
        </div>

        {/* Global Action Feedback Alert */}
        {actionFeedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 border ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : actionFeedback.type === 'error'
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                : 'bg-blue-950/60 border-blue-500/40 text-blue-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {actionFeedback.type === 'success' ? 'check_circle' : actionFeedback.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{actionFeedback.message}</span>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            <span>User &amp; Identity Registry</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-900/60 font-mono text-slate-300">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              activeTab === 'hierarchy'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
            <span>Divisions &amp; Tactical Teams</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-900/60 font-mono text-slate-300">
              {departments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rbac')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              activeTab === 'rbac'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">security</span>
            <span>RBAC Matrix &amp; Privileges</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-900/60 font-mono text-slate-300">
              {roles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('types_tiers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              activeTab === 'types_tiers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">policy</span>
            <span>Classifications &amp; Tiers</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-900/60 font-mono text-slate-300">
              {documentTypes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              activeTab === 'policies'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">rule</span>
            <span>Policies &amp; Retention Schedules</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-900/60 font-mono text-slate-300">
              {retentionSchedules.length} Sched &bull; {policies.length} Rules
            </span>
          </button>

          <button
            onClick={() => setActiveTab('modules')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              activeTab === 'modules'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">extension</span>
            <span>Office Modules &amp; Service Features</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-900/60 font-mono text-emerald-400 font-bold">
              ACTIVE
            </span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              activeTab === 'system'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">settings_suggest</span>
            <span>Node Governance &amp; Audits</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USERS & IDENTITY REGISTRY */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Search officers by name, badge ID, username, email, or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Divisions</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE Only</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 shrink-0 font-medium">
              Showing <span className="font-bold text-slate-800">{filteredUsers.length}</span> officers
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Officer &amp; Identifier</th>
                    <th className="py-3 px-4">Division &amp; Squad</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Clearance Roles</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Authentication</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <span className="material-symbols-outlined text-[36px] block mx-auto text-slate-300 mb-2">
                          person_off
                        </span>
                        No institutional officers match the specified query filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.id === currentUserId;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                                {u.full_name?.slice(0, 2).toUpperCase() || 'OFF'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{u.full_name}</span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9px] font-bold rounded">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {u.email} • {u.employee_code || 'ID-PENDING'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">
                              {u.department_name || 'Unassigned'}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">group</span>
                              <span>{u.team_name || 'No tactical team'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {u.designation || 'Special Duty Officer'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                              {u.roles && u.roles.length > 0 ? (
                                u.roles.map((r) => (
                                  <span
                                    key={r.id}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      r.code === 'SUPER_ADMIN'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : r.code === 'ORG_ADMIN'
                                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {r.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No assigned roles</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : u.status === 'SUSPENDED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-600'
                                    : u.status === 'SUSPENDED'
                                    ? 'bg-amber-600'
                                    : 'bg-rose-600'
                                }`}
                              ></span>
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {u.last_login_at
                              ? new Date(u.last_login_at).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'No login record'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded border border-slate-200 transition-colors font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">tune</span>
                              <span>Configure</span>
                            </button>
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
      )}

      {/* TAB 2: AGENCY HIERARCHY & TACTICAL TEAMS */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Institutional Divisions &amp; Tactical Investigation Units</h2>
              <p className="text-xs text-slate-500">
                Departmental divisions under the Central Investigation Bureau with specialized squads and operational forensic labs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateTeamModalOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">group_add</span>
                <span>Form Squad / Team</span>
              </button>
              <button
                onClick={() => setCreateDeptModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">domain_add</span>
                <span>Create Division</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {departments.map((d) => {
              const deptTeams = teamsByDept.get(d.id) || [];
              const isExpanded = expandedDeptId === d.id;

              return (
                <div
                  key={d.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center font-mono font-bold text-blue-700 text-xs shrink-0">
                        {d.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{d.name}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                            CODE: {d.code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {d.parent_department_name ? `Parent: ${d.parent_department_name} • ` : ''}
                          Status: <span className="font-semibold text-emerald-600">ACTIVE</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-slate-600">
                      <div className="text-center">
                        <span className="block font-bold text-slate-900 text-sm">{d.member_count}</span>
                        <span className="text-[11px] text-slate-500">Officers</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-slate-900 text-sm">{deptTeams.length}</span>
                        <span className="text-[11px] text-slate-500">Tactical Squads</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-slate-900 text-sm">{d.policy_count}</span>
                        <span className="text-[11px] text-slate-500">Governed Policies</span>
                      </div>

                      <button
                        onClick={() => setExpandedDeptId(isExpanded ? null : d.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                        <span>{isExpanded ? 'Collapse Squads' : 'View Squads'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Tactical Teams Section */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 border-t border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Tactical Units ({deptTeams.length})
                        </span>
                        <button
                          onClick={() => {
                            setTeamForm((prev) => ({ ...prev, departmentId: d.id }));
                            setCreateTeamModalOpen(true);
                          }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          <span>Add Squad to {d.code}</span>
                        </button>
                      </div>

                      {deptTeams.length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-2">
                          No tactical squads configured for this division yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {deptTeams.map((t) => (
                            <div
                              key={t.id}
                              className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between"
                            >
                              <div>
                                <div className="font-bold text-slate-900 text-xs">{t.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  CODE: {t.code} • {t.member_count} Members
                                </div>
                              </div>
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold font-mono">
                                ACTIVE
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: RBAC MATRIX & PRIVILEGES */}
      {activeTab === 'rbac' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Role Selector */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Security Clearance Roles</h2>
              <button
                onClick={() => setCreateRoleModalOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">add_circle</span>
                <span>Custom Role</span>
              </button>
            </div>

            <div className="space-y-2">
              {roles.map((r) => {
                const isSelected = selectedRole?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRole(r)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs">{r.name}</div>
                      {r.is_system_role ? (
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-slate-800 text-amber-300' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          SYSTEM
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          CUSTOM
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] mt-1 line-clamp-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                      {r.description}
                    </div>
                    <div
                      className={`text-[10px] font-mono mt-2 flex items-center justify-between ${
                        isSelected ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      <span>CODE: {r.code}</span>
                      <span>{r.user_count} Assigned Officers</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Capability Matrix */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            {selectedRole ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{selectedRole.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {selectedRole.code}
                      </span>
                      {selectedRole.code === 'SUPER_ADMIN' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          IMMUTABLE CORE PRIVILEGES
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{selectedRole.description}</p>
                  </div>

                  <button
                    onClick={handleSaveRolePermissions}
                    disabled={savingPermissions}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {savingPermissions ? 'sync' : 'verified_user'}
                    </span>
                    <span>{savingPermissions ? 'Committing...' : 'Commit Privilege Matrix'}</span>
                  </button>
                </div>

                {/* Categorized Permissions */}
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-blue-600">shield</span>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{category}</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {perms.map((p) => {
                          const isAssigned = rolePermissionsState.includes(p.id);
                          const isLocked =
                            selectedRole.code === 'SUPER_ADMIN' &&
                            ['PERMISSION_MANAGE', 'DOCUMENT_VIEW', 'AUDIT_VIEW'].includes(p.code);

                          return (
                            <label
                              key={p.id}
                              className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${
                                isAssigned
                                  ? 'bg-blue-50/50 border-blue-200'
                                  : 'bg-slate-50/40 border-slate-200 hover:bg-slate-50'
                              } ${isLocked ? 'opacity-90' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                disabled={isLocked}
                                onChange={() => handleTogglePermission(p.id)}
                                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-slate-900">{p.code}</span>
                                  {isLocked && (
                                    <span className="material-symbols-outlined text-[14px] text-amber-600" title="Safety locked: Cannot be stripped from Super Admin">
                                      lock
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-slate-400">
                Select a role from the left pane to inspect and calibrate permission matrix.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENT CLASSIFICATIONS & SECURITY TIERS */}
      {activeTab === 'types_tiers' && (
        <div className="space-y-6">
          {/* Section A: Document Classification Types */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Institutional Evidentiary Document Classifications</h2>
                <p className="text-xs text-slate-500">
                  Official docket types recognized across prosecution wings, forensic labs, and investigation registries.
                </p>
              </div>
              <button
                onClick={() => setCreateDocTypeModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">add_box</span>
                <span>Add Classification</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Classification Title</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Active Dockets</th>
                    <th className="py-2.5 px-3 text-center">Governing Divisions</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {documentTypes.map((dt) => (
                    <tr key={dt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-[18px]">description</span>
                        <span>{dt.name}</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{dt.code}</td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs">{dt.description || 'Statutory legal docket'}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">{dt.document_count}</td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {dt.assigned_departments_count} Divisions
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            dt.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {dt.active ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleToggleDocTypeStatus(dt)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                        >
                          {dt.active ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Security Clearance Tiers */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Institutional Security Clearance Tiers (T1 - T5)</h2>
              <p className="text-xs text-slate-500">
                Statutory clearance thresholds governing cryptographic encryption, maker-checker approval mandating, and audit recording depth.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {securityLevels.map((lvl) => (
                <div
                  key={lvl.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:border-blue-300 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold font-mono">
                        RANK {lvl.rank}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900">{lvl.code}</span>
                    </div>
                    <div className="font-bold text-slate-900 text-xs">{lvl.name}</div>
                    <p className="text-[11px] text-slate-500">{lvl.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Encryption:</span>
                      <span className="font-bold font-mono text-emerald-600">
                        {lvl.encryption_required ? 'MANDATORY (AES-256)' : 'OPTIONAL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Approval Flow:</span>
                      <span className="font-bold font-mono text-slate-700">
                        {lvl.approval_required ? 'MAKER-CHECKER' : 'AUTOMATIC'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Audit Level:</span>
                      <span className="font-bold font-mono text-slate-700">Level {lvl.audit_level}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Documents:</span>
                      <span className="font-bold font-mono text-slate-900">{lvl.document_count}</span>
                    </div>

                    <button
                      onClick={() => {
                        setEditTierModalTier(lvl);
                        setTierForm({
                          name: lvl.name,
                          description: lvl.description,
                          approvalRequired: lvl.approval_required,
                          encryptionRequired: lvl.encryption_required,
                          auditLevel: lvl.audit_level,
                        });
                      }}
                      className="w-full mt-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-semibold text-[10px] transition-colors"
                    >
                      Calibrate Tier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DEPARTMENTAL POLICIES & RETENTION SCHEDULES */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          {/* Header Card with Quick Actions */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-blue-600 text-[24px]">history_edu</span>
                <h2 className="text-base font-bold text-slate-900">Retention Schedules &amp; Departmental Policies</h2>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-bold rounded uppercase">
                  Institutional Governance
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Define organization-specific statutory retention lifecycles and map them across divisions and document classifications with Maker-Checker approvals, Deep OCR ingestion, and local download authorization.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setScheduleForm({
                    name: '',
                    scheduleCode: '',
                    retentionDays: 1095,
                    permanent: false,
                    deletionRequiresApproval: true,
                    actionOnExpiry: 'Maker-Checker Review & Cryptographic Zeroization',
                    statutoryFramework: 'General Financial Rules 2017 & Statutory Mandate',
                    description: '',
                  });
                  setCreateScheduleModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
              >
                <span className="material-symbols-outlined text-[16px] text-blue-400">add_chart</span>
                <span>+ Define Retention Schedule</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPolicyAssignForm({
                    departmentId: policyDeptFilter || departments[0]?.id || '',
                    documentTypeId: documentTypes[0]?.id || '',
                    securityLevelId: securityLevels[0]?.id || '',
                    retentionPolicyId: retentionSchedules[0]?.id || '',
                    approvalRequired: false,
                    ocrRequired: true,
                    downloadAllowed: true,
                  });
                  setCreatePolicyModalOpen(true);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
              >
                <span className="material-symbols-outlined text-[16px]">add_link</span>
                <span>+ Map Department Policy</span>
              </button>
            </div>
          </div>

          {/* SECTION 1: STATUTORY RETENTION SCHEDULES REGISTRY */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">timer</span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Organization Statutory Retention Schedules ({retentionSchedules.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Retention rules enforcing immutable preservation and expiry zeroization protocols.
              </span>
            </div>

            {retentionSchedules.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">hourglass_disabled</span>
                <p>No retention schedules defined yet for this institution.</p>
                <button
                  onClick={() => setCreateScheduleModalOpen(true)}
                  className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span> Create Schedule
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <th className="py-3 px-4">Schedule Code &amp; Name</th>
                      <th className="py-3 px-4">Statutory Framework</th>
                      <th className="py-3 px-4">Retention Period</th>
                      <th className="py-3 px-4">Post-Expiry Action</th>
                      <th className="py-3 px-4 text-center">Dual Approval</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {retentionSchedules.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 font-mono text-[10px] rounded text-slate-800 font-bold">
                              {s.schedule_code}
                            </span>
                            <span>{s.name}</span>
                          </div>
                          {s.description && (
                            <p className="text-[11px] text-slate-400 font-normal mt-0.5 max-w-md">{s.description}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                          <span className="font-mono text-slate-800 font-semibold">{s.statutory_framework}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          {s.permanent ? (
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 text-[10px]">
                              🏛️ PERMANENT (Perpetual)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px]">
                              ⏳ {Math.round((s.retention_days || 0) / 365)} Yrs ({s.retention_days} Days)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium">
                            {s.action_on_expiry || 'Maker-Checker Review & Cryptographic Zeroization'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.deletion_requires_approval
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {s.deletion_requires_approval ? '2-OFFICER MANDATE' : 'AUTOMATIC'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(s.id, s.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete Schedule"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 2: DEPARTMENTAL POLICY ENFORCEMENT MATRIX */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">assignment_turned_in</span>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Departmental Policy &amp; Retention Mapping Matrix
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Statutory rules per document classification under each division for approvals, OCR extraction, and retention schedule binding.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-semibold">Filter Division:</span>
                <select
                  value={policyDeptFilter}
                  onChange={(e) => setPolicyDeptFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                >
                  <option value="">All Divisions ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Division</th>
                    <th className="py-3 px-4">Document Classification</th>
                    <th className="py-3 px-4">Default Security Tier</th>
                    <th className="py-3 px-4">Statutory Retention Schedule</th>
                    <th className="py-3 px-4 text-center">Maker-Checker Required</th>
                    <th className="py-3 px-4 text-center">OCR Ingestion</th>
                    <th className="py-3 px-4 text-center">Local Download</th>
                    <th className="py-3 px-4 text-center">Policy Status</th>
                    <th className="py-3 px-4 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {policies
                    .filter((p) => !policyDeptFilter || p.department_id === policyDeptFilter)
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div>{p.department_name}</div>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">{p.department_code}</span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>{p.document_type_name}</div>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">CODE: {p.document_type_code}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                            {p.security_level_code} ({p.security_level_name})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                              {p.retention_schedule_code}
                            </span>
                            <span className="text-slate-700">{p.retention_policy_name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePolicyFlag(p.id, 'approval_required', p.approval_required)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                              p.approval_required
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {p.approval_required ? 'MANDATORY' : 'NONE'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePolicyFlag(p.id, 'ocr_required', p.ocr_required)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                              p.ocr_required
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {p.ocr_required ? 'ENFORCED' : 'BYPASS'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePolicyFlag(p.id, 'download_allowed', p.download_allowed)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                              p.download_allowed
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}
                          >
                            {p.download_allowed ? 'ALLOWED' : 'BLOCKED'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePolicyFlag(p.id, 'active', p.active)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                              p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {p.active ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPolicyAssignForm({
                                departmentId: p.department_id,
                                documentTypeId: p.document_type_id,
                                securityLevelId: p.security_level_id,
                                retentionPolicyId: p.retention_policy_id,
                                approvalRequired: p.approval_required,
                                ocrRequired: p.ocr_required,
                                downloadAllowed: p.download_allowed,
                              });
                              setCreatePolicyModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Reconfigure Policy Mapping"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
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

      {/* TAB: OFFICE MODULES & SERVICE FEATURES (DMS-AS-A-SERVICE) */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-blue-600 text-[24px]">extension</span>
                <h2 className="text-base font-bold text-slate-900">Office Modules &amp; Service Customization</h2>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-bold rounded uppercase">
                  DMS-as-a-Service
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Calibrate which operational features are activated for this government body. Modules that are disabled will be cleanly hidden from navigation and document workflows to prevent clutter.
              </p>
              {officeInfo && (
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                  <span>Current Office: <strong className="text-slate-900">{officeInfo.name}</strong></span>
                  <span>&bull;</span>
                  <span className="font-mono">Code: <strong className="text-blue-700">{officeInfo.code}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSetupModalOpen(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
              >
                <span className="material-symbols-outlined text-[16px] text-blue-400">add_business</span>
                <span>Onboard New Office</span>
              </button>
            </div>
          </div>

          {/* Quick Configuration Presets */}
          <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-700 text-[20px]">tune</span>
              <span className="text-xs font-bold text-blue-950">Quick Module Presets:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setOfficeFeatures({ ...MINIMAL_RECEIPTS_FEATURES });
                  setActionFeedback({ type: 'info', message: 'Applied "Revenue & Payment Receipts Only" preset. Click "Commit & Save" to apply.' });
                }}
                className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-semibold shadow-2xs transition"
              >
                ⚡ Revenue &amp; Payment Receipts Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setOfficeFeatures({
                    feature_approvals: false,
                    feature_section_65b: false,
                    feature_retention_holds: true,
                    feature_blockchain: true,
                    feature_deep_ocr: true,
                  });
                  setActionFeedback({ type: 'info', message: 'Applied "Archives & Public Grievance" preset. Click "Commit & Save" to apply.' });
                }}
                className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-semibold shadow-2xs transition"
              >
                🏛️ Archives &amp; Grievance
              </button>
              <button
                type="button"
                onClick={() => {
                  setOfficeFeatures({ ...DEFAULT_FULL_FEATURES });
                  setActionFeedback({ type: 'info', message: 'Applied "Complete Suite" preset. Click "Commit & Save" to apply.' });
                }}
                className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-semibold shadow-2xs transition"
              >
                🛡️ Complete Suite (All Features)
              </button>
            </div>
          </div>

          {/* Module Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(MODULE_DESCRIPTIONS) as Array<keyof OrganizationFeatureConfig>).map((key) => {
              const mod = MODULE_DESCRIPTIONS[key];
              const isEnabled = officeFeatures[key];

              return (
                <div
                  key={key}
                  className={`p-5 rounded-xl border transition-all flex flex-col justify-between gap-4 ${
                    isEnabled
                      ? 'bg-white border-blue-300 shadow-sm'
                      : 'bg-slate-50/70 border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isEnabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <span className="material-symbols-outlined text-[22px]">{mod.icon}</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900">{mod.label}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded uppercase ${
                            isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {isEnabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{mod.description}</p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => setOfficeFeatures({ ...officeFeatures, [key]: !isEnabled })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isEnabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Recommended for: <strong className="text-slate-600">{mod.recommendedFor}</strong></span>
                    <span className="font-mono text-[10px]">{key}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Action Banner */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="material-symbols-outlined text-amber-500 text-[20px]">info</span>
              <span>Changes to feature modules will dynamically update dashboard tabs immediately.</span>
            </div>

            <button
              type="button"
              onClick={handleSaveFeatures}
              disabled={savingFeatures}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {savingFeatures ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>Saving Modules...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Commit &amp; Save Module Toggles</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: SYSTEM GOVERNANCE & LIVE AUDIT TRAIL */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Institutional Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Enrolled Institutional Users</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{systemMetrics?.totalUsers || users.length}</div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Airgapped Identity Sync</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Total Chained Audit Events</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{systemMetrics?.totalAuditEvents || 0}</div>
              <span className="text-[10px] text-blue-600 font-mono font-semibold mt-0.5 block">SHA-256 Chained</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Secured Investigation Dockets</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{systemMetrics?.activeDocuments || 0}</div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">AES-256 Envelope Encrypted</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Primary Storage Node</span>
              <div className="text-xs font-bold text-slate-900 font-mono mt-1">
                {systemConfig?.node_identity?.value?.nodeId || 'PRIMARY-SECURE-NODE-01'}
              </div>
              <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">
                {systemMetrics?.dbEngine || 'PostgreSQL 18'}
              </span>
            </div>
          </div>

          {/* Node Governance Parameters */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Institutional System Parameters</h2>
              <p className="text-xs text-slate-500">
                System identity, session timeout policies, and cryptographic standards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium text-[11px]">Ledger Hash Algorithm</span>
                <div className="font-mono font-bold text-slate-800">
                  {systemConfig?.security_governance?.value?.quantumAlgorithm || 'SHA-256 Chained Hash Ledger'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium text-[11px]">Maximum Ingestion File Size</span>
                <div className="font-mono font-bold text-slate-800">
                  {systemConfig?.security_governance?.value?.maxUploadSizeMb || 500} MB
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium text-[11px]">Session Inactivity Timeout</span>
                <div className="font-mono font-bold text-slate-800">
                  {systemConfig?.security_governance?.value?.sessionTimeoutMinutes || 480} Minutes (8 Hours)
                </div>
              </div>
            </div>
          </div>

          {/* Live Administrative Audit Trail */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Live Administrative Audit Trail</h2>
                <p className="text-xs text-slate-500">
                  Immutable chronological log of all administrative enrolments, role modifications, and policy recalibrations.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[10px] font-mono font-bold border border-slate-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                LIVE LEDGER CHAIN
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Target Resource</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">SHA-256 Event Hash</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentAudits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No administrative audit events recorded on this node yet.
                      </td>
                    </tr>
                  ) : (
                    recentAudits.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {a.event_type}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          {a.actor_name || 'System Sovereign Node'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {a.resource_type}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              a.result === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {a.result}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {a.event_hash ? `${a.event_hash.slice(0, 16)}...` : 'HASH-PENDING'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500">
                          {new Date(a.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
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

      {/* MODAL 1: ENROL OFFICER */}
      {enrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">person_add</span>
                <h3 className="text-sm font-bold text-slate-900">Enrol Institutional Officer</h3>
              </div>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.fullName}
                    onChange={(e) => setEnrollForm({ ...enrollForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Rajeshwar Sharma"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Username (System User ID) *</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.username}
                    onChange={(e) => setEnrollForm({ ...enrollForm, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., rsharma"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={enrollForm.email}
                    onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., rsharma@agency.gov.in"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Employee / Badge Code</label>
                  <input
                    type="text"
                    value={enrollForm.employeeCode}
                    onChange={(e) => setEnrollForm({ ...enrollForm, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., EMP-9821"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <input
                    type="text"
                    value={enrollForm.designation}
                    onChange={(e) => setEnrollForm({ ...enrollForm, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Senior Forensics Analyst"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={enrollForm.phone}
                    onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., +91 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department Division</label>
                  <select
                    value={enrollForm.departmentId}
                    onChange={(e) => setEnrollForm({ ...enrollForm, departmentId: e.target.value, teamId: '' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Division</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tactical Squad / Lab</label>
                  <select
                    value={enrollForm.teamId}
                    onChange={(e) => setEnrollForm({ ...enrollForm, teamId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    disabled={!enrollForm.departmentId}
                  >
                    <option value="">Select Tactical Squad</option>
                    {(teamsByDept.get(enrollForm.departmentId) || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Temporary Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={enrollForm.password}
                    onChange={(e) => setEnrollForm({ ...enrollForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimum 6 characters with uppercase, digit, and symbol"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Assign Clearance Roles *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {roles.map((r) => (
                    <label
                      key={r.id}
                      className="p-2 rounded border border-slate-200 flex items-center gap-2 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={enrollForm.roleIds.includes(r.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEnrollForm({
                            ...enrollForm,
                            roleIds: checked
                              ? [...enrollForm.roleIds, r.id]
                              : enrollForm.roleIds.filter((id) => id !== r.id),
                          });
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-bold text-slate-800">{r.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{r.code}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Confirm Enrolment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER & PRIVILEGES */}
      {editUserModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">manage_accounts</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Configure Officer Privileges &amp; Profile</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{editUserModalUser.username} ({editUserModalUser.email})</p>
                </div>
              </div>
              <button
                onClick={() => setEditUserModalUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editUserForm.fullName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <input
                    type="text"
                    value={editUserForm.designation}
                    onChange={(e) => setEditUserForm({ ...editUserForm, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={editUserForm.employeeCode}
                    onChange={(e) => setEditUserForm({ ...editUserForm, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department Division</label>
                  <select
                    value={editUserForm.departmentId}
                    onChange={(e) => setEditUserForm({ ...editUserForm, departmentId: e.target.value, teamId: '' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tactical Squad</label>
                  <select
                    value={editUserForm.teamId}
                    onChange={(e) => setEditUserForm({ ...editUserForm, teamId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No tactical team</option>
                    {(teamsByDept.get(editUserForm.departmentId) || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Account Status</label>
                  <select
                    value={editUserForm.status}
                    disabled={editUserModalUser.id === currentUserId}
                    onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-100"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                  {editUserModalUser.id === currentUserId && (
                    <span className="text-[10px] text-amber-600 block mt-0.5">
                      Self-lockout guard: You cannot deactivate your active session.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reset Password (Optional)</label>
                  <input
                    type="password"
                    value={editUserForm.password}
                    onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank to preserve current"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Assigned Clearance Roles</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {roles.map((r) => (
                    <label
                      key={r.id}
                      className="p-2 rounded border border-slate-200 flex items-center gap-2 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={editUserForm.roleIds.includes(r.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditUserForm({
                            ...editUserForm,
                            roleIds: checked
                              ? [...editUserForm.roleIds, r.id]
                              : editUserForm.roleIds.filter((id) => id !== r.id),
                          });
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-bold text-slate-800">{r.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{r.code}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditUserModalUser(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Update Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE DIVISION */}
      {createDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create Department Division</h3>
              <button onClick={() => setCreateDeptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateDeptSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Division Name *</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Financial Intelligence Directorate"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Unique Division Code *</label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., FID"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Parent Division (Optional)</label>
                <select
                  value={deptForm.parentDepartmentId}
                  onChange={(e) => setDeptForm({ ...deptForm, parentDepartmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None (Top-Level Directorate)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateDeptModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Create Division
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: FORM TACTICAL TEAM */}
      {createTeamModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Form Tactical Investigation Squad</h3>
              <button onClick={() => setCreateTeamModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTeamSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Parent Division *</label>
                <select
                  required
                  value={teamForm.departmentId}
                  onChange={(e) => setTeamForm({ ...teamForm, departmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Division</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Squad Name *</label>
                <input
                  type="text"
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Cryptographic Key Extraction Lab"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Squad Code *</label>
                <input
                  type="text"
                  required
                  value={teamForm.code}
                  onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CKE-04"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateTeamModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Register Squad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CREATE CUSTOM ROLE */}
      {createRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Define Custom Security Role</h3>
              <button onClick={() => setCreateRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateRoleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., External Forensic Specialist"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role Identifier Code *</label>
                <input
                  type="text"
                  required
                  value={roleForm.code}
                  onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., FORENSIC_SPECIALIST"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role Description</label>
                <textarea
                  rows={2}
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Responsibilities and access scope..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateRoleModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE DOCUMENT CLASSIFICATION */}
      {createDocTypeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Evidentiary Classification</h3>
              <button onClick={() => setCreateDocTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateDocTypeSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Classification Name *</label>
                <input
                  type="text"
                  required
                  value={docTypeForm.name}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Polygraph Examination Record"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Classification Code *</label>
                <input
                  type="text"
                  required
                  value={docTypeForm.code}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., POLYGRAPH_RECORD"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Statutory Purpose</label>
                <textarea
                  rows={2}
                  value={docTypeForm.description}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Statutory citation or description..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateDocTypeModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Save Classification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: EDIT TIER PARAMETERS */}
      {editTierModalTier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Calibrate Security Tier: {editTierModalTier.code} (Rank {editTierModalTier.rank})
              </h3>
              <button onClick={() => setEditTierModalTier(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleEditTierSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tier Name</label>
                <input
                  type="text"
                  required
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={tierForm.description}
                  onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tierForm.encryptionRequired}
                    onChange={(e) => setTierForm({ ...tierForm, encryptionRequired: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">Mandatory Cryptographic Envelope Encryption</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tierForm.approvalRequired}
                    onChange={(e) => setTierForm({ ...tierForm, approvalRequired: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">Maker-Checker Departmental Approval Mandate</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Audit Depth Level (1 - 3)</label>
                <select
                  value={tierForm.auditLevel}
                  onChange={(e) => setTierForm({ ...tierForm, auditLevel: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>Level 1 (Standard Access Logging)</option>
                  <option value={2}>Level 2 (Chained Cryptographic Hash Ledger)</option>
                  <option value={3}>Level 3 (Forensic Telemetry &amp; Geo-Fingerprinting)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditTierModalTier(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Update Parameters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: DEFINE RETENTION SCHEDULE */}
      {createScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">timer</span>
                <h3 className="text-sm font-bold text-slate-900">Define Statutory Retention Schedule</h3>
              </div>
              <button
                onClick={() => setCreateScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateScheduleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Schedule Name *</label>
                <input
                  type="text"
                  required
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Vendor Contracts &amp; Procurement Records"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Schedule Code *</label>
                  <input
                    type="text"
                    required
                    value={scheduleForm.scheduleCode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., SCH-PROC-10"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Statutory Framework *</label>
                  <input
                    type="text"
                    required
                    value={scheduleForm.statutoryFramework}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, statutoryFramework: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., GFR 2017 &amp; Indian Contract Act"
                  />
                </div>
              </div>

              {/* Retention Type / Duration */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Retention Horizon:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleForm.permanent}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, permanent: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-purple-900 text-xs">Permanent Statutory Archive (Perpetual)</span>
                  </label>
                </div>

                {!scheduleForm.permanent && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-slate-600 shrink-0">Retention Period (Days):</label>
                      <input
                        type="number"
                        min="1"
                        required={!scheduleForm.permanent}
                        value={scheduleForm.retentionDays}
                        onChange={(e) =>
                          setScheduleForm({ ...scheduleForm, retentionDays: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-500 font-medium">Presets:</span>
                      {[
                        { label: '1 Yr (365d)', days: 365 },
                        { label: '3 Yrs (1095d)', days: 1095 },
                        { label: '5 Yrs (1825d)', days: 1825 },
                        { label: '7 Yrs (2555d)', days: 2555 },
                        { label: '10 Yrs (3650d)', days: 3650 },
                        { label: '25 Yrs (9125d)', days: 9125 },
                      ].map((p) => (
                        <button
                          key={p.days}
                          type="button"
                          onClick={() => setScheduleForm({ ...scheduleForm, retentionDays: p.days })}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                            scheduleForm.retentionDays === p.days
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Post-Expiry Disposal Action</label>
                <select
                  value={scheduleForm.actionOnExpiry}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, actionOnExpiry: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Maker-Checker Review & Cryptographic Zeroization">
                    Maker-Checker Review &amp; Cryptographic Zeroization
                  </option>
                  <option value="Secure Cryptographic Erasure & Audit Ledger Archival">
                    Secure Cryptographic Erasure &amp; Audit Ledger Archival
                  </option>
                  <option value="Transfer to National Archives of India (NAI)">
                    Transfer to National Archives of India (NAI)
                  </option>
                  <option value="Permanent Institutional Cold Storage">
                    Permanent Institutional Cold Storage
                  </option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleForm.deletionRequiresApproval}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, deletionRequiresApproval: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Mandatory Dual-Officer (Maker-Checker) Authorization for Deletion
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Regulatory Context / Description</label>
                <textarea
                  rows={2}
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Statutory scope and compliance directives..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateScheduleModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Establish Retention Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 9: MAP DEPARTMENT POLICY & RETENTION SCHEDULE */}
      {createPolicyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">add_link</span>
                <h3 className="text-sm font-bold text-slate-900">Map Department Policy &amp; Retention Schedule</h3>
              </div>
              <button
                onClick={() => setCreatePolicyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAssignPolicySubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Division *</label>
                <select
                  required
                  value={policyAssignForm.departmentId}
                  onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, departmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Division</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Document Classification *</label>
                <select
                  required
                  value={policyAssignForm.documentTypeId}
                  onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, documentTypeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Document Classification</option>
                  {documentTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Default Security Tier *</label>
                  <select
                    required
                    value={policyAssignForm.securityLevelId}
                    onChange={(e) =>
                      setPolicyAssignForm({ ...policyAssignForm, securityLevelId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Security Tier</option>
                    {securityLevels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        {lvl.name} (Rank {lvl.rank})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Statutory Retention Schedule *</label>
                  <select
                    required
                    value={policyAssignForm.retentionPolicyId}
                    onChange={(e) =>
                      setPolicyAssignForm({ ...policyAssignForm, retentionPolicyId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Retention Schedule</option>
                    {retentionSchedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.schedule_code}: {s.name} ({s.permanent ? 'Permanent' : `${Math.round((s.retention_days || 0) / 365)} Yrs`})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Policy Rule Flags */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                <span className="font-bold text-slate-800 block">Workflow &amp; Security Enforcement Rules:</span>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyAssignForm.approvalRequired}
                    onChange={(e) =>
                      setPolicyAssignForm({ ...policyAssignForm, approvalRequired: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Mandatory Maker-Checker Departmental Approval
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyAssignForm.ocrRequired}
                    onChange={(e) =>
                      setPolicyAssignForm({ ...policyAssignForm, ocrRequired: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Enforce Automated Deep OCR Text Extraction
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyAssignForm.downloadAllowed}
                    onChange={(e) =>
                      setPolicyAssignForm({ ...policyAssignForm, downloadAllowed: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Authorize Local Document Export &amp; Download
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreatePolicyModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm"
                >
                  Save &amp; Enforce Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SERVICE SETUP & PROVISIONING WIZARD MODAL */}
      <ServiceSetupModal
        isOpen={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        onSuccess={() => {
          loadAllData();
          loadOfficeFeatures();
          setActionFeedback({
            type: 'success',
            message: 'New office instance provisioned successfully!',
          });
        }}
      />
    </div>
  );
}
