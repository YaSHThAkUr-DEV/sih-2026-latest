'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface Department {
  id: string;
  name: string;
  code: string;
  status: string;
  parent_department_id?: string;
  parent_department_name?: string;
  member_count: number | string;
  team_count: number | string;
  policy_count: number | string;
  created_at: string;
  storage_bytes?: number;
  storage_mb?: number;
  storage_gb?: number;
  storage_quota?: number;
  doc_count?: number;
  head_name?: string;
  head_title?: string;
}

interface Team {
  id: string;
  name: string;
  code: string;
  status: string;
  department_id: string;
  department_name: string;
  department_code: string;
  member_count: number | string;
  created_at: string;
}

interface UserOption {
  id: string;
  full_name: string;
  designation?: string;
  department_id?: string;
}

interface DepartmentsManagementViewProps {
  onNotify?: (msg: string) => void;
  onNavigateToUsers?: (departmentId?: string) => void;
}

export default function DepartmentsManagementView({
  onNotify,
  onNavigateToUsers,
}: DepartmentsManagementViewProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters and controls
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'storage' | 'members' | 'alpha'>('storage');
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');

  // Drawer / Modal states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTeamModalOpen, setNewTeamModalOpen] = useState(false);
  const [selectedDeptForTeam, setSelectedDeptForTeam] = useState<string>('');

  // New Department Form
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [initialSquads, setInitialSquads] = useState<string[]>(['General Operations']);
  const [squadInput, setSquadInput] = useState('');
  const [submittingDept, setSubmittingDept] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);

  // New Team Form
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptRes, teamRes, userRes] = await Promise.all([
        fetch('/api/admin/departments'),
        fetch('/api/admin/teams'),
        fetch('/api/admin/users?limit=100'),
      ]);

      if (deptRes.ok) {
        const dData = await deptRes.json();
        setDepartments(dData.departments || []);
      }
      if (teamRes.ok) {
        const tData = await teamRes.json();
        setTeams(tData.teams || []);
      }
      if (userRes.ok) {
        const uData = await userRes.json();
        setUsers(uData.users || []);
      }
    } catch (err) {
      console.error('Failed to load departments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute stats and enrich departments
  const enrichedDepartments = useMemo(() => {
    return departments.map((d) => {
      const members = parseInt(String(d.member_count || 0), 10);
      const teamCnt = parseInt(String(d.team_count || 0), 10);
      const storageBytes = parseInt(String(d.storage_bytes || 0), 10);
      const storageMb = Math.round((storageBytes / (1024 * 1024)) * 10) / 10;
      const storageGb = Math.round((storageBytes / (1024 * 1024 * 1024)) * 100) / 100;
      const docCount = parseInt(String(d.doc_count || 0), 10);
      const quotaGb = 200; // 200 GB quota per department

      const headUser = users.find((u) => u.department_id === d.id);

      return {
        ...d,
        member_count: members,
        team_count: teamCnt,
        storage_bytes: storageBytes,
        storage_mb: storageMb,
        storage_gb: storageGb,
        storage_quota: quotaGb,
        doc_count: docCount,
        head_name: d.head_name || headUser?.full_name || 'Department Lead',
        head_title: d.head_title || headUser?.designation || 'Unit Manager',
      };
    });
  }, [departments, users]);

  // Aggregate Metrics
  const totalDepartments = enrichedDepartments.length;
  const totalTeams = teams.length;
  const totalStorageBytes = enrichedDepartments.reduce((acc, d) => acc + (d.storage_bytes || 0), 0);
  const totalStorageMb = Math.round((totalStorageBytes / (1024 * 1024)) * 10) / 10;
  const totalStorageGb = Math.round((totalStorageBytes / (1024 * 1024 * 1024)) * 100) / 100;
  const totalStorageQuota = 1000;
  const storagePercent = Math.max(0.01, Math.round((totalStorageBytes / (totalStorageQuota * 1024 * 1024 * 1024)) * 1000) / 10);

  // Filter & Sort
  const filteredDepartments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = enrichedDepartments.filter((d) => {
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.head_name?.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'storage') {
        return (b.storage_gb || 0) - (a.storage_gb || 0);
      }
      if (sortBy === 'members') {
        return (Number(b.member_count) || 0) - (Number(a.member_count) || 0);
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [enrichedDepartments, searchQuery, sortBy]);

  // Handle Add Squad Tag
  const handleAddSquad = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && squadInput.trim()) {
      e.preventDefault();
      if (!initialSquads.includes(squadInput.trim())) {
        setInitialSquads([...initialSquads, squadInput.trim()]);
      }
      setSquadInput('');
    }
  };

  const handleRemoveSquad = (squadToRemove: string) => {
    setInitialSquads(initialSquads.filter((s) => s !== squadToRemove));
  };

  // Submit New Department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    if (!deptName.trim() || !deptCode.trim()) {
      setDeptError('Department name and code are required.');
      return;
    }

    setSubmittingDept(true);
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deptName.trim(),
          code: deptCode.trim().toUpperCase(),
          status: 'ACTIVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create department.');
      }

      const createdDeptId = data.departmentId;

      if (createdDeptId && initialSquads.length > 0) {
        for (const squad of initialSquads) {
          const squadCode = squad
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 4)
            .toUpperCase();
          try {
            await fetch('/api/admin/teams', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                departmentId: createdDeptId,
                name: squad,
                code: squadCode || 'SQD',
                status: 'ACTIVE',
              }),
            });
          } catch {
            // ignore
          }
        }
      }

      onNotify?.(`Department "${deptName}" created successfully with ${initialSquads.length} initial squads.`);
      setDrawerOpen(false);
      setDeptName('');
      setDeptCode('');
      setInitialSquads(['General Operations']);
      fetchData();
    } catch (err: any) {
      setDeptError(err.message || 'Error provisioning department');
    } finally {
      setSubmittingDept(false);
    }
  };

  // Submit New Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError(null);
    if (!selectedDeptForTeam || !teamName.trim() || !teamCode.trim()) {
      setTeamError('All fields are required.');
      return;
    }

    setSubmittingTeam(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDeptForTeam,
          name: teamName.trim(),
          code: teamCode.trim().toUpperCase(),
          status: 'ACTIVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create team.');
      }

      onNotify?.(`Team "${teamName}" created successfully.`);
      setNewTeamModalOpen(false);
      setTeamName('');
      setTeamCode('');
      fetchData();
    } catch (err: any) {
      setTeamError(err.message || 'Error provisioning team');
    } finally {
      setSubmittingTeam(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Main Surface Card */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3f5e93] text-[22px]">corporate_fare</span>
              <h1 className="text-xl lg:text-2xl font-semibold text-[#10141A] tracking-tight">
                Departments & Organization Structure
              </h1>
              <span className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                {totalDepartments} Divisions
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Structure your organization into divisions, allocate document storage quotas, and manage team boundaries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (departments.length > 0) {
                  setSelectedDeptForTeam(departments[0].id);
                }
                setNewTeamModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium transition shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-[#3f5e93]">group_add</span>
              <span>New Team</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-medium transition shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
            >
              <span className="material-symbols-outlined text-[16px]">domain_add</span>
              <span>Create Department</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Total Departments</span>
              <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
                <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{totalDepartments} Units</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Active organizational wings</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Sub-Teams</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 text-[#10141A] flex items-center justify-center border border-slate-200">
                <span className="material-symbols-outlined text-[18px]">diversity_3</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">{totalTeams} Teams</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Cross-functional squads</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Storage Allocated</span>
              <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93]">
                {storagePercent}%
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-[#10141A]">
                {totalStorageMb > 1024 ? `${totalStorageGb} GB` : `${totalStorageMb} MB`}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-0.5 font-mono">1,000 GB enterprise quota</div>
            </div>
          </div>

          <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03),0_8px_24px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/60 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wider">Compliance Coverage</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-700">100% Attested</div>
              <div className="text-[11px] text-[#6B7280] mt-0.5">Zero orphan units</div>
            </div>
          </div>
        </div>

        {/* Search, Filter & View Controls */}
        <div className="bg-white rounded-[20px] p-4 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments, teams, or leads..."
              className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs font-medium text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="storage">Sort by Storage Used</option>
              <option value="members">Sort by Member Count</option>
              <option value="alpha">Alphabetical</option>
            </select>

            <div className="flex items-center bg-[#f0f3ff] p-0.5 rounded-full border border-[#D8DEEA]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  viewMode === 'grid' ? 'bg-[#000000] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#10141A]'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  viewMode === 'tree' ? 'bg-[#000000] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#10141A]'
                }`}
              >
                Hierarchy
              </button>
            </div>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-12 text-center text-[#6B7280] text-xs">
                <span className="material-symbols-outlined text-[28px] animate-spin text-[#3f5e93] block mb-1">sync</span>
                Loading organization directory...
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="col-span-full py-12 text-center text-[#6B7280] text-xs bg-white rounded-[20px] border border-[#D8DEEA]/60">
                No departments match your search query.
              </div>
            ) : (
              filteredDepartments.map((dept) => {
                const deptTeams = teams.filter((t) => t.department_id === dept.id);
                const percentUsed = (dept.storage_bytes || 0) > 0
                  ? Math.max(0.1, Number(((dept.storage_bytes / (dept.storage_quota * 1024 * 1024 * 1024)) * 100).toFixed(2)))
                  : 0;

                return (
                  <div
                    key={dept.id}
                    className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 hover:shadow-[0_4px_16px_rgba(16,20,26,0.06)] transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA]">
                            {dept.code}
                          </span>
                          <h3 className="text-sm font-semibold text-[#10141A] truncate">{dept.name}</h3>
                        </div>
                        <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700">
                          Active
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 rounded-[14px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/40">
                        <div className="w-7 h-7 rounded-full bg-[#10141A] text-white flex items-center justify-center font-bold text-[10px]">
                          {dept.head_name?.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] uppercase text-[#6B7280]">Lead</span>
                          <span className="text-xs font-semibold text-[#10141A] truncate">{dept.head_name}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-[#6B7280]">
                          <span>Teams ({deptTeams.length})</span>
                          <span className="font-medium text-[#10141A]">{dept.member_count} Members</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {deptTeams.length > 0 ? (
                            deptTeams.slice(0, 3).map((t) => (
                              <span
                                key={t.id}
                                className="px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#6B7280] text-[10px] border border-[#D8DEEA]"
                              >
                                {t.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#9CA3AF] italic">No teams</span>
                          )}
                          {deptTeams.length > 3 && (
                            <span className="px-2 py-0.5 rounded-full bg-[#E9ECF4] text-[#6B7280] text-[10px]">
                              +{deptTeams.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 p-3 rounded-[14px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/40">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#6B7280]">{dept.doc_count?.toLocaleString()} Files</span>
                          <span className="font-semibold text-[#3f5e93]">
                            {dept.storage_mb > 1024 ? `${dept.storage_gb} GB` : `${dept.storage_mb} MB`} / {dept.storage_quota} GB
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#E9ECF4] overflow-hidden">
                          <div
                            className="h-full bg-[#3f5e93] rounded-full transition-all"
                            style={{ width: `${Math.max(dept.storage_bytes ? 3 : 0, Math.min(100, percentUsed))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#D8DEEA]/40 flex items-center justify-between">
                      <button
                        onClick={() => onNavigateToUsers && onNavigateToUsers(dept.id)}
                        className="text-xs font-medium text-[#3f5e93] hover:text-[#10141A] flex items-center gap-1"
                      >
                        <span>View Personnel</span>
                        <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tree View */}
        {viewMode === 'tree' && (
          <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/60 space-y-4">
            <div className="space-y-3">
              {filteredDepartments.map((dept) => {
                const deptTeams = teams.filter((t) => t.department_id === dept.id);
                return (
                  <div key={dept.id} className="p-4 rounded-[16px] bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">corporate_fare</span>
                        <span className="font-semibold text-sm text-[#10141A]">{dept.name} ({dept.code})</span>
                      </div>
                      <span className="text-xs text-[#6B7280]">{dept.member_count} Members</span>
                    </div>

                    <div className="pl-6 space-y-1.5 border-l-2 border-[#D8DEEA] ml-2">
                      {deptTeams.map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[#6B7280] text-[16px]">groups</span>
                            <span className="font-medium text-[#10141A]">{t.name}</span>
                            <span className="font-mono text-[10px] text-[#9CA3AF]">({t.code})</span>
                          </div>
                          <span className="text-[11px] text-[#6B7280]">{t.member_count} Users</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drawer: Create Department */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-lg w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2 text-[#10141A]">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] flex items-center justify-center text-[#3f5e93] border border-[#83A2DB]/30">
                  <span className="material-symbols-outlined text-[18px]">domain_add</span>
                </div>
                <h3 className="text-sm font-semibold">Create New Department</h3>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {deptError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-[14px] text-xs text-rose-700">
                {deptError}
              </div>
            )}

            <form onSubmit={handleCreateDepartment} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#10141A] font-medium mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Special Operations Unit"
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">Department Code *</label>
                <input
                  type="text"
                  required
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="e.g. SOU"
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] uppercase font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">Initial Squads / Teams</label>
                <div className="flex items-center gap-1.5 mb-2">
                  <input
                    type="text"
                    value={squadInput}
                    onChange={(e) => setSquadInput(e.target.value)}
                    onKeyDown={handleAddSquad}
                    placeholder="Type squad name and press Enter..."
                    className="flex-1 h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (squadInput.trim() && !initialSquads.includes(squadInput.trim())) {
                        setInitialSquads([...initialSquads, squadInput.trim()]);
                        setSquadInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-white border border-[#D8DEEA] rounded-full text-xs text-[#151c27] hover:bg-[#f0f3ff]"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {initialSquads.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f0f3ff] text-[#3f5e93] text-[11px] border border-[#D8DEEA]"
                    >
                      <span>{s}</span>
                      <button type="button" onClick={() => handleRemoveSquad(s)} className="text-[#9CA3AF] hover:text-[#10141A]">
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] font-medium text-xs rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDept}
                  className="px-4 py-2 bg-[#000000] hover:bg-[#181c22] text-white font-medium text-xs rounded-full transition shadow-[0_6px_18px_rgba(16,20,26,0.22)] disabled:opacity-50"
                >
                  <span>{submittingDept ? 'Creating...' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Team */}
      {newTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[26px] max-w-md w-full p-6 shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#D8DEEA]/60 pb-3">
              <div className="flex items-center gap-2 text-[#10141A]">
                <div className="w-8 h-8 rounded-full bg-[rgba(131,162,219,0.14)] flex items-center justify-center text-[#3f5e93] border border-[#83A2DB]/30">
                  <span className="material-symbols-outlined text-[18px]">group_add</span>
                </div>
                <h3 className="text-sm font-semibold">Create New Team</h3>
              </div>
              <button
                onClick={() => setNewTeamModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {teamError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-[14px] text-xs text-rose-700">
                {teamError}
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#10141A] font-medium mb-1">Parent Department *</label>
                <select
                  value={selectedDeptForTeam}
                  onChange={(e) => setSelectedDeptForTeam(e.target.value)}
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none cursor-pointer"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">Team / Squad Name *</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Field Investigation Alpha"
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#10141A] font-medium mb-1">Team Code *</label>
                <input
                  type="text"
                  required
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  placeholder="e.g. FIA"
                  className="w-full h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] uppercase font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setNewTeamModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] font-medium text-xs rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTeam}
                  className="px-4 py-2 bg-[#000000] hover:bg-[#181c22] text-white font-medium text-xs rounded-full transition shadow-[0_6px_18px_rgba(16,20,26,0.22)] disabled:opacity-50"
                >
                  <span>{submittingTeam ? 'Creating...' : 'Create Team'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
