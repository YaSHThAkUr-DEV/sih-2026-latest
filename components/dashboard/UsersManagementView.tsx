'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface UserRecord {
  id: string;
  username: string;
  full_name: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
  employee_code?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  max_security_level?: number;
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  team_code?: string | null;
  last_login_at?: string | null;
  created_at: string;
  roles?: { id: string; name: string; code: string }[];
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_system_role?: boolean;
}

interface UsersManagementViewProps {
  onReturnToOverview?: () => void;
  currentUserId?: string;
  onNotify?: (message: string) => void;
}

const SECURITY_LEVEL_LABELS: Record<number, { name: string; color: string; bg: string; border: string }> = {
  1: { name: 'Level 1: Public / Low', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
  2: { name: 'Level 2: Internal', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  3: { name: 'Level 3: Confidential', color: 'text-indigo-800', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  4: { name: 'Level 4: Sensitive', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  5: { name: 'Level 5: Highly Sensitive', color: 'text-rose-800', bg: 'bg-rose-50', border: 'border-rose-200' },
};

export default function UsersManagementView({
  onReturnToOverview,
  currentUserId,
  onNotify,
}: UsersManagementViewProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');

  // Modals & Feedback
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [userForm, setUserForm] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    designation: '',
    employeeCode: '',
    departmentId: '',
    password: '',
    maxSecurityLevel: 3,
    roleIds: [] as string[],
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, deptsRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/departments'),
        fetch('/api/admin/roles'),
      ]);

      if (usersRes.ok) {
        const d = await usersRes.json();
        setUsers(d.users || []);
      }
      if (deptsRes.ok) {
        const d = await deptsRes.json();
        setDepartments(d.departments || []);
      }
      if (rolesRes.ok) {
        const d = await rolesRes.json();
        setRoles(d.roles || []);
      }
    } catch (err: any) {
      console.error('Failed to load users data:', err);
      showToast('Failed to connect to database users directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
    const highClearance = users.filter((u) => (u.max_security_level || 3) >= 4).length;
    const suspended = users.filter((u) => u.status === 'SUSPENDED' || u.status === 'DISABLED').length;
    return { total, activeCount, highClearance, suspended };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.employee_code?.toLowerCase().includes(q) ||
          u.department_name?.toLowerCase().includes(q) ||
          u.designation?.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Department filter
      if (deptFilter && u.department_id !== deptFilter) return false;

      // Status filter
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;

      // Role filter
      if (roleFilter && !u.roles?.some((r) => r.id === roleFilter || r.code === roleFilter)) return false;

      // Level filter
      if (levelFilter !== 'ALL' && (u.max_security_level || 3) !== Number(levelFilter)) return false;

      return true;
    });
  }, [users, searchQuery, deptFilter, roleFilter, statusFilter, levelFilter]);

  // Handle Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userForm.username.trim(),
          fullName: userForm.fullName.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim() || undefined,
          designation: userForm.designation.trim() || undefined,
          employeeCode: userForm.employeeCode.trim() || undefined,
          departmentId: userForm.departmentId || null,
          password: userForm.password,
          maxSecurityLevel: Number(userForm.maxSecurityLevel) || 3,
          roleIds: userForm.roleIds,
          status: 'ACTIVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      showToast(`User ${userForm.fullName} created successfully!`);
      setCreateModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit User Modal
  const openEditModal = (u: UserRecord) => {
    setSelectedUser(u);
    setUserForm({
      username: u.username,
      fullName: u.full_name,
      email: u.email,
      phone: u.phone || '',
      designation: u.designation || '',
      employeeCode: u.employee_code || '',
      departmentId: u.department_id || '',
      password: '',
      maxSecurityLevel: u.max_security_level ?? 3,
      roleIds: (u.roles || []).map((r) => r.id),
      status: u.status,
    });
    setEditModalOpen(true);
  };

  // Handle Update User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const payload: any = {
        fullName: userForm.fullName.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim() || null,
        designation: userForm.designation.trim() || null,
        employeeCode: userForm.employeeCode.trim() || null,
        departmentId: userForm.departmentId || null,
        maxSecurityLevel: Number(userForm.maxSecurityLevel) || 3,
        roleIds: userForm.roleIds,
        status: userForm.status,
      };
      if (userForm.password && userForm.password.length >= 6) {
        payload.password = userForm.password;
      }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showToast(`User ${userForm.fullName} updated successfully!`);
      setEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setUserForm({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      designation: '',
      employeeCode: '',
      departmentId: '',
      password: '',
      maxSecurityLevel: 3,
      roleIds: [],
      status: 'ACTIVE',
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Full Name', 'Username', 'Email', 'Clearance Level', 'Department', 'Designation', 'Status', 'Roles', 'Created At'];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.full_name.replace(/"/g, '""')}"`,
      u.username,
      u.email,
      `Level ${u.max_security_level || 3}`,
      `"${u.department_name || 'Unassigned'}"`,
      `"${u.designation || ''}"`,
      u.status,
      `"${(u.roles || []).map((r) => r.name).join(', ')}"`,
      u.created_at,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DMS_Users_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Members directory exported successfully.');
  };

  return (
    <div className="flex flex-col w-full bg-[#f8f9ff] min-h-screen text-[#0b1c30]">
      {/* Toast */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-semibold shadow-xl border animate-slide-up ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toastMsg.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toastMsg.text}</span>
        </div>
      )}

      <div className="p-4 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
        {/* Header Breadcrumbs & Title with Prominent Create User Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#565e74] uppercase tracking-wider">Access Control &amp; Personnel</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="text-xs font-semibold text-[#004ac6]">{stats.total} Configured Accounts</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30]">User Management &amp; RBAC Clearance</h1>
            <p className="text-xs text-[#434655] max-w-2xl leading-relaxed">
              Enroll users, assign dynamic organizational roles, and enforce security clearance rank (Level 1–5).
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 shadow-2xs transition"
            >
              <span className="material-symbols-outlined text-[18px] text-slate-500">file_download</span>
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition transform active:scale-98"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>+ Create New User</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#565e74]">Total Personnel</span>
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#004ac6]">
                <span className="material-symbols-outlined text-[20px]">groups</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#0b1c30]">
                {stats.total} <span className="text-xs text-[#565e74] font-normal">registered</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>{stats.activeCount} currently active</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#565e74]">High Clearance (T4/T5)</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                <span className="material-symbols-outlined text-[20px]">security</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#0b1c30]">
                {stats.highClearance} <span className="text-xs text-[#565e74] font-normal">users</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <span>Sensitive / Top Secret access</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#565e74]">Configured Roles</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#0b1c30]">
                {roles.length} <span className="text-xs text-[#565e74] font-normal">modular roles</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-700">
                <span>Dynamic role-permission mapping</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#565e74]">Departments</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#0b1c30]">
                {departments.length} <span className="text-xs text-[#565e74] font-normal">operational wings</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <span>Departmental scoping</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid: User Table (9 cols) + Role Reference (3 cols) */}
        <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
          {/* Left Table Section */}
          <div className="2xl:col-span-9 flex flex-col gap-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search by name, email, employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-medium"
                />
              </div>

              {/* Select Filters */}
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                {/* Department */}
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {/* Clearance Level */}
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="ALL">All Clearances</option>
                  <option value="1">Level 1 (Public)</option>
                  <option value="2">Level 2 (Internal)</option>
                  <option value="3">Level 3 (Confidential)</option>
                  <option value="4">Level 4 (Sensitive)</option>
                  <option value="5">Level 5 (Top Secret)</option>
                </select>

                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            </div>

            {/* Users Table Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-[#565e74] uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User / Official</th>
                      <th className="py-3 px-3">Clearance Level</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Assigned Roles</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined animate-spin text-blue-600">sync</span>
                            <span>Loading user directory...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <span className="material-symbols-outlined text-[36px] block text-slate-300 mb-1">person_off</span>
                          No users match the active filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const initials = u.full_name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'U';

                        const secLevel = u.max_security_level ?? 3;
                        const secInfo = SECURITY_LEVEL_LABELS[secLevel] || SECURITY_LEVEL_LABELS[3];

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition">
                            {/* Member Profile */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#004ac6] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                  {initials}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-slate-900 truncate">{u.full_name}</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                                    <span>{u.username}</span>
                                    <span>•</span>
                                    <span>{u.email}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Security Clearance */}
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${secInfo.bg} ${secInfo.color} ${secInfo.border}`}
                              >
                                <span className="material-symbols-outlined text-[12px]">verified_user</span>
                                <span>{secInfo.name}</span>
                              </span>
                            </td>

                            {/* Department */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800">{u.department_name || 'Unassigned'}</span>
                                <span className="text-[10px] text-slate-400">{u.designation || 'Staff'}</span>
                              </div>
                            </td>

                            {/* Assigned Roles */}
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {(u.roles && u.roles.length > 0) ? (
                                  u.roles.map((r) => (
                                    <span
                                      key={r.id}
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                                    >
                                      {r.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No roles</span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    u.status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-amber-600'
                                  }`}
                                ></span>
                                {u.status}
                              </span>
                            </td>

                            {/* Last Login */}
                            <td className="py-3 px-3 text-[11px] text-slate-500">
                              {u.last_login_at
                                ? new Date(u.last_login_at).toLocaleDateString()
                                : 'Never'}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => openEditModal(u)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing <b>{filteredUsers.length}</b> of <b>{users.length}</b> users
                </span>
                <span className="font-mono text-[11px]">Database-enforced RBAC</span>
              </div>
            </div>
          </div>

          {/* Right Role Matrix Reference Card (3 cols on 2xl) */}
          <div className="2xl:col-span-3 flex flex-col gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#004ac6] text-[18px]">shield</span>
                  <h3 className="text-xs font-bold text-[#0b1c30]">Modular Roles</h3>
                </div>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  {roles.length} Roles Active
                </span>
              </div>
              <p className="text-[11px] text-[#565e74]">
                Roles and permissions are fully dynamic and configurable. Only SUPER_ADMIN is a system-reserved role.
              </p>

              <div className="flex flex-col gap-2 mt-1 text-xs">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className={`p-2.5 rounded-lg border flex flex-col gap-0.5 ${
                      r.code === 'SUPER_ADMIN'
                        ? 'bg-blue-50/60 border-blue-200'
                        : 'bg-slate-50 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[#0b1c30]">
                      <span>{r.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                        {r.code}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#434655]">
                      {r.description || 'Custom organizational role'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CREATE USER */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-700">
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                </div>
                <h3 className="text-sm font-bold">Enroll New Institutional User</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Username (Login ID) *</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="e.g. rkumar"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="rkumar@dms.gov.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Employee / Officer Code</label>
                  <input
                    type="text"
                    value={userForm.employeeCode}
                    onChange={(e) => setUserForm({ ...userForm, employeeCode: e.target.value })}
                    placeholder="e.g. GOV-REV-042"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={userForm.departmentId}
                    onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <input
                    type="text"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                    placeholder="e.g. Tehsildar / Executive Officer"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Security Clearance Rank Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Maximum Security Clearance Level *
                </label>
                <select
                  value={userForm.maxSecurityLevel}
                  onChange={(e) => setUserForm({ ...userForm, maxSecurityLevel: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value={1}>Level 1: Public / Low Documents</option>
                  <option value={2}>Level 2: Internal Documents</option>
                  <option value={3}>Level 3: Confidential Documents (Default)</option>
                  <option value={4}>Level 4: Sensitive Documents (Approvals Required)</option>
                  <option value={5}>Level 5: Top Secret / Highly Sensitive (Full Clearance)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Users can only view and upload documents up to their assigned clearance level.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assign Modular Roles</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={userForm.roleIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUserForm({ ...userForm, roleIds: [...userForm.roleIds, r.id] });
                          } else {
                            setUserForm({ ...userForm, roleIds: userForm.roleIds.filter((id) => id !== r.id) });
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-800 font-medium">{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Enrolling...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-700">
                  <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                </div>
                <h3 className="text-sm font-bold">Edit User Privileges: {selectedUser.full_name}</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={userForm.departmentId}
                    onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <input
                    type="text"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Security Clearance */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Security Clearance Level *
                  </label>
                  <select
                    value={userForm.maxSecurityLevel}
                    onChange={(e) => setUserForm({ ...userForm, maxSecurityLevel: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                  >
                    <option value={1}>Level 1: Public</option>
                    <option value={2}>Level 2: Internal</option>
                    <option value={3}>Level 3: Confidential</option>
                    <option value={4}>Level 4: Sensitive</option>
                    <option value={5}>Level 5: Top Secret</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Account Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reset Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="New password (optional)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assign Modular Roles</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={userForm.roleIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUserForm({ ...userForm, roleIds: [...userForm.roleIds, r.id] });
                          } else {
                            setUserForm({ ...userForm, roleIds: userForm.roleIds.filter((id) => id !== r.id) });
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-800 font-medium">{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
