'use client';

import React, { useState } from 'react';
import {
  OrganizationFeatureConfig,
  DEFAULT_FULL_FEATURES,
  MINIMAL_RECEIPTS_FEATURES,
  MODULE_DESCRIPTIONS,
} from '@/lib/service/service-config-shared';

interface ProvisionResultData {
  success: boolean;
  organization: {
    id: string;
    name: string;
    code: string;
    features: OrganizationFeatureConfig;
  };
  adminUser: {
    id: string;
    fullName: string;
    email: string;
    employeeCode: string;
    role: string;
  };
  departmentsCount: number;
  documentTypesCount: number;
  message: string;
}

interface ServiceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: ProvisionResultData) => void;
}

export function ServiceSetupModal({ isOpen, onClose, onSuccess }: ServiceSetupModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResultData | null>(null);

  // Form State
  const [officeName, setOfficeName] = useState('');
  const [officeCode, setOfficeCode] = useState('');
  const [officeDescription, setOfficeDescription] = useState('');
  
  // Features State
  const [features, setFeatures] = useState<OrganizationFeatureConfig>({ ...DEFAULT_FULL_FEATURES });

  // Custom Document Types
  const [docTypes, setDocTypes] = useState<Array<{ name: string; code: string; description: string }>>([
    { name: 'Payment Receipt / Challan', code: 'RECEIPT', description: 'Revenue and collection receipts' },
    { name: 'Office Memorandum', code: 'OM', description: 'Administrative directives' },
    { name: 'Public Grievance Application', code: 'APPLICATION', description: 'Citizen representations' },
  ]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCode, setNewDocCode] = useState('');

  // Initial Admin User
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmployeeCode, setAdminEmployeeCode] = useState('');
  const [adminDesignation, setAdminDesignation] = useState('Institutional Administrator');

  if (!isOpen) return null;

  const handleApplyPreset = (type: 'FULL' | 'RECEIPTS' | 'ARCHIVE') => {
    if (type === 'FULL') {
      setFeatures({ ...DEFAULT_FULL_FEATURES });
    } else if (type === 'RECEIPTS') {
      setFeatures({ ...MINIMAL_RECEIPTS_FEATURES });
      setDocTypes([
        { name: 'Payment Receipt', code: 'PAY_RECEIPT', description: 'Official citizen fee and fine receipt' },
        { name: 'Cash / Bank Challan', code: 'CHALLAN', description: 'Government treasury bank deposit slip' },
        { name: 'Voucher & Bill', code: 'VOUCHER', description: 'Disbursement or refund verification record' },
      ]);
    } else if (type === 'ARCHIVE') {
      setFeatures({
        feature_approvals: false,
        feature_section_65b: false,
        feature_retention_holds: true,
        feature_blockchain: true,
        feature_deep_ocr: true,
      });
    }
  };

  const handleAddDocType = () => {
    if (!newDocName.trim() || !newDocCode.trim()) return;
    setDocTypes([
      ...docTypes,
      {
        name: newDocName.trim(),
        code: newDocCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_'),
        description: `Official ${newDocName.trim()}`,
      },
    ]);
    setNewDocName('');
    setNewDocCode('');
  };

  const handleRemoveDocType = (index: number) => {
    setDocTypes(docTypes.filter((_, i) => i !== index));
  };

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        officeName,
        officeCode,
        officeDescription,
        features,
        documentTypes: docTypes,
        adminUser: {
          fullName: adminFullName || `${officeName} Admin`,
          email: adminEmail,
          password: adminPassword,
          employeeCode: adminEmployeeCode || `${officeCode}-ADM-01`,
          designation: adminDesignation,
        },
      };

      const res = await fetch('/api/service/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to provision office instance');
      }

      setResult(data);
      setStep(5);
      if (onSuccess) onSuccess(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Provisioning error occurred';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-[26px] shadow-[0_24px_60px_rgba(16,20,26,0.18)] border border-[#D8DEEA]/80 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#D8DEEA]/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/nirman-logo.png"
              alt="NIRMAN DMS"
              className="w-10 h-10 object-contain rounded-xl border border-slate-200 p-0.5 bg-white shrink-0 shadow-xs"
            />
            <div>
              <h2 className="text-base font-semibold text-[#10141A] tracking-tight">
                NIRMAN DMS-as-a-Service: Onboard New Organization
              </h2>
              <p className="text-xs text-[#6B7280]">
                Calibrate modular features, customized document classes, and initial administrator credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f0f3ff] text-[#6B7280] flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="bg-[#f0f3ff]/40 border-b border-[#D8DEEA]/60 px-6 py-3 flex items-center justify-between text-xs shrink-0">
          {[
            { num: 1, label: 'Profile' },
            { num: 2, label: 'Feature Modules' },
            { num: 3, label: 'Document Classes' },
            { num: 4, label: 'Admin Setup' },
            { num: 5, label: 'Deploy' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                step === s.num
                  ? 'bg-[#000000] text-white shadow-xs'
                  : step > s.num
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#E9ECF4] text-[#6B7280]'
              }`}>
                {step > s.num ? '✓' : s.num}
              </span>
              <span className={`hidden sm:inline font-medium ${step === s.num ? 'text-[#10141A]' : 'text-[#6B7280]'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-[#10141A] space-y-5">
          
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-[16px] text-rose-700 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: OFFICE PROFILE */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#10141A]">Institutional Identification</h3>
                <p className="text-xs text-[#6B7280]">
                  Specify the government body or organization requesting this DMS instance.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#10141A]">Authority / Office Name *</label>
                  <input
                    type="text"
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                    placeholder="e.g. Central Traffic Enforcement Division"
                    className="w-full h-8 px-3 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-full text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                  />
                  <span className="text-[10px] text-[#9CA3AF]">Official title of the institution</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#10141A]">Identifier Code *</label>
                  <input
                    type="text"
                    value={officeCode}
                    onChange={(e) => setOfficeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CTED_CENTRAL"
                    className="w-full h-8 px-3 text-xs font-mono bg-[#f0f3ff] border border-[#D8DEEA] rounded-full uppercase text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                  />
                  <span className="text-[10px] text-[#9CA3AF]">Unique alphanumeric code used in records</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#10141A]">Jurisdiction & Description</label>
                <textarea
                  rows={2}
                  value={officeDescription}
                  onChange={(e) => setOfficeDescription(e.target.value)}
                  placeholder="e.g. District division responsible for public traffic enforcement, challan receipts, and revenue reconciliation."
                  className="w-full p-3 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-[16px] text-[#151c27] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>
            </div>
          )}

          {/* STEP 2: MODULAR FEATURE SELECTION */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#10141A]">Modular Feature Toggles</h3>
                <p className="text-xs text-[#6B7280]">
                  Select which modules should be active for this office. Disabled modules will be hidden.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 p-3 bg-[#f0f3ff]/60 border border-[#D8DEEA]/60 rounded-[16px] flex-wrap">
                <span className="text-xs font-medium text-[#10141A]">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('RECEIPTS')}
                  className="px-3 py-1 text-xs font-medium bg-white hover:bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA] rounded-full transition shadow-xs"
                >
                  Revenue & Receipts Only
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('ARCHIVE')}
                  className="px-3 py-1 text-xs font-medium bg-white hover:bg-[#f0f3ff] text-[#3f5e93] border border-[#D8DEEA] rounded-full transition shadow-xs"
                >
                  Archives & Public Records
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('FULL')}
                  className="px-3 py-1 text-xs font-medium bg-[#000000] hover:bg-[#181c22] text-white rounded-full transition shadow-xs"
                >
                  Complete Evidentiary Suite
                </button>
              </div>

              {/* Feature Modules List */}
              <div className="space-y-2.5">
                {(Object.keys(MODULE_DESCRIPTIONS) as Array<keyof OrganizationFeatureConfig>).map((key) => {
                  const mod = MODULE_DESCRIPTIONS[key];
                  const isChecked = features[key];
                  return (
                    <div
                      key={key}
                      onClick={() => setFeatures({ ...features, [key]: !isChecked })}
                      className={`p-3.5 rounded-[18px] border transition cursor-pointer flex items-start justify-between gap-3 ${
                        isChecked
                          ? 'bg-[#f0f3ff]/80 border-[#83A2DB]/40'
                          : 'bg-white border-[#D8DEEA]/60 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 w-4 h-4 text-[#3f5e93] rounded border-[#D8DEEA] cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[#3f5e93]">{mod.icon}</span>
                            <span className="text-xs font-semibold text-[#10141A]">{mod.label}</span>
                          </div>
                          <p className="text-xs text-[#6B7280]">{mod.description}</p>
                          <span className="text-[10px] text-[#9CA3AF]">Recommended for: {mod.recommendedFor}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full uppercase shrink-0 ${
                        isChecked ? 'bg-[#000000] text-white' : 'bg-[#E9ECF4] text-[#6B7280]'
                      }`}>
                        {isChecked ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: DOCUMENT CLASSES */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#10141A]">Document Types & Classification</h3>
                <p className="text-xs text-[#6B7280]">
                  Define what types of records this office handles.
                </p>
              </div>

              {/* Add New Type */}
              <div className="p-3.5 bg-[#f0f3ff]/40 border border-[#D8DEEA]/60 rounded-[18px] flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[11px] font-medium text-[#6B7280]">Document Type Name</label>
                  <input
                    type="text"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="e.g. Traffic Challan Receipt"
                    className="w-full h-8 px-3 text-xs bg-white border border-[#D8DEEA] rounded-full focus:outline-none"
                  />
                </div>
                <div className="w-full sm:w-36 space-y-1">
                  <label className="text-[11px] font-medium text-[#6B7280]">Short Code</label>
                  <input
                    type="text"
                    value={newDocCode}
                    onChange={(e) => setNewDocCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CHALLAN"
                    className="w-full h-8 px-3 text-xs font-mono bg-white border border-[#D8DEEA] rounded-full uppercase focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddDocType}
                  className="px-4 py-1.5 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-medium rounded-full flex items-center justify-center gap-1 shadow-xs transition"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add Class</span>
                </button>
              </div>

              {/* Current Types List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#10141A]">Configured Document Classes ({docTypes.length}):</span>
                {docTypes.map((dt, idx) => (
                  <div key={idx} className="p-3 bg-white border border-[#D8DEEA]/60 rounded-[16px] flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#f0f3ff] text-[#3f5e93] rounded-full border border-[#D8DEEA]">
                        {dt.code}
                      </span>
                      <span className="text-xs font-medium text-[#10141A]">{dt.name}</span>
                      <span className="text-[11px] text-[#9CA3AF] hidden md:inline">• {dt.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocType(idx)}
                      className="w-6 h-6 rounded-full hover:bg-rose-50 text-[#9CA3AF] hover:text-rose-600 flex items-center justify-center transition"
                      title="Remove class"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: INITIAL ADMIN USER */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#10141A]">Initial Administrator Account</h3>
                <p className="text-xs text-[#6B7280]">
                  Create the primary administrator account for this office.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#10141A]">Administrator Name *</label>
                  <input
                    type="text"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kadam"
                    className="w-full h-8 px-3 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-full focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#10141A]">Official Email *</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="e.g. admin.traffic@dms.gov.in"
                    className="w-full h-8 px-3 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-full focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#10141A]">Initial Password *</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Initial secure password"
                    className="w-full h-8 px-3 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-full focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#10141A]">Officer Code</label>
                  <input
                    type="text"
                    value={adminEmployeeCode}
                    onChange={(e) => setAdminEmployeeCode(e.target.value)}
                    placeholder={`e.g. ${officeCode || 'OFF'}-ADM-01`}
                    className="w-full h-8 px-3 text-xs font-mono bg-[#f0f3ff] border border-[#D8DEEA] rounded-full focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#10141A]">Designation</label>
                <input
                  type="text"
                  value={adminDesignation}
                  onChange={(e) => setAdminDesignation(e.target.value)}
                  className="w-full h-8 px-3 text-xs bg-[#f0f3ff] border border-[#D8DEEA] rounded-full focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 5: DEPLOYED RESULT */}
          {step === 5 && result && (
            <div className="flex flex-col gap-4 items-center justify-center py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[32px]">check_circle</span>
              </div>

              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-semibold text-[#10141A]">Instance Provisioned Successfully</h3>
                <p className="text-xs text-[#6B7280]">{result.message}</p>
              </div>

              <div className="bg-[#f0f3ff]/60 border border-[#D8DEEA]/60 rounded-[20px] p-4 w-full max-w-md text-left text-xs font-mono space-y-1.5">
                <div><strong>Office Name:</strong> {result.organization.name}</div>
                <div><strong>Office Code:</strong> <span className="text-[#3f5e93] font-bold">{result.organization.code}</span></div>
                <div><strong>Admin Email:</strong> {result.adminUser.email}</div>
                <div><strong>Admin Code:</strong> {result.adminUser.employeeCode}</div>
                <div><strong>Role:</strong> {result.adminUser.role}</div>
                <div><strong>Classes Initialized:</strong> {result.documentTypesCount} types</div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#D8DEEA]/60 flex items-center justify-between shrink-0">
          {step === 5 ? (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-medium rounded-full transition"
              >
                Done & Close
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5)}
                disabled={step === 1}
                className="px-4 py-2 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] text-xs font-medium rounded-full disabled:opacity-40 transition"
              >
                Back
              </button>

              <div className="flex items-center gap-2">
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 1 && (!officeName.trim() || !officeCode.trim())) {
                        setError('Office name and code are required.');
                        return;
                      }
                      setError(null);
                      setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4 | 5);
                    }}
                    className="px-5 py-2 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-medium rounded-full transition flex items-center gap-1 shadow-[0_6px_18px_rgba(16,20,26,0.22)]"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={loading || !adminEmail.trim() || !adminPassword.trim()}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-full transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                        <span>Deploy Instance</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
