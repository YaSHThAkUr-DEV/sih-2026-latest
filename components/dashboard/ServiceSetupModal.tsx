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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md">
              <span className="material-symbols-outlined text-[22px]">domain_add</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                DMS-as-a-Service: Onboard New Government Office
              </h2>
              <p className="text-xs text-slate-400">
                Calibrate modular features, customized document classes, and initial administrator credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs shrink-0">
          {[
            { num: 1, label: 'Office Profile' },
            { num: 2, label: 'Feature Modules' },
            { num: 3, label: 'Document Classes' },
            { num: 4, label: 'Admin Setup' },
            { num: 5, label: 'Deploy & Report' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.num
                  ? 'bg-blue-600 text-white shadow-xs'
                  : step > s.num
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-300 text-slate-700'
              }`}>
                {step > s.num ? '✓' : s.num}
              </span>
              <span className={`hidden sm:inline font-semibold ${step === s.num ? 'text-slate-900' : 'text-slate-500'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-800 flex flex-col gap-5">
          
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[20px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: OFFICE PROFILE */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Step 1: Institutional Identification</h3>
                <p className="text-xs text-slate-500">
                  Specify the government body or office requesting this DMS service.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Office / Authority Name *</label>
                  <input
                    type="text"
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                    placeholder="e.g. Palghar District Traffic Branch or Gram Panchayat Vikramgad"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Official title of the institution</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Office Identifier Code *</label>
                  <input
                    type="text"
                    value={officeCode}
                    onChange={(e) => setOfficeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PLG_TRAFFIC or GP_VKR"
                    className="px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Unique alphanumeric code (used in docket numbers)</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Jurisdiction & Description</label>
                <textarea
                  rows={2}
                  value={officeDescription}
                  onChange={(e) => setOfficeDescription(e.target.value)}
                  placeholder="e.g. District division responsible for public traffic enforcement, challan receipts, and revenue reconciliation."
                  className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* STEP 2: MODULAR FEATURE SELECTION */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Step 2: Modular Feature Toggles</h3>
                <p className="text-xs text-slate-500">
                  Select which modules should be active for this office. Disabled modules will be completely hidden from their dashboard.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl flex-wrap">
                <span className="text-xs font-bold text-blue-900">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('RECEIPTS')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-md shadow-2xs transition"
                >
                  ⚡ Revenue & Payment Receipts Only
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('ARCHIVE')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-md shadow-2xs transition"
                >
                  🏛️ Archives & Public Grievance
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('FULL')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-md shadow-2xs transition"
                >
                  🛡️ Complete Evidentiary DMS
                </button>
              </div>

              {/* Feature Modules List */}
              <div className="flex flex-col gap-3">
                {(Object.keys(MODULE_DESCRIPTIONS) as Array<keyof OrganizationFeatureConfig>).map((key) => {
                  const mod = MODULE_DESCRIPTIONS[key];
                  const isChecked = features[key];
                  return (
                    <div
                      key={key}
                      onClick={() => setFeatures({ ...features, [key]: !isChecked })}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                        isChecked
                          ? 'bg-blue-50/40 border-blue-300'
                          : 'bg-white border-slate-200 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by container
                          className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-blue-600">{mod.icon}</span>
                            <span className="text-xs font-bold text-slate-900">{mod.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
                          <span className="text-[10px] text-slate-400 mt-1">Recommended for: {mod.recommendedFor}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                        isChecked ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
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
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Step 3: Document Types & Classification</h3>
                <p className="text-xs text-slate-500">
                  Define what types of documents this office handles (e.g. Challans, Receipts, Orders, Meeting Minutes).
                </p>
              </div>

              {/* Add New Document Type */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">Document Type Name</label>
                  <input
                    type="text"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="e.g. Traffic Challan Receipt"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="w-full sm:w-36 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">Short Code</label>
                  <input
                    type="text"
                    value={newDocCode}
                    onChange={(e) => setNewDocCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CHALLAN"
                    className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg uppercase focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddDocType}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 shadow-xs transition"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add Class</span>
                </button>
              </div>

              {/* Current Document Types */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-700">Configured Document Classes ({docTypes.length}):</span>
                {docTypes.map((dt, idx) => (
                  <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                        {dt.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-900">{dt.name}</span>
                      <span className="text-[11px] text-slate-400 hidden md:inline">&bull; {dt.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocType(idx)}
                      className="text-slate-400 hover:text-red-600 transition"
                      title="Remove class"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: INITIAL ADMIN USER */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Step 4: Initial Institutional Administrator</h3>
                <p className="text-xs text-slate-500">
                  Create the primary administrator account for this office to manage users and calibrate local rules.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Administrator Full Name *</label>
                  <input
                    type="text"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kadam"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Official Email *</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="e.g. admin.traffic@palghar.gov.in"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Initial Password *</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Strong password for initial login"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Employee / Officer Code</label>
                  <input
                    type="text"
                    value={adminEmployeeCode}
                    onChange={(e) => setAdminEmployeeCode(e.target.value)}
                    placeholder={`e.g. ${officeCode || 'OFF'}-ADM-01`}
                    className="px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Designation</label>
                <input
                  type="text"
                  value={adminDesignation}
                  onChange={(e) => setAdminDesignation(e.target.value)}
                  className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & DEPLOY / RESULT */}
          {step === 5 && result && (
            <div className="flex flex-col gap-5 items-center justify-center py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>

              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="text-base font-bold text-slate-900">Office Instance Provisioned Successfully!</h3>
                <p className="text-xs text-slate-600">{result.message}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full max-w-md text-left text-xs font-mono flex flex-col gap-2">
                <div><strong>Office Name:</strong> {result.organization.name}</div>
                <div><strong>Office Code:</strong> <span className="text-blue-700">{result.organization.code}</span></div>
                <div><strong>Admin Email:</strong> {result.adminUser.email}</div>
                <div><strong>Admin Code:</strong> {result.adminUser.employeeCode}</div>
                <div><strong>Assigned Role:</strong> {result.adminUser.role}</div>
                <div><strong>Document Classes:</strong> {result.documentTypesCount} initialized</div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          {step === 5 ? (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition"
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
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
              >
                Back
              </button>

              <div className="flex items-center gap-2">
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 1 && (!officeName.trim() || !officeCode.trim())) {
                        setError('Office name and office code are required.');
                        return;
                      }
                      setError(null);
                      setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4 | 5);
                    }}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={loading || !adminEmail.trim() || !adminPassword.trim()}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                        <span>Provisioning Instance...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                        <span>Deploy & Initialize Office</span>
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
