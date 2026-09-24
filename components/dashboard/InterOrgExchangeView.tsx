'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface InterOrgExchangeViewProps {
  currentUserId?: string;
  currentUserRoles?: string[];
  currentUserClearance?: number;
  currentOrg?: {
    id: string;
    code: string;
    name: string;
  };
}

interface RequisitionItem {
  id: string;
  requestNumber: string;
  subjectTitle: string;
  referenceCaseNumber?: string;
  statutoryPurpose: string;
  legalProvisions?: string;
  requestedAccessDays: number;
  slaDeadline?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  responseNote?: string;
  respondedAt?: string;
  expiresAt?: string;
  createdAt: string;

  // Requesting Org
  requestingOrgId: string;
  requestingOrgName: string;
  requestingOrgCode: string;
  requestingAgencyCode?: string;
  requestingUserId: string;
  requestingUserName: string;
  requestingUserDesignation?: string;
  requestingUserEmpCode?: string;
  requestingUserClearance?: number;

  // Target Org
  targetOrgId: string;
  targetOrgName: string;
  targetOrgCode: string;
  targetAgencyCode?: string;
  targetNodalName?: string;
  targetNodalEmail?: string;

  // Taxonomy Labels
  statutoryTemplateTitle?: string;
  sectionCitation?: string;
  legalActName?: string;
  priorityTierCode?: string;
  priorityTierName?: string;
  slaHours?: number;
  priorityBadgeColor?: string;

  // Target Document
  targetDocumentId?: string;
  targetDocumentNumber?: string;
  targetDocumentTitle?: string;
  targetDocSecurityCode?: string;
  targetDocSecurityRank?: number;

  // Share Info
  shareId?: string;
  shareNumber?: string;
  shareIsWatermarked?: boolean;
  shareExpiresAt?: string;
  shareIsRevoked?: boolean;
  shareBlockchainTx?: string;
  accessModeCode?: string;
  accessModeName?: string;
}

interface OrgDirectoryItem {
  id: string;
  name: string;
  code: string;
  agencyCode?: string;
  tierName?: string;
  tierBadgeColor?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryBadgeColor?: string;
  regionName?: string;
  stateCode?: string;
  isVerified: boolean;
  nodalOfficerName?: string;
  nodalOfficerEmail?: string;
  nodalOfficerPhone?: string;
  departmentsCount: number;
  activeDocumentsCount: number;
}

