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

  // Policy Selected Department & Search
  const [policySubTab, setPolicySubTab] = useState<'routing' | 'schedules'>('routing');
  const [policyDeptFilter, setPolicyDeptFilter] = useState<string>('ALL');
  const [policySearch, setPolicySearch] = useState<string>('');
  const [scheduleSearch, setScheduleSearch] = useState<string>('');
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

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

  const [editingDocTypeId, setEditingDocTypeId] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', parentDepartmentId: '' });
  const [teamForm, setTeamForm] = useState({ departmentId: '', name: '', code: '' });
  const [roleForm, setRoleForm] = useState({ name: '', code: '', description: '' });
  const [docTypeForm, setDocTypeForm] = useState({ name: '', code: '', description: '', active: true });
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

  // --- GOVERNANCE POLICY HANDLERS ---
  const handleOpenCreatePolicy = () => {
    setEditingPolicyId(null);
    setPolicyAssignForm({
      departmentId: departments[0]?.id || '',
      documentTypeId: documentTypes[0]?.id || '',
      securityLevelId: securityLevels[0]?.id || '',
      retentionPolicyId: retentionSchedules[0]?.id || '',
      approvalRequired: false,
      ocrRequired: true,
      downloadAllowed: true,
    });
    setCreatePolicyModalOpen(true);
  };

  const handleOpenEditPolicy = (pol: DepartmentPolicyItem) => {
    setEditingPolicyId(pol.id);
    setPolicyAssignForm({
      departmentId: pol.department_id,
      documentTypeId: pol.document_type_id,
      securityLevelId: pol.security_level_id,
      retentionPolicyId: pol.retention_policy_id,
      approvalRequired: pol.approval_required,
      ocrRequired: pol.ocr_required !== false,
      downloadAllowed: pol.download_allowed !== false,
    });
    setCreatePolicyModalOpen(true);
  };

  const handleSavePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyAssignForm.departmentId || !policyAssignForm.documentTypeId || !policyAssignForm.securityLevelId || !policyAssignForm.retentionPolicyId) {
      setActionFeedback({ type: 'error', message: 'Please select Department, Document Type, Security Tier, and Retention Schedule.' });
      return;
    }

    try {
      const res = await fetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...policyAssignForm,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to save governance policy.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Institutional governance policy configured and operational.' });
      setCreatePolicyModalOpen(false);
      setEditingPolicyId(null);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error saving policy' });
    }
  };

  const handleTogglePolicyStatus = async (pol: DepartmentPolicyItem) => {
    try {
      const res = await fetch(`/api/admin/policies/${pol.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !pol.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to update policy status.' });
        return;
      }
      setActionFeedback({ type: 'success', message: `Policy ${pol.active ? 'deactivated' : 'activated'} successfully.` });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeletePolicy = async (pol: DepartmentPolicyItem) => {
    if (!confirm(`Are you sure you want to delete the governance policy for "${pol.department_name} — ${pol.document_type_name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/policies/${pol.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to delete policy.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Governance policy deleted successfully.' });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  // --- STATUTORY RETENTION SCHEDULE HANDLERS ---
  const handleOpenCreateSchedule = () => {
    setEditingScheduleId(null);
    setScheduleForm({
      name: '',
      scheduleCode: '',
      retentionDays: 1095,
      permanent: false,
      deletionRequiresApproval: true,
      actionOnExpiry: 'Maker-Checker Review & Cryptographic Zeroization',
      statutoryFramework: 'Public Records & Archives Directives 2026',
      description: '',
    });
    setCreateScheduleModalOpen(true);
  };

  const handleOpenEditSchedule = (sch: RetentionScheduleItem) => {
    setEditingScheduleId(sch.id);
    setScheduleForm({
      name: sch.name,
      scheduleCode: sch.schedule_code,
      retentionDays: sch.permanent ? 1095 : (sch.retention_days || 365),
      permanent: !!sch.permanent,
      deletionRequiresApproval: sch.deletion_requires_approval !== false,
      actionOnExpiry: sch.action_on_expiry || 'Maker-Checker Review & Cryptographic Zeroization',
      statutoryFramework: sch.statutory_framework || 'Public Records & Archives Directives 2026',
      description: sch.description || '',
    });
    setCreateScheduleModalOpen(true);
  };

  const handleSaveScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.name.trim() || !scheduleForm.scheduleCode.trim()) {
      setActionFeedback({ type: 'error', message: 'Schedule Name and Code are required.' });
      return;
    }
    try {
      const url = editingScheduleId
        ? `/api/admin/retention-policies/${editingScheduleId}`
        : '/api/admin/retention-policies';
      const method = editingScheduleId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scheduleForm.name.trim(),
          scheduleCode: scheduleForm.scheduleCode.trim(),
          retentionDays: scheduleForm.permanent ? null : Number(scheduleForm.retentionDays),
          permanent: scheduleForm.permanent,
          deletionRequiresApproval: scheduleForm.deletionRequiresApproval,
          actionOnExpiry: scheduleForm.actionOnExpiry,
          statutoryFramework: scheduleForm.statutoryFramework,
          description: scheduleForm.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to save retention schedule.' });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: editingScheduleId
          ? `Schedule "${scheduleForm.name}" updated successfully.`
          : `Schedule "${scheduleForm.name}" created successfully.`,
      });
      setCreateScheduleModalOpen(false);
      setEditingScheduleId(null);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error saving schedule' });
    }
  };

  const handleDeleteSchedule = async (sch: RetentionScheduleItem) => {
    if (Number(sch.document_count) > 0) {
      alert(`Cannot delete "${sch.name}". There are ${sch.document_count} active documents governed by this statutory schedule.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete the statutory retention schedule "${sch.name}" (${sch.schedule_code})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/retention-policies/${sch.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to delete retention schedule.' });
        return;
      }
      setActionFeedback({ type: 'success', message: 'Retention schedule deleted successfully.' });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error deleting schedule' });
    }
  };

  // --- DOCUMENT CLASSIFICATION TYPE HANDLERS ---
  const handleOpenCreateDocType = () => {
    setEditingDocTypeId(null);
    setDocTypeForm({ name: '', code: '', description: '', active: true });
    setCreateDocTypeModalOpen(true);
  };

  const handleOpenEditDocType = (dt: DocumentTypeItem) => {
    setEditingDocTypeId(dt.id);
    setDocTypeForm({
      name: dt.name,
      code: dt.code,
      description: dt.description || '',
      active: dt.active !== false,
    });
    setCreateDocTypeModalOpen(true);
  };

  const handleSaveDocTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTypeForm.name.trim() || !docTypeForm.code.trim()) {
      setActionFeedback({ type: 'error', message: 'Document classification name and unique code are required.' });
      return;
    }
    try {
      const url = editingDocTypeId
        ? `/api/admin/document-types/${editingDocTypeId}`
        : '/api/admin/document-types';
      const method = editingDocTypeId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: docTypeForm.name.trim(),
          code: docTypeForm.code.trim().toUpperCase(),
          description: docTypeForm.description.trim() || null,
          active: docTypeForm.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to save document type.' });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: editingDocTypeId
          ? `Document classification "${docTypeForm.name}" updated successfully.`
          : `Document classification "${docTypeForm.name}" created successfully.`,
      });
      setCreateDocTypeModalOpen(false);
      setEditingDocTypeId(null);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error saving document type' });
    }
  };

  const handleDeleteDocType = async (dt: DocumentTypeItem) => {
    if (Number(dt.document_count) > 0) {
      alert(`Cannot delete "${dt.name}". There are ${dt.document_count} active documents classified under this type.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete the document classification "${dt.name}" (${dt.code})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/document-types/${dt.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to delete document type.' });
        return;
      }
      setActionFeedback({ type: 'success', message: `Document classification "${dt.name}" deleted successfully.` });
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error deleting document type' });
    }
  };

  // --- DEPARTMENT & TEAM HANDLERS ---
  const handleOpenCreateDept = () => {
    setEditingDeptId(null);
    setDeptForm({ name: '', code: '', parentDepartmentId: '' });
    setCreateDeptModalOpen(true);
  };

  const handleSaveDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name.trim() || !deptForm.code.trim()) {
      setActionFeedback({ type: 'error', message: 'Department name and code are required.' });
      return;
    }
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deptForm.name.trim(),
          code: deptForm.code.trim().toUpperCase(),
          parentDepartmentId: deptForm.parentDepartmentId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to create department.' });
        return;
      }
      setActionFeedback({ type: 'success', message: `Department "${deptForm.name}" created successfully.` });
      setCreateDeptModalOpen(false);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error saving department' });
    }
  };

  const handleOpenCreateTeam = () => {
    setTeamForm({ departmentId: departments[0]?.id || '', name: '', code: '' });
    setCreateTeamModalOpen(true);
  };

  const handleSaveTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim() || !teamForm.code.trim() || !teamForm.departmentId) {
      setActionFeedback({ type: 'error', message: 'Department, team name, and code are required.' });
      return;
    }
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: teamForm.departmentId,
          name: teamForm.name.trim(),
          code: teamForm.code.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to create team.' });
        return;
      }
      setActionFeedback({ type: 'success', message: `Team "${teamForm.name}" created successfully.` });
      setCreateTeamModalOpen(false);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error saving team' });
    }
  };

  // --- ROLE HANDLERS ---
  const handleOpenCreateRole = () => {
    setRoleForm({ name: '', code: '', description: '' });
    setCreateRoleModalOpen(true);
  };

  const handleSaveRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim() || !roleForm.code.trim()) {
      setActionFeedback({ type: 'error', message: 'Role name and unique code are required.' });
      return;
    }
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleForm.name.trim(),
          code: roleForm.code.trim().toUpperCase(),
          description: roleForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: 'error', message: data.error || 'Failed to create role.' });
        return;
      }
      setActionFeedback({ type: 'success', message: `Role "${roleForm.name}" created successfully.` });
      setCreateRoleModalOpen(false);
      loadAllData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Error saving role' });
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
              Unified registry for user credentials, document types & security tiers, dynamic RBAC, retention policies, and service modular features.
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
              { id: 'types_tiers', label: 'Doc Types & Tiers', icon: 'category', count: documentTypes.length },
              { id: 'policies', label: 'Governance Policies', icon: 'policy', count: policies.length + retentionSchedules.length },
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
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {u.roles.map((r) => (
                                <span key={r.id} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA] whitespace-nowrap leading-tight shadow-2xs">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {permissions.map((p) => {
                  const isChecked = rolePermissionsState.includes(p.id);
                  const isBlockchain = p.code.startsWith('BLOCKCHAIN');
                  return (
                    <label
                      key={p.id}
                      className={`p-3 rounded-[16px] border flex items-start gap-2.5 cursor-pointer transition ${
                        isChecked
                          ? isBlockchain
                            ? 'bg-cyan-500/10 border-cyan-400/50 shadow-xs'
                            : 'bg-[#f0f3ff] border-[#83A2DB]/50 shadow-xs'
                          : 'bg-white border-[#D8DEEA]/60 hover:bg-[#f0f3ff]/40'
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-[#10141A] font-mono">{p.code}</span>
                          {p.category && (
                            <span
                              className={`text-[9px] font-semibold px-2 py-0.2 rounded-full ${
                                isBlockchain
                                  ? 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-bold'
                                  : 'bg-[#f0f3ff] text-[#45474b] border border-[#D8DEEA]'
                              }`}
                            >
                              {p.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#6B7280] mt-0.5">{p.description}</div>
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
              <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60 flex-wrap gap-2">
                <div>
                  <span className="text-xs font-semibold text-[#10141A] uppercase tracking-wider">Document Classifications</span>
                  <p className="text-[11px] text-[#6B7280]">Official record categories recognized across all departments and workflows.</p>
                </div>
                <button
                  onClick={handleOpenCreateDocType}
                  className="px-3.5 py-1.5 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>+ Add Document Type</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {documentTypes.map((dt) => (
                  <div key={dt.id} className="p-4 rounded-[18px] bg-[#f0f3ff]/50 border border-[#D8DEEA]/70 space-y-2 hover:bg-[#f0f3ff] transition flex flex-col justify-between group">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white text-[#3f5e93] border border-[#83A2DB]/30">{dt.code}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#6B7280] font-medium mr-1">{dt.document_count || 0} Files</span>
                          <button
                            onClick={() => handleOpenEditDocType(dt)}
                            className="p-1 rounded-md text-[#6B7280] hover:text-[#10141A] hover:bg-white transition cursor-pointer"
                            title="Edit Document Type"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDocType(dt)}
                            className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Document Type"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-[#10141A]">{dt.name}</div>
                      <div className="text-[11px] text-[#6B7280] line-clamp-2">{dt.description || 'Standard Document Class'}</div>
                    </div>
                    <div className="pt-2 border-t border-[#D8DEEA]/40 flex items-center justify-between text-[10px] text-[#6B7280]">
                      <span>Status: <strong className={dt.active !== false ? 'text-emerald-700' : 'text-slate-500'}>{dt.active !== false ? 'ACTIVE' : 'INACTIVE'}</strong></span>
                      {dt.assigned_departments_count !== undefined && (
                        <span>{dt.assigned_departments_count} Dept Rules</span>
                      )}
                    </div>
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
        )}        {/* TAB 5: POLICIES */}
        {activeTab === 'policies' && (
          <div className="space-y-4">
            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 border-b border-[#D8DEEA]/60 pb-3">
              <button
                onClick={() => setPolicySubTab('routing')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                  policySubTab === 'routing'
                    ? 'bg-[#000000] text-white shadow-xs'
                    : 'bg-white text-[#45474b] border border-[#D8DEEA] hover:bg-[#f0f3ff]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">alt_route</span>
                <span>Department Routing Rules</span>
                <span className={`px-2 py-0.2 text-[10px] rounded-full font-mono font-bold ${policySubTab === 'routing' ? 'bg-white/25 text-white' : 'bg-[#E9ECF4] text-[#6B7280]'}`}>
                  {policies.length}
                </span>
              </button>

              <button
                onClick={() => setPolicySubTab('schedules')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                  policySubTab === 'schedules'
                    ? 'bg-[#000000] text-white shadow-xs'
                    : 'bg-white text-[#45474b] border border-[#D8DEEA] hover:bg-[#f0f3ff]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                <span>Statutory Retention Schedules</span>
                <span className={`px-2 py-0.2 text-[10px] rounded-full font-mono font-bold ${policySubTab === 'schedules' ? 'bg-white/25 text-white' : 'bg-[#E9ECF4] text-[#6B7280]'}`}>
                  {retentionSchedules.length}
                </span>
              </button>
            </div>

            {/* Sub-tab 1: Department Routing Rules */}
            {policySubTab === 'routing' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-1 max-w-xl">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
                      <input
                        type="text"
                        placeholder="Search policies by department, document type..."
                        value={policySearch}
                        onChange={(e) => setPolicySearch(e.target.value)}
                        className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                      />
                    </div>

                    <select
                      value={policyDeptFilter}
                      onChange={(e) => setPolicyDeptFilter(e.target.value)}
                      className="h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#6B7280] font-mono">
                      {policies.filter((p) => p.active).length} Active Rules
                    </span>
                    <button
                      onClick={handleOpenCreatePolicy}
                      className="px-4 py-1.5 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_moderator</span>
                      <span>Assign Policy</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                        <tr>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-3">Document Class</th>
                          <th className="py-3 px-3">Security Clearance</th>
                          <th className="py-3 px-3">Retention Schedule</th>
                          <th className="py-3 px-3">Enforcement Flags</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                        {policies
                          .filter((pol) => {
                            if (policyDeptFilter !== 'ALL' && pol.department_id !== policyDeptFilter) return false;
                            if (policySearch.trim()) {
                              const q = policySearch.toLowerCase();
                              return (
                                pol.department_name?.toLowerCase().includes(q) ||
                                pol.document_type_name?.toLowerCase().includes(q) ||
                                pol.security_level_name?.toLowerCase().includes(q) ||
                                pol.retention_policy_name?.toLowerCase().includes(q)
                              );
                            }
                            return true;
                          })
                          .length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-[#6B7280]">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-[28px] text-[#9CA3AF]">policy</span>
                                <span className="font-medium text-xs text-[#10141A]">No governance policies found</span>
                                <span className="text-[11px] text-[#9CA3AF]">Click &quot;Assign Policy&quot; to define a new department rule.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          policies
                            .filter((pol) => {
                              if (policyDeptFilter !== 'ALL' && pol.department_id !== policyDeptFilter) return false;
                              if (policySearch.trim()) {
                                const q = policySearch.toLowerCase();
                                return (
                                  pol.department_name?.toLowerCase().includes(q) ||
                                  pol.document_type_name?.toLowerCase().includes(q) ||
                                  pol.security_level_name?.toLowerCase().includes(q) ||
                                  pol.retention_policy_name?.toLowerCase().includes(q)
                                );
                              }
                              return true;
                            })
                            .map((pol) => (
                              <tr key={pol.id} className="hover:bg-[#f0f3ff]/40 transition">
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-[#10141A]">{pol.department_name}</div>
                                  <span className="text-[10px] font-mono text-[#9CA3AF]">{pol.department_code}</span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-medium text-[#3f5e93]">{pol.document_type_name}</div>
                                  <span className="text-[10px] font-mono text-[#9CA3AF]">{pol.document_type_code}</span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center gap-1 font-medium text-xs text-[#10141A]">
                                    <span className="px-1.5 py-0.2 rounded-md bg-[#f0f3ff] text-[#3f5e93] border border-[#83A2DB]/30 font-mono text-[10px] font-bold">
                                      L{pol.security_level_rank}
                                    </span>
                                    <span>{pol.security_level_name}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-medium text-[#10141A]">{pol.retention_policy_name || 'Standard Statutory'}</div>
                                  {pol.retention_schedule_code && (
                                    <span className="text-[10px] font-mono text-[#6B7280]">{pol.retention_schedule_code}</span>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        pol.approval_required
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                                          : 'bg-[#f0f3ff] text-[#6B7280]'
                                      }`}
                                      title={pol.approval_required ? 'Dual Maker-Checker sign-off required' : 'Standard single officer workflow'}
                                    >
                                      {pol.approval_required ? 'Dual Approval' : 'Single Sign'}
                                    </span>
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        pol.ocr_required !== false
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {pol.ocr_required !== false ? 'OCR On' : 'OCR Off'}
                                    </span>
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        pol.download_allowed !== false
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-rose-50 text-rose-700 font-semibold'
                                      }`}
                                    >
                                      {pol.download_allowed !== false ? 'Export OK' : 'View Only'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <button
                                    onClick={() => handleTogglePolicyStatus(pol)}
                                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                                      pol.active
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200'
                                    }`}
                                  >
                                    {pol.active ? 'ACTIVE' : 'INACTIVE'}
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditPolicy(pol)}
                                      className="p-1 rounded-lg text-[#6B7280] hover:text-[#10141A] hover:bg-[#f0f3ff] transition cursor-pointer"
                                      title="Edit Policy"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeletePolicy(pol)}
                                      className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                      title="Delete Policy"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                  </div>
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

            {/* Sub-tab 2: Statutory Retention Schedules */}
            {policySubTab === 'schedules' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
                    <input
                      type="text"
                      placeholder="Search retention schedules, legislation, codes..."
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#6B7280] font-mono">
                      {retentionSchedules.length} Statutory Schedules
                    </span>
                    <button
                      onClick={handleOpenCreateSchedule}
                      className="px-4 py-1.5 bg-[#000000] text-white rounded-full text-xs font-medium hover:bg-[#181c22] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      <span>+ New Retention Schedule</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                        <tr>
                          <th className="py-3 px-4">Schedule Code</th>
                          <th className="py-3 px-3">Schedule Name & Framework</th>
                          <th className="py-3 px-3">Statutory Duration</th>
                          <th className="py-3 px-3">Disposal Action</th>
                          <th className="py-3 px-3">Linked Records</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                        {retentionSchedules
                          .filter((sch) => {
                            if (scheduleSearch.trim()) {
                              const q = scheduleSearch.toLowerCase();
                              return (
                                sch.name?.toLowerCase().includes(q) ||
                                sch.schedule_code?.toLowerCase().includes(q) ||
                                sch.statutory_framework?.toLowerCase().includes(q) ||
                                sch.action_on_expiry?.toLowerCase().includes(q)
                              );
                            }
                            return true;
                          })
                          .length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-[#6B7280]">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-[28px] text-[#9CA3AF]">hourglass_disabled</span>
                                <span className="font-medium text-xs text-[#10141A]">No statutory schedules found</span>
                                <span className="text-[11px] text-[#9CA3AF]">Click &quot;+ New Retention Schedule&quot; to configure a statutory archival policy.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          retentionSchedules
                            .filter((sch) => {
                              if (scheduleSearch.trim()) {
                                const q = scheduleSearch.toLowerCase();
                                return (
                                  sch.name?.toLowerCase().includes(q) ||
                                  sch.schedule_code?.toLowerCase().includes(q) ||
                                  sch.statutory_framework?.toLowerCase().includes(q) ||
                                  sch.action_on_expiry?.toLowerCase().includes(q)
                                );
                              }
                              return true;
                            })
                            .map((sch) => (
                              <tr key={sch.id} className="hover:bg-[#f0f3ff]/40 transition">
                                <td className="py-3 px-4 font-mono font-bold text-xs text-[#3f5e93]">
                                  <span className="px-2 py-0.5 rounded-md bg-[#f0f3ff] border border-[#83A2DB]/40">
                                    {sch.schedule_code}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-semibold text-[#10141A]">{sch.name}</div>
                                  <div className="text-[11px] text-[#6B7280]">{sch.statutory_framework}</div>
                                  {sch.description && (
                                    <div className="text-[10px] text-[#9CA3AF] line-clamp-1 mt-0.5">{sch.description}</div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  {sch.permanent ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
                                      <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                                      Permanent
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#10141A]">
                                      <span className="material-symbols-outlined text-[14px] text-[#3f5e93]">timelapse</span>
                                      <span>
                                        {sch.retention_days ? `${Math.round(sch.retention_days / 365 * 10) / 10} yrs (${sch.retention_days.toLocaleString()} d)` : 'Standard'}
                                      </span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-medium text-xs text-[#10141A]">{sch.action_on_expiry || 'Maker-Checker Review'}</div>
                                  <div className="text-[10px] text-[#6B7280]">
                                    {sch.deletion_requires_approval !== false ? 'Dual Sign-off Required' : 'Auto Execution'}
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#3f5e93] font-mono text-[11px] font-semibold border border-[#83A2DB]/30" title="Documents linked">
                                      {sch.document_count || 0} Docs
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[11px]" title="Department rules mapped">
                                      {sch.assigned_policies_count || 0} Rules
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditSchedule(sch)}
                                      className="p-1 rounded-lg text-[#6B7280] hover:text-[#10141A] hover:bg-[#f0f3ff] transition cursor-pointer"
                                      title="Edit Schedule"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSchedule(sch)}
                                      className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                      title="Delete Schedule"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                  </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-[18px] bg-white border border-[#D8DEEA]/60 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#6B7280] font-medium">PostgreSQL Database</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-base font-semibold text-[#10141A]">{systemMetrics?.dbEngine || 'PostgreSQL 18 (Active)'}</div>
                <div className="text-[11px] text-emerald-700">Multi-tenant schema isolated</div>
              </div>
              <div className="p-4 rounded-[18px] bg-white border border-[#D8DEEA]/60 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#6B7280] font-medium">KMS Security Node</span>
                  <span className={`w-2 h-2 rounded-full ${systemMetrics?.vaultKmsOk !== false ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                </div>
                <div className="text-base font-semibold text-[#10141A]">{systemMetrics?.vaultKmsStatus || 'AES-256-GCM Transit Engine'}</div>
                <div className="text-[11px] text-[#3f5e93]">Envelope Encryption Active</div>
              </div>
              <div className="p-4 rounded-[18px] bg-white border border-[#D8DEEA]/60 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#6B7280] font-medium">Redis Queue Engine</span>
                  <span className={`w-2 h-2 rounded-full ${systemMetrics?.redisOk !== false ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                </div>
                <div className="text-base font-semibold text-[#10141A]">{systemMetrics?.redisStatus || 'Redis 7 (Connected)'}</div>
                <div className="text-[11px] text-emerald-700">Task Queues Operational</div>
              </div>
              <div className="p-4 rounded-[18px] bg-white border border-[#D8DEEA]/60 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#6B7280] font-medium">Audit Ledger</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-base font-semibold text-[#10141A]">{systemMetrics?.totalAuditEvents ? `${systemMetrics.totalAuditEvents} Chained Events` : '100% SHA-256 Chained'}</div>
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

      {/* Assign / Edit Governance Policy Modal */}
      {createPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-xl w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">policy</span>
                <h3 className="text-sm font-semibold text-[#10141A]">
                  {editingPolicyId ? 'Edit Governance Policy' : 'Assign Departmental Governance Policy'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setCreatePolicyModalOpen(false);
                  setEditingPolicyId(null);
                }}
                className="text-[#6B7280] hover:text-[#10141A]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePolicySubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#10141A] font-semibold mb-1">
                    Department *
                  </label>
                  <select
                    disabled={!!editingPolicyId}
                    required
                    value={policyAssignForm.departmentId}
                    onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, departmentId: e.target.value })}
                    className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#10141A] font-semibold mb-1">
                    Document Classification *
                  </label>
                  <select
                    disabled={!!editingPolicyId}
                    required
                    value={policyAssignForm.documentTypeId}
                    onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, documentTypeId: e.target.value })}
                    className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                  >
                    <option value="" disabled>Select Document Classification</option>
                    {documentTypes.map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.name} ({dt.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#10141A] font-semibold mb-1">
                    Mandated Security Tier *
                  </label>
                  <select
                    required
                    value={policyAssignForm.securityLevelId}
                    onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, securityLevelId: e.target.value })}
                    className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                  >
                    <option value="" disabled>Select Security Tier</option>
                    {securityLevels.map((sl) => (
                      <option key={sl.id} value={sl.id}>
                        Level {sl.rank} — {sl.name} ({sl.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#10141A] font-semibold mb-1">
                    Retention Schedule *
                  </label>
                  <select
                    required
                    value={policyAssignForm.retentionPolicyId}
                    onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, retentionPolicyId: e.target.value })}
                    className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                  >
                    <option value="" disabled>Select Statutory Retention</option>
                    {retentionSchedules.map((rp) => (
                      <option key={rp.id} value={rp.id}>
                        {rp.name} ({rp.permanent ? 'Permanent' : `${rp.retention_days} Days`})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-[#f0f3ff]/70 rounded-[20px] p-4 border border-[#D8DEEA]/70 space-y-3">
                <span className="text-[10px] font-bold tracking-wider text-[#6B7280] uppercase">
                  Automated Enforcement & Governance Rules
                </span>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={policyAssignForm.approvalRequired}
                    onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, approvalRequired: e.target.checked })}
                    className="w-4 h-4 text-[#3f5e93] rounded"
                  />
                  <div>
                    <span className="font-semibold text-[#10141A] text-xs">Dual Approval (Maker-Checker Workflow)</span>
                    <p className="text-[11px] text-[#6B7280]">
                      Requires a Section Head or Department Approver to review & sign off before the record is officially released.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={policyAssignForm.ocrRequired}
                    onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, ocrRequired: e.target.checked })}
                    className="w-4 h-4 text-[#3f5e93] rounded"
                  />
                  <div>
                    <span className="font-semibold text-[#10141A] text-xs">Mandatory OCR Text Indexing</span>
                    <p className="text-[11px] text-[#6B7280]">
                      Extracts and indexes full-text search vector for uploaded documents of this classification.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={policyAssignForm.downloadAllowed}
                    onChange={(e) => setPolicyAssignForm({ ...policyAssignForm, downloadAllowed: e.target.checked })}
                    className="w-4 h-4 text-[#3f5e93] rounded"
                  />
                  <div>
                    <span className="font-semibold text-[#10141A] text-xs">Allow Offline Export & Download</span>
                    <p className="text-[11px] text-[#6B7280]">
                      When unchecked, officers can only view documents in the in-app secure viewer without saving locally.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => {
                    setCreatePolicyModalOpen(false);
                    setEditingPolicyId(null);
                  }}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#000000] hover:bg-[#181c22] text-white rounded-full text-xs font-medium shadow-xs transition"
                >
                  {editingPolicyId ? 'Update Policy' : 'Save & Enforce Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Statutory Retention Schedule Modal */}
      {createScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">schedule</span>
                <h3 className="text-sm font-semibold text-[#10141A]">
                  {editingScheduleId ? 'Edit Statutory Retention Schedule' : 'Create Statutory Retention Schedule'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setCreateScheduleModalOpen(false);
                  setEditingScheduleId(null);
                }}
                className="text-[#6B7280] hover:text-[#10141A] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveScheduleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-semibold mb-1">Schedule Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SCHEDULE_VI"
                    value={scheduleForm.scheduleCode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleCode: e.target.value.toUpperCase() })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                  />
                </div>
                <div>
                  <label className="block text-[#10141A] font-semibold mb-1">Schedule Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Financial & Tax Audits"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Statutory Framework / Legislation</label>
                <input
                  type="text"
                  placeholder="e.g. Public Records Act 1993 / Income Tax Act"
                  value={scheduleForm.statutoryFramework}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, statutoryFramework: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="bg-[#f0f3ff]/70 p-3.5 rounded-[18px] border border-[#D8DEEA]/60 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleForm.permanent}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, permanent: e.target.checked })}
                    className="w-4 h-4 text-[#3f5e93] rounded"
                  />
                  <div>
                    <span className="font-semibold text-[#10141A]">Permanent Archival Retention</span>
                    <p className="text-[11px] text-[#6B7280]">Records under this schedule will never expire or be purged.</p>
                  </div>
                </label>

                {!scheduleForm.permanent && (
                  <div className="pt-2 border-t border-[#D8DEEA]/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[#10141A] font-semibold">Retention Duration (Days)</label>
                      <div className="flex gap-1">
                        {[
                          { label: '1y', days: 365 },
                          { label: '3y', days: 1095 },
                          { label: '5y', days: 1825 },
                          { label: '10y', days: 3650 },
                          { label: '25y', days: 9125 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setScheduleForm({ ...scheduleForm, retentionDays: preset.days })}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono border cursor-pointer transition ${
                              scheduleForm.retentionDays === preset.days
                                ? 'bg-[#000000] text-white border-black font-bold'
                                : 'bg-white text-[#6B7280] border-[#D8DEEA] hover:bg-slate-100'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      required={!scheduleForm.permanent}
                      min="1"
                      value={scheduleForm.retentionDays}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, retentionDays: parseInt(e.target.value, 10) || 0 })}
                      className="w-full h-8 px-3 bg-white border border-[#D8DEEA] rounded-full text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Action on Expiry</label>
                <select
                  value={scheduleForm.actionOnExpiry}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, actionOnExpiry: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs cursor-pointer font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                >
                  <option value="Maker-Checker Review & Cryptographic Zeroization">Maker-Checker Review & Cryptographic Zeroization</option>
                  <option value="Transfer to National Archives">Transfer to National Archives</option>
                  <option value="Executive Review for Extension">Executive Review for Extension</option>
                  <option value="Permanent Cold Storage Lock">Permanent Cold Storage Lock</option>
                  <option value="Auto-Shred & Ledger Attestation">Auto-Shred & Ledger Attestation</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="delReqApproval"
                  checked={scheduleForm.deletionRequiresApproval}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, deletionRequiresApproval: e.target.checked })}
                  className="w-4 h-4 text-[#3f5e93] rounded cursor-pointer"
                />
                <label htmlFor="delReqApproval" className="text-xs text-[#10141A] font-medium cursor-pointer">
                  Require Dual Maker-Checker Sign-off for Disposal
                </label>
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional context or regulatory background..."
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  className="w-full p-2.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-[14px] text-xs resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => {
                    setCreateScheduleModalOpen(false);
                    setEditingScheduleId(null);
                  }}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#000000] text-white rounded-full text-xs font-medium shadow-xs hover:bg-[#181c22] cursor-pointer transition"
                >
                  {editingScheduleId ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Document Classification Type Modal */}
      {createDocTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-md w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">category</span>
                <h3 className="text-sm font-semibold text-[#10141A]">
                  {editingDocTypeId ? 'Edit Document Classification Type' : 'Add Document Classification Type'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setCreateDocTypeModalOpen(false);
                  setEditingDocTypeId(null);
                }}
                className="text-[#6B7280] hover:text-[#10141A] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDocTypeSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Classification Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AFFIDAVIT, CONTRACT, CIRCULAR, DEED"
                  value={docTypeForm.code}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, code: e.target.value.toUpperCase() })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
                <p className="text-[10px] text-[#6B7280] mt-0.5">Short unique identifier used on case files and docket prefixes.</p>
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Document Classification Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal Affidavit & Sworn Statement"
                  value={docTypeForm.name}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, name: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Description / Usage Guidelines</label>
                <textarea
                  rows={2}
                  placeholder="Operational purpose, intended document types, and legal scope..."
                  value={docTypeForm.description}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, description: e.target.value })}
                  className="w-full p-2.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-[14px] text-xs resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="docTypeActive"
                  checked={docTypeForm.active}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, active: e.target.checked })}
                  className="w-4 h-4 text-[#3f5e93] rounded cursor-pointer"
                />
                <label htmlFor="docTypeActive" className="text-xs text-[#10141A] font-medium cursor-pointer">
                  Active classification (available in upload &amp; routing matrix)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => {
                    setCreateDocTypeModalOpen(false);
                    setEditingDocTypeId(null);
                  }}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#000000] text-white rounded-full text-xs font-medium shadow-xs hover:bg-[#181c22] cursor-pointer transition"
                >
                  {editingDocTypeId ? 'Save Changes' : 'Create Document Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Department Modal */}
      {createDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-md w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">corporate_fare</span>
                <h3 className="text-sm font-semibold text-[#10141A]">Add New Department</h3>
              </div>
              <button
                onClick={() => setCreateDeptModalOpen(false)}
                className="text-[#6B7280] hover:text-[#10141A] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDeptSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Department Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FIN, LEGAL, HR, VIGILANCE"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Directorate of Financial Intelligence"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Parent Department (Optional)</label>
                <select
                  value={deptForm.parentDepartmentId}
                  onChange={(e) => setDeptForm({ ...deptForm, parentDepartmentId: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                >
                  <option value="">None (Top-Level Division)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setCreateDeptModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#000000] text-white rounded-full text-xs font-medium shadow-xs hover:bg-[#181c22] cursor-pointer transition"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {createTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-md w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">groups</span>
                <h3 className="text-sm font-semibold text-[#10141A]">Add Operational Team</h3>
              </div>
              <button
                onClick={() => setCreateTeamModalOpen(false)}
                className="text-[#6B7280] hover:text-[#10141A] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTeamSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Parent Department *</label>
                <select
                  required
                  value={teamForm.departmentId}
                  onChange={(e) => setTeamForm({ ...teamForm, departmentId: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Team Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AUDIT-OPS, CYBER-SEC"
                  value={teamForm.code}
                  onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value.toUpperCase() })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit & Statutory Compliance Unit"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setCreateTeamModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#000000] text-white rounded-full text-xs font-medium shadow-xs hover:bg-[#181c22] cursor-pointer transition"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {createRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-md w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">badge</span>
                <h3 className="text-sm font-semibold text-[#10141A]">Create Custom RBAC Role</h3>
              </div>
              <button
                onClick={() => setCreateRoleModalOpen(false)}
                className="text-[#6B7280] hover:text-[#10141A] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveRoleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Role Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COMPLIANCE_OFFICER, SENIOR_REGISTRAR"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value.toUpperCase() })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Role Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Statutory Compliance Officer"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-semibold mb-1">Description / Responsibility</label>
                <textarea
                  rows={2}
                  placeholder="Scope of duties and authorized access tiers..."
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full p-2.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-[14px] text-xs resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setCreateRoleModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8DEEA] rounded-full text-xs font-medium cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#000000] text-white rounded-full text-xs font-medium shadow-xs hover:bg-[#181c22] cursor-pointer transition"
                >
                  Create Role
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
