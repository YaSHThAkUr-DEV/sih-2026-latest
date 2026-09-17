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
  1: { name: 'Level 1: Public', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
  2: { name: 'Level 2: Internal', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  3: { name: 'Level 3: Confidential', color: 'text-[#3f5e93]', bg: 'bg-[rgba(131,162,219,0.14)]', border: 'border-[#83A2DB]/30' },
  4: { name: 'Level 4: Sensitive', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  5: { name: 'Level 5: Top Secret', color: 'text-rose-800', bg: 'bg-rose-50', border: 'border-rose-200' },
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

      if (deptFilter && u.department_id !== deptFilter) return false;
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (roleFilter && !u.roles?.some((r) => r.id === roleFilter || r.code === roleFilter)) return false;
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
    showToast('Members directory exported.');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full text-xs font-medium shadow-2xl border animate-slide-up ${
            toastMsg.type === 'success'
              ? 'bg-[#10141A] text-white border-[#D8DEEA]/40'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toastMsg.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Main Surface Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3f5e93] text-[22px]">manage_accounts</span>
              <h1 className="text-xl lg:text-2xl font-semibold text-[#10141A] tracking-tight">
                User Management & Access Clearance
              </h1>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                {stats.total} Configured Accounts
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Enroll users, assign dynamic organizational roles, and enforce security clearance rank (Level 1–5).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-medium transition shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Enroll User</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Total Personnel</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">groups</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.total} Users</div>
              <div className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{stats.activeCount} currently active</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">High Clearance (L4/L5)</span>
              <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <span className="material-symbols-outlined text-[18px]">security</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{stats.highClearance} Officers</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Sensitive & Top Secret access</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Modular Roles</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">badge</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{roles.length} Roles</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Dynamic RBAC mapping</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Departments</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 text-[#10141A] flex items-center justify-center border border-slate-200">
                <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{departments.length} Wings</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Departmental scoping</div>
            </div>
          </div>
        </div>

        {/* User Table & Role Matrix */}
        <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
          {/* Main User Table (9 Cols) */}
          <div className="2xl:col-span-9 space-y-4">
            
            {/* Filter Bar */}
            <div className="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Search name, email, employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-medium text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-medium text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-medium text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Clearances</option>
                  <option value="1">Level 1 (Public)</option>
                  <option value="2">Level 2 (Internal)</option>
                  <option value="3">Level 3 (Confidential)</option>
                  <option value="4">Level 4 (Sensitive)</option>
                  <option value="5">Level 5 (Top Secret)</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                    <tr>
                      <th className="py-3 px-4">User / Official</th>
                      <th className="py-3 px-3">Clearance</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Roles</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-[#6B7280]">
                          <span className="material-symbols-outlined text-[24px] animate-spin text-[#3f5e93] block mb-1">sync</span>
                          Loading user directory...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-[#6B7280]">
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
                          <tr key={u.id} className="hover:bg-[#f0f3ff]/40 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#10141A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                  {initials}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-[#10141A] truncate">{u.full_name}</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280] font-mono">
                                    <span>{u.username}</span>
                                    <span>•</span>
                                    <span>{u.email}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${secInfo.bg} ${secInfo.color} ${secInfo.border}`}
                              >
                                <span className="material-symbols-outlined text-[12px]">verified_user</span>
                                <span>{secInfo.name}</span>
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-medium text-[#10141A]">{u.department_name || 'Unassigned'}</div>
                              <div className="text-[10px] text-[#6B7280]">{u.designation || 'Staff'}</div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {(u.roles && u.roles.length > 0) ? (
                                  u.roles.map((r) => (
                                    <span
                                      key={r.id}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA]"
                                    >
                                      {r.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-[#9CA3AF] italic">No roles</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {u.status}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-[11px] text-[#6B7280]">
                              {u.last_login_at
                                ? new Date(u.last_login_at).toLocaleDateString()
                                : 'Never'}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => openEditModal(u)}
                                className="px-3 py-1 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] text-xs font-medium border border-[#D8DEEA] transition"
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
              <div className="p-3.5 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs text-[#6B7280]">
                <span>Showing <b>{filteredUsers.length}</b> of <b>{users.length}</b> users</span>
                <span className="font-mono text-[11px]">Database-enforced RBAC</span>
              </div>
            </div>
          </div>

          {/* Right Role Matrix Reference (3 Cols) */}
          <div className="2xl:col-span-3 space-y-4">
            <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
                <div className="flex items-center gap-1.5 text-[#10141A]">
                  <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">badge</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Modular Roles</h3>
                </div>
                <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93]">
                  {roles.length} Active
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280]">
                Roles and permissions are fully dynamic and configurable.
              </p>

              <div className="space-y-2 text-xs">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-[14px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-[#10141A]">
                      <span>{r.name}</span>
                      <span className="text-[9px] px-2 py-0.2 rounded-full bg-white text-[#6B7280] font-mono border border-[#D8DEEA]">
                        {r.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B7280]">
                      {r.description || 'Custom organizational role'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Enroll User */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2 text-[#10141A]">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] flex items-center justify-center text-[#3f5e93] border border-[#83A2DB]/30">
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                </div>
                <h3 className="text-sm font-semibold">Enroll New User</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="e.g. rkumar"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="rkumar@dms.gov.in"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={userForm.employeeCode}
                    onChange={(e) => setUserForm({ ...userForm, employeeCode: e.target.value })}
                    placeholder="e.g. GOV-REV-042"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Department</label>
                  <select
                    value={userForm.departmentId}
                    onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Designation</label>
                  <input
                    type="text"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                    placeholder="e.g. Executive Officer"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">
                  Clearance Level *
                </label>
                <select
                  value={userForm.maxSecurityLevel}
                  onChange={(e) => setUserForm({ ...userForm, maxSecurityLevel: Number(e.target.value) })}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value={1}>Level 1: Public / Low Documents</option>
                  <option value={2}>Level 2: Internal Documents</option>
                  <option value={3}>Level 3: Confidential Documents (Default)</option>
                  <option value={4}>Level 4: Sensitive Documents</option>
                  <option value={5}>Level 5: Top Secret / Highly Sensitive</option>
                </select>
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">Assign Roles</label>
                <div className="grid grid-cols-2 gap-2 p-3 border border-[#D8DEEA] rounded-[16px] bg-[#f0f3ff]/40 max-h-28 overflow-y-auto">
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
                        className="w-3.5 h-3.5 text-[#3f5e93] rounded"
                      />
                      <span className="text-[#10141A] truncate">{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] font-medium text-xs rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#000000] hover:bg-[#181c22] text-white font-medium text-xs rounded-full transition shadow-[0_6px_18px_rgba(16,20,26,0.22)] disabled:opacity-50"
                >
                  <span>{submitting ? 'Creating...' : 'Enroll User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2 text-[#10141A]">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] flex items-center justify-center text-[#3f5e93] border border-[#83A2DB]/30">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </div>
                <h3 className="text-sm font-semibold">Edit User Profile</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Department</label>
                  <select
                    value={userForm.departmentId}
                    onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Clearance Level</label>
                  <select
                    value={userForm.maxSecurityLevel}
                    onChange={(e) => setUserForm({ ...userForm, maxSecurityLevel: Number(e.target.value) })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value={1}>Level 1: Public</option>
                    <option value={2}>Level 2: Internal</option>
                    <option value={3}>Level 3: Confidential</option>
                    <option value={4}>Level 4: Sensitive</option>
                    <option value={5}>Level 5: Top Secret</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value as any })}
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#10141A] font-medium mb-1">Reset Password (Optional)</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Leave blank to keep"
                    className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">Assign Roles</label>
                <div className="grid grid-cols-2 gap-2 p-3 border border-[#D8DEEA] rounded-[16px] bg-[#f0f3ff]/40 max-h-28 overflow-y-auto">
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
                        className="w-3.5 h-3.5 text-[#3f5e93] rounded"
                      />
                      <span className="text-[#10141A] truncate">{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] font-medium text-xs rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#000000] hover:bg-[#181c22] text-white font-medium text-xs rounded-full transition shadow-[0_6px_18px_rgba(16,20,26,0.22)] disabled:opacity-50"
                >
                  <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