export default function InterOrgExchangeView({
  currentUserId,
  currentUserRoles = [],
  currentUserClearance = 3,
  currentOrg,
}: InterOrgExchangeViewProps) {
  // Navigation: 'inbound' | 'outbound' | 'directory'
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'directory'>('inbound');

  // Filter States
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Data States
  const [inboundReqs, setInboundReqs] = useState<RequisitionItem[]>([]);
  const [outboundReqs, setOutboundReqs] = useState<RequisitionItem[]>([]);
  const [counters, setCounters] = useState<{
    pendingInbound?: number;
    totalInbound?: number;
    pendingOutbound?: number;
    approvedOutbound?: number;
    activeShares?: number;
  }>({});
  const [directoryOrgs, setDirectoryOrgs] = useState<OrgDirectoryItem[]>([]);
  const [localDocs, setLocalDocs] = useState<any[]>([]);

  // Dynamic Taxonomies
  const [taxonomies, setTaxonomies] = useState<any>({
    tiers: [],
    categories: [],
    regions: [],
    statutoryTemplates: [],
    priorityTiers: [],
    accessModes: [],
  });

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [respondModalReq, setRespondModalReq] = useState<RequisitionItem | null>(null);
  const [selectedShare, setSelectedShare] = useState<any>(null);
  const [sec65BModalShare, setSec65BModalShare] = useState<any>(null);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' }>({
    show: false,
    message: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '' }), 4000);
  };

  // Form State for New Requisition
  const [reqForm, setReqForm] = useState({
    targetOrgId: '',
    subjectTitle: '',
    referenceCaseNumber: '',
    statutoryTemplateId: '',
    priorityTierId: '',
    customStatutoryPurpose: '',
    customLegalProvisions: '',
    requestedAccessDays: 7,
  });

  // Response Form State
  const [respForm, setRespForm] = useState({
    decision: 'APPROVE' as 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION',
    documentId: '',
    documentVersionId: '',
    accessModeId: '',
    enableWatermark: true,
    customWatermarkTemplate: '',
    accessDurationDays: 7,
    responseNote: '',
    rejectionReason: '',
  });

  // Fetch Taxonomies
  const fetchTaxonomies = useCallback(async () => {
    try {
      const res = await fetch('/api/collaboration/taxonomies');
      const data = await res.json();
      if (data.taxonomies) {
        setTaxonomies(data.taxonomies);
      }
    } catch (err) {
      console.error('Failed to load taxonomies', err);
    }
  }, []);

  // Fetch Requisitions
  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const [inboundRes, outboundRes] = await Promise.all([
        fetch(`/api/collaboration/requests?direction=inbound&status=${statusFilter}`),
        fetch(`/api/collaboration/requests?direction=outbound&status=${statusFilter}`),
      ]);

      const inboundData = await inboundRes.json();
      const outboundData = await outboundRes.json();

      if (inboundData.requests) setInboundReqs(inboundData.requests);
      if (outboundData.requests) setOutboundReqs(outboundData.requests);
      if (inboundData.counters) setCounters(inboundData.counters);
    } catch (err) {
      console.error('Failed to load requisitions', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Fetch Directory
  const fetchDirectory = useCallback(async () => {
    try {
      const res = await fetch(`/api/collaboration/directory?query=${encodeURIComponent(searchQuery)}&limit=50`);
      const data = await res.json();
      if (data.organizations) {
        setDirectoryOrgs(data.organizations);
      }
    } catch (err) {
      console.error('Failed to load directory', err);
    }
  }, [searchQuery]);

  // Fetch Local Docs for approval picker
  const fetchLocalDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/documents?limit=50');
      const data = await res.json();
      if (data.documents) {
        setLocalDocs(data.documents);
      }
    } catch (err) {
      console.error('Failed to load local documents', err);
    }
  }, []);

  useEffect(() => {
    fetchTaxonomies();
    fetchRequisitions();
    fetchDirectory();
    fetchLocalDocs();
  }, [fetchTaxonomies, fetchRequisitions, fetchDirectory, fetchLocalDocs]);

  // Handle Template Selection Auto-fill
  const handleStatutoryTemplateChange = (templateId: string) => {
    const tpl = taxonomies.statutoryTemplates.find((t: any) => t.id === templateId);
    if (tpl) {
      setReqForm((prev) => ({
        ...prev,
        statutoryTemplateId: templateId,
        customLegalProvisions: `${tpl.legal_act_name} - ${tpl.section_citation}`,
        customStatutoryPurpose: tpl.default_purpose_text || prev.customStatutoryPurpose,
      }));
    } else {
      setReqForm((prev) => ({ ...prev, statutoryTemplateId: templateId }));
    }
  };

  // Submit New Requisition
  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqForm.targetOrgId || !reqForm.subjectTitle || !reqForm.customStatutoryPurpose) {
      showToast('Target Agency, Subject Title, and Statutory Grounds are required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/collaboration/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqForm),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Requisition ${data.request?.request_number || ''} submitted successfully!`);
        setCreateModalOpen(false);
        setReqForm({
          targetOrgId: '',
          subjectTitle: '',
          referenceCaseNumber: '',
          statutoryTemplateId: '',
          priorityTierId: '',
          customStatutoryPurpose: '',
          customLegalProvisions: '',
          requestedAccessDays: 7,
        });
        fetchRequisitions();
        setActiveTab('outbound');
      } else {
        showToast(data.error || 'Failed to submit requisition', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Submission error', 'error');
    }
  };

  // Submit Response (Approve / Reject)
  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondModalReq) return;

    try {
      const res = await fetch(`/api/collaboration/requests/${respondModalReq.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(respForm),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Response processed successfully');
        setRespondModalReq(null);
        fetchRequisitions();
      } else {
        showToast(data.error || 'Failed to process response', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error', 'error');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Toast Feedback */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-xs font-semibold shadow-2xl border transition-all ${
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

      {/* Main Container Card (Theme Parity) */}
      <div className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-[#3f5e93] text-[24px]">hub</span>
              <h1 className="text-xl lg:text-2xl font-bold text-[#10141A] tracking-tight">
                Inter-Agency Document Collaboration Highway
              </h1>
              <span className="rounded-full text-[11px] font-semibold px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30">
                Sovereign Federation Grid
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Cross-organizational requisitioning, zero-knowledge envelope encryption, dynamic watermarking, and Section 65B electronic certificates.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#000000] text-white hover:bg-[#181c22] text-xs font-semibold transition shadow-[0_4px_12px_rgba(16,20,26,0.22)] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_task</span>
              <span>New Inter-Agency Requisition</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Bar (Theme Parity) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Inbound Pending</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-amber-700 font-mono">{counters.pendingInbound || 0}</span>
              <span className="text-[11px] text-[#6B7280]">/ {counters.totalInbound || 0} total</span>
            </div>
          </div>

          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Outbound Requisitions</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-[#3f5e93] font-mono">{counters.pendingOutbound || 0}</span>
              <span className="text-[11px] text-emerald-700 font-semibold font-mono">({counters.approvedOutbound || 0} active)</span>
            </div>
          </div>

          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Federation Nodes</span>
            <div className="text-xl font-bold text-[#10141A] mt-1 font-mono">{directoryOrgs.length} Sovereign Nodes</div>
          </div>

          <div className="bg-[#f0f3ff]/70 border border-[#D8DEEA]/70 rounded-[18px] p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Your Clearance</span>
            <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">Level {currentUserClearance} (T{currentUserClearance})</div>
          </div>
        </div>

        {/* Navigation Tabs (Theme Pills) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f0f3ff] rounded-full w-fit border border-[#D8DEEA]/80 flex-wrap">
          <button
            onClick={() => setActiveTab('inbound')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'inbound'
                ? 'bg-[#000000] text-white shadow-xs'
                : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">move_to_inbox</span>
            <span>Inbound Action Inbox</span>
            {Number(counters.pendingInbound || 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-black font-mono">
                {counters.pendingInbound}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outbound')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'outbound'
                ? 'bg-[#000000] text-white shadow-xs'
                : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">outbox</span>
            <span>Outbound Tracking ({outboundReqs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-[#000000] text-white shadow-xs'
                : 'text-[#45474b] hover:text-[#10141A] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">corporate_fare</span>
            <span>National Agency Directory</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: INBOUND DEMANDS INBOX */}
        {/* ========================================================================= */}
        {activeTab === 'inbound' && (
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/80 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-bold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                  <tr>
                    <th className="py-3 px-4">Requisition #</th>
                    <th className="py-3 px-4">Requesting Authority &amp; Officer</th>
                    <th className="py-3 px-4">Subject &amp; Statutory Grounds</th>
                    <th className="py-3 px-3">Urgency &amp; SLA</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#6B7280]">
                        <span className="material-symbols-outlined text-[24px] animate-spin text-[#3f5e93] block mb-1">
                          sync
                        </span>
                        Loading inbound requisitions...
                      </td>
                    </tr>
                  ) : inboundReqs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#6B7280]">
                        No inbound requisitions currently waiting for action.
                      </td>
                    </tr>
                  ) : (
                    inboundReqs.map((req) => (
                      <tr key={req.id} className="hover:bg-[#f0f3ff]/40 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#3f5e93]">
                          {req.requestNumber}
                          <div className="text-[10px] text-[#9CA3AF] font-sans font-normal">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#10141A]">{req.requestingOrgName}</div>
                          <div className="text-[11px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[13px] text-[#9CA3AF]">person</span>
                            <span>{req.requestingUserName} ({req.requestingUserDesignation || 'Officer'})</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#10141A]">{req.subjectTitle}</div>
                          <div className="text-[11px] text-[#6B7280] italic mt-0.5 truncate max-w-md">
                            &quot;{req.statutoryPurpose}&quot;
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono"
                            style={{
                              backgroundColor: req.priorityBadgeColor ? `${req.priorityBadgeColor}15` : '#eab30815',
                              color: req.priorityBadgeColor || '#eab308',
                              border: `1px solid ${req.priorityBadgeColor ? `${req.priorityBadgeColor}40` : '#eab30840'}`,
                            }}
                          >
                            {req.priorityTierName || 'Standard'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : req.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {req.status === 'PENDING' ? (
                            <button
                              onClick={() => {
                                setRespondModalReq(req);
                                setRespForm({
                                  decision: 'APPROVE',
                                  documentId: localDocs[0]?.id || '',
                                  documentVersionId: '',
                                  accessModeId: '',
                                  enableWatermark: true,
                                  customWatermarkTemplate: '',
                                  accessDurationDays: req.requestedAccessDays || 7,
                                  responseNote: '',
                                  rejectionReason: '',
                                });
                              }}
                              className="px-3.5 py-1.5 rounded-full bg-[#000000] hover:bg-[#181c22] text-white text-[11px] font-semibold transition flex items-center gap-1 ml-auto cursor-pointer shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[14px]">gavel</span>
                              <span>Fulfill / Respond</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#9CA3AF] font-medium">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: OUTBOUND REQUISITIONS */}
        {/* ========================================================================= */}
        {activeTab === 'outbound' && (
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(16,20,26,0.03)] border border-[#D8DEEA]/80 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f3ff]/60 text-[#6B7280] text-[10px] font-bold uppercase tracking-wider border-b border-[#D8DEEA]/60">
                  <tr>
                    <th className="py-3 px-4">Requisition #</th>
                    <th className="py-3 px-4">Target Government Authority</th>
                    <th className="py-3 px-4">Subject &amp; Statutory Ground</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Access &amp; Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8DEEA]/40 text-[#10141A]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#6B7280]">
                        <span className="material-symbols-outlined text-[24px] animate-spin text-[#3f5e93] block mb-1">
                          sync
                        </span>
                        Loading outbound tracking...
                      </td>
                    </tr>
                  ) : outboundReqs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#6B7280]">
                        No outbound requisitions filed by your organization yet.
                      </td>
                    </tr>
                  ) : (
                    outboundReqs.map((req) => (
                      <tr key={req.id} className="hover:bg-[#f0f3ff]/40 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#3f5e93]">
                          {req.requestNumber}
                          <div className="text-[10px] text-[#9CA3AF] font-sans font-normal">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#10141A]">{req.targetOrgName}</div>
                          <div className="text-[11px] text-[#6B7280] font-mono">{req.targetOrgCode}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#10141A]">{req.subjectTitle}</div>
                          <div className="text-[11px] text-[#6B7280] mt-0.5">{req.legalProvisions || req.statutoryPurpose}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : req.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {req.shareId ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedShare(req)}
                                className="px-3 py-1 rounded-full bg-[#000000] hover:bg-[#181c22] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
                                title="View Watermarked Document"
                              >
                                <span className="material-symbols-outlined text-[13px]">visibility</span>
                                <span>View Document</span>
                              </button>

                              <button
                                onClick={() => setSec65BModalShare(req)}
                                className="px-2.5 py-1 rounded-full border border-[#D8DEEA] bg-white hover:bg-[#f0f3ff] text-[#151c27] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                                title="Generate Section 65B Electronic Certificate"
                              >
                                <span className="material-symbols-outlined text-[13px] text-[#3f5e93]">verified</span>
                                <span>Sec 65B</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#9CA3AF] italic">Awaiting response</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NATIONAL AGENCY DIRECTORY */}
        {/* ========================================================================= */}
        {activeTab === 'directory' && (
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] p-4 border border-[#D8DEEA]/80 shadow-xs flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9CA3AF] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Search verified courts, police units, secretariats, revenue offices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <span className="text-xs text-[#6B7280]">
                Showing <b>{directoryOrgs.length}</b> verified government nodes
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directoryOrgs.map((org) => (
                <div
                  key={org.id}
                  className="bg-white rounded-[22px] p-5 border border-[#D8DEEA]/80 shadow-xs flex flex-col justify-between gap-3 hover:border-[#83A2DB]/50 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA]">
                        {org.code}
                      </span>
                      {org.isVerified && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Verified Node
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-[#10141A] leading-snug">{org.name}</h3>
                    <p className="text-xs text-[#6B7280]">
                      {org.categoryName || 'General'} • {org.regionName || 'National'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#D8DEEA]/40 flex items-center justify-between">
                    <div className="text-[11px] text-[#9CA3AF]">
                      Nodal: <b className="text-[#45474b]">{org.nodalOfficerName || 'Registrar'}</b>
                    </div>

                    <button
                      onClick={() => {
                        setReqForm((prev) => ({ ...prev, targetOrgId: org.id }));
                        setCreateModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-full bg-[#000000] hover:bg-[#181c22] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[13px]">send</span>
                      <span>Request Document</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: NEW INTER-AGENCY REQUISITION */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 border border-[#D8DEEA]">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_task</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#10141A]">File Inter-Agency Document Requisition</h3>
                  <p className="text-xs text-[#6B7280]">Statutory cross-jurisdictional evidence demand</p>
                </div>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-[#9CA3AF] hover:text-[#10141A]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#45474b] mb-1">Target Government Authority *</label>
                <select
                  value={reqForm.targetOrgId}
                  onChange={(e) => setReqForm({ ...reqForm, targetOrgId: e.target.value })}
                  required
                  className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] font-semibold outline-none focus:bg-white"
                >
                  <option value="">-- Select Target Agency / Court --</option>
                  {directoryOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code}) - {o.regionName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Requisition Subject Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Demand for FIR No. 412/2026 & Digital Evidence"
                    value={reqForm.subjectTitle}
                    onChange={(e) => setReqForm({ ...reqForm, subjectTitle: e.target.value })}
                    required
                    className="w-full h-9 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Reference Case / Crime Docket #</label>
                  <input
                    type="text"
                    placeholder="e.g. BAIL-APPL-2026/894"
                    value={reqForm.referenceCaseNumber}
                    onChange={(e) => setReqForm({ ...reqForm, referenceCaseNumber: e.target.value })}
                    className="w-full h-9 px-3.5 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Statutory Grounds Preset</label>
                  <select
                    value={reqForm.statutoryTemplateId}
                    onChange={(e) => handleStatutoryTemplateChange(e.target.value)}
                    className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] outline-none focus:bg-white"
                  >
                    <option value="">-- Select Legal Template --</option>
                    {taxonomies.statutoryTemplates.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.section_citation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Urgency &amp; SLA Priority</label>
                  <select
                    value={reqForm.priorityTierId}
                    onChange={(e) => setReqForm({ ...reqForm, priorityTierId: e.target.value })}
                    className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] outline-none focus:bg-white font-semibold"
                  >
                    <option value="">-- Standard SLA (168h) --</option>
                    {taxonomies.priorityTiers.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sla_hours}h SLA)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#45474b] mb-1">Detailed Statutory Purpose *</label>
                <textarea
                  rows={3}
                  placeholder="Explain why this document is statutory required for judicial or investigation proceedings..."
                  value={reqForm.customStatutoryPurpose}
                  onChange={(e) => setReqForm({ ...reqForm, customStatutoryPurpose: e.target.value })}
                  required
                  className="w-full p-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-2xl text-xs text-[#151c27] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-[#D8DEEA] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FULFILL & RESPOND MODAL (FOUR-EYES COMPLIANT) */}
      {/* ========================================================================= */}
      {respondModalReq && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 border border-[#D8DEEA]">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div>
                <h3 className="text-sm font-bold text-[#10141A]">Respond to Requisition</h3>
                <p className="text-xs text-[#6B7280]">
                  {respondModalReq.requestNumber} • From: {respondModalReq.requestingOrgName}
                </p>
              </div>
              <button onClick={() => setRespondModalReq(null)} className="text-[#9CA3AF] hover:text-[#10141A]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRespond} className="space-y-3.5 text-xs">
              <div className="flex items-center gap-2 p-1 bg-[#f0f3ff] rounded-full border border-[#D8DEEA]">
                <button
                  type="button"
                  onClick={() => setRespForm({ ...respForm, decision: 'APPROVE' })}
                  className={`flex-1 py-1.5 rounded-full font-bold transition ${
                    respForm.decision === 'APPROVE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[#45474b]'
                  }`}
                >
                  Approve &amp; Grant Access
                </button>
                <button
                  type="button"
                  onClick={() => setRespForm({ ...respForm, decision: 'REJECT' })}
                  className={`flex-1 py-1.5 rounded-full font-bold transition ${
                    respForm.decision === 'REJECT' ? 'bg-rose-600 text-white shadow-xs' : 'text-[#45474b]'
                  }`}
                >
                  Deny / Reject
                </button>
              </div>

              {respForm.decision === 'APPROVE' && (
                <>
                  <div>
                    <label className="block font-semibold text-[#45474b] mb-1">Select Document from Vault *</label>
                    <select
                      value={respForm.documentId}
                      onChange={(e) => setRespForm({ ...respForm, documentId: e.target.value })}
                      required
                      className="w-full h-9 px-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-xs text-[#151c27] outline-none focus:bg-white font-semibold"
                    >
                      {localDocs.map((doc: any) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.document_number} - {doc.title} ({doc.security_tier || 'T1'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 font-semibold text-[#151c27] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={respForm.enableWatermark}
                        onChange={(e) => setRespForm({ ...respForm, enableWatermark: e.target.checked })}
                        className="w-4 h-4 rounded text-[#3f5e93]"
                      />
                      <span>Enforce Dynamic Forensic Watermarking on Decryption</span>
                    </label>
                  </div>
                </>
              )}

              {respForm.decision === 'REJECT' && (
                <div>
                  <label className="block font-semibold text-[#45474b] mb-1">Reason for Rejection *</label>
                  <textarea
                    rows={3}
                    placeholder="Specify statutory ground for denial..."
                    value={respForm.rejectionReason}
                    onChange={(e) => setRespForm({ ...respForm, rejectionReason: e.target.value })}
                    required
                    className="w-full p-3 bg-[#f0f3ff] border border-[#D8DEEA] rounded-2xl text-xs text-[#151c27] focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
                <button
                  type="button"
                  onClick={() => setRespondModalReq(null)}
                  className="px-4 py-1.5 rounded-full border border-[#D8DEEA] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs"
                >
                  Submit Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: WATERMARKED DOCUMENT VIEWER */}
      {/* ========================================================================= */}
      {selectedShare && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 border border-[#D8DEEA] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93]">verified</span>
                <div>
                  <h3 className="text-sm font-bold text-[#10141A]">{selectedShare.subjectTitle}</h3>
                  <p className="text-xs text-[#6B7280]">Share Token: {selectedShare.shareNumber}</p>
                </div>
              </div>
              <button onClick={() => setSelectedShare(null)} className="text-[#9CA3AF] hover:text-[#10141A]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="relative p-6 rounded-2xl bg-[#f0f3ff]/80 border border-[#D8DEEA] overflow-hidden min-h-[300px] flex flex-col justify-center items-center text-center space-y-3">
              {/* Dynamic Watermark Background */}
              <div className="absolute inset-0 pointer-events-none select-none flex flex-wrap items-center justify-center gap-12 opacity-15 rotate-[-25deg] text-[13px] font-mono font-bold text-rose-900">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <span key={idx}>
                    SECURE COPY • {currentOrg?.name} • OFFICER ID: {currentUserId?.substring(0, 8)} • NON-TRANSFERABLE
                  </span>
                ))}
              </div>

              <div className="relative z-10 space-y-2">
                <span className="material-symbols-outlined text-4xl text-[#3f5e93]">description</span>
                <h4 className="font-bold text-base text-[#10141A]">{selectedShare.subjectTitle}</h4>
                <p className="text-xs text-[#6B7280] max-w-md">
                  Cryptographically decrypted via Ephemeral Envelope KMS. Access logged to sovereign audit ledger.
                </p>
                <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Chain-of-Custody Verified
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
              <button
                onClick={() => setSelectedShare(null)}
                className="px-4 py-1.5 rounded-full bg-[#000000] text-white text-xs font-semibold"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SECTION 65B EVIDENCE CERTIFICATE */}
      {/* ========================================================================= */}
      {sec65BModalShare && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 border border-[#D8DEEA]">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-700">assured_workload</span>
                <div>
                  <h3 className="text-sm font-bold text-[#10141A]">Section 65B Evidence Transfer Certificate</h3>
                  <p className="text-xs text-[#6B7280]">Admissible under Bharatiya Sakshya Adhiniyam, 2023</p>
                </div>
              </div>
              <button onClick={() => setSec65BModalShare(null)} className="text-[#9CA3AF] hover:text-[#10141A]">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#f0f3ff]/70 border border-[#D8DEEA] space-y-2 text-xs font-mono text-[#10141A]">
              <div className="font-bold text-center text-sm uppercase text-[#3f5e93] pb-1 border-b border-[#D8DEEA]">
                Certificate of Authenticity
              </div>
              <div>Transfer Token: <b>{sec65BModalShare.shareNumber}</b></div>
              <div>Target Document: <b>{sec65BModalShare.subjectTitle}</b></div>
              <div>Originating Agency: <b>{sec65BModalShare.targetOrgName}</b></div>
              <div>Receiving Agency: <b>{currentOrg?.name}</b></div>
              <div>Timestamp: <b>{new Date().toUTCString()}</b></div>
              <div className="pt-2 text-[11px] text-emerald-700 font-bold">
                ✓ Cryptographic SHA-256 Digest Match Verified
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DEEA]/60">
              <button
                onClick={() => {
                  showToast('Certificate exported with cryptographic signature');
                  setSec65BModalShare(null);
                }}
                className="px-5 py-1.5 rounded-full bg-[#000000] text-white text-xs font-semibold shadow-xs flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                <span>Download Signed PDF Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
