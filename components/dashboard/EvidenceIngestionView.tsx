'use client';

import React, { useState, useEffect, useRef } from 'react';

interface EvidenceIngestionProps {
  onSuccess: () => void;
  onCancel: () => void;
  userDepartment?: string;
  userDesignation?: string;
  userEmployeeCode?: string;
}

interface TaxonomyDocType {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface TaxonomyDepartment {
  id: string;
  name: string;
  code: string;
}

interface TaxonomySecurityLevel {
  id: string;
  name: string;
  code: string;
  rank: number;
  isAccessible: boolean;
  approval_required: boolean;
}

export default function EvidenceIngestionView({
  onSuccess,
  onCancel,
  userDepartment = '',
  userDesignation = '',
  userEmployeeCode = '',
}: EvidenceIngestionProps) {
  // Staged File State
  const [file, setFile] = useState<File | null>(null);
  const [sha256Hash, setSha256Hash] = useState<string>('');
  const [isHashing, setIsHashing] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Metadata Dossier State
  const [title, setTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docType, setDocType] = useState('OM');
  const [deptCode, setDeptCode] = useState('ADMIN');
  const [secTier, setSecTier] = useState('T2');
  const [docketRef, setDocketRef] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Dynamic Taxonomies
  const [docTypes, setDocTypes] = useState<TaxonomyDocType[]>([]);
  const [departments, setDepartments] = useState<TaxonomyDepartment[]>([]);
  const [securityLevels, setSecurityLevels] = useState<TaxonomySecurityLevel[]>([]);
  const [userMaxLevel, setUserMaxLevel] = useState<number>(3);

  // Execution Progress State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [progressSubtext, setProgressSubtext] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadReceipt, setUploadReceipt] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load dynamic taxonomies from API
  useEffect(() => {
    const fetchTaxonomies = async () => {
      try {
        const res = await fetch('/api/taxonomies');
        if (res.ok) {
          const data = await res.json();
          if (data.documentTypes && data.documentTypes.length > 0) {
            setDocTypes(data.documentTypes);
            setDocType(data.documentTypes[0].code);
          }
          if (data.departments && data.departments.length > 0) {
            setDepartments(data.departments);
            setDeptCode(data.departments[0].code);
          }
          if (data.securityLevels && data.securityLevels.length > 0) {
            setSecurityLevels(data.securityLevels);
            // Default to highest accessible or T2
            const accessible = data.securityLevels.filter((s: any) => s.isAccessible);
            if (accessible.length > 0) {
              setSecTier(accessible[Math.min(1, accessible.length - 1)].code);
            }
          }
          if (data.userMaxSecurityLevel !== undefined) {
            setUserMaxLevel(data.userMaxSecurityLevel);
          }
        }
      } catch (err) {
        console.warn('Failed to load taxonomies, using fallback defaults:', err);
      }
    };
    fetchTaxonomies();
  }, []);

  // Compute Client-Side SHA-256 Hash
  const computeSHA256 = async (inputFile: File): Promise<string> => {
    setIsHashing(true);
    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setSha256Hash(hashHex);
      return hashHex;
    } catch (err) {
      console.error('Failed to compute client-side SHA-256:', err);
      const fallback = 'sha256:pending_server_verification';
      setSha256Hash(fallback);
      return fallback;
    } finally {
      setIsHashing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' '));
      }
      await computeSHA256(selected);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      if (!title) {
        setTitle(dropped.name.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' '));
      }
      await computeSHA256(dropped);
    }
  };

  const handleCopyHash = () => {
    if (!sha256Hash) return;
    navigator.clipboard.writeText(sha256Hash).then(() => {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    });
  };

  const handleAutoGenerateNumber = () => {
    const year = new Date().getFullYear();
    const seq = Math.floor(1000 + Math.random() * 9000);
    const prefix = docType ? docType.substring(0, 4).toUpperCase() : 'GEN';
    setDocNumber(`DOC-${prefix}-${year}-${seq}`);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = newTagInput.trim();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setNewTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select or drop a valid document file.');
      return;
    }
    if (!title.trim()) {
      setUploadError('Document Title is required.');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    setProgressPercent(35);
    setProgressLabel('Verifying document integrity...');
    setProgressSubtext('Computing SHA-256 checksum for upload verification...');

    try {
      const year = new Date().getFullYear();
      const finalDocNumber = docNumber.trim() || `DOC-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('documentNumber', finalDocNumber);
      formData.append('docTypeCode', docType);
      formData.append('deptCode', deptCode);
      formData.append('secCode', secTier);
      formData.append('description', synopsis.trim());

      setProgressPercent(65);
      setProgressLabel('Encrypting with AES-256-GCM envelope...');
      setProgressSubtext('Generating unique Data Encryption Key (DEK)...');

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setProgressPercent(100);
      setProgressLabel('Upload completed and recorded!');
      setProgressSubtext('Document sealed and registered in database.');

      setUploadReceipt(data.document);
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred during document upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12 font-sans text-slate-800">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-5">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-50 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span className="text-[10px] font-bold uppercase text-slate-700 tracking-wider">
              Document Ingestion Studio
            </span>
            <span className="font-mono text-[11px] text-blue-700 font-semibold">
              Clearance Level {userMaxLevel} Max
            </span>
          </div>

          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors py-1.5 px-3 rounded hover:bg-slate-100 text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Return to Dashboard</span>
          </button>
        </div>

        <div className="flex flex-col gap-1 mt-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload &amp; Classify Document</h1>
          <p className="text-xs text-slate-500 max-w-4xl">
            Upload institutional records. Documents are verified with bit-exact SHA-256 hashes, envelope encrypted, and cataloged.
          </p>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">error</span>
          <div>
            <div className="font-bold">Upload Error</div>
            <div>{uploadError}</div>
          </div>
        </div>
      )}

      {/* 2. Success Receipt View */}
      {uploadReceipt ? (
        <div className="bg-white rounded-xl p-6 shadow-xs border border-emerald-200 flex flex-col gap-6">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3.5">
            <div className="w-9 h-9 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">verified</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">Document Uploaded Successfully!</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Your document has been encrypted, stored in bucket{' '}
                <code className="font-mono font-semibold">{uploadReceipt.minioBucket}</code>, and recorded in the system.
              </p>
            </div>
          </div>

          <div className="p-5 bg-slate-900 text-white rounded-xl font-mono text-xs space-y-2.5">
            <div className="text-blue-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800 pb-2">
              Upload Receipt
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Document Number</span>
                <span className="font-semibold text-white text-sm">{uploadReceipt.documentNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Title</span>
                <span className="font-semibold text-white">{uploadReceipt.title}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Encryption</span>
                <span className="text-white">AES-256-GCM</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Storage Key</span>
                <span className="text-emerald-400 truncate block">{uploadReceipt.minioObjectKey}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">File Size</span>
                <span className="text-white">{(uploadReceipt.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">SHA-256 Checksum</span>
              <span className="text-amber-300 break-all text-[11px] select-all font-semibold">{uploadReceipt.sha256Hash}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setUploadReceipt(null);
                setFile(null);
                setTitle('');
                setSha256Hash('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded transition"
            >
              + Upload Another Document
            </button>
            <button
              type="button"
              onClick={onSuccess}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-xs transition"
            >
              Return to Documents
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 3. File Upload Card */}
          <div className="bg-white rounded-xl p-6 shadow-xs border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Document File</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded">
                  INTEGRITY VERIFIED
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">MAX SIZE: 25 MB</span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group relative rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-600 bg-slate-50/70 hover:bg-blue-50/30 p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                disabled={isSubmitting}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
              </div>
              <div className="flex flex-col gap-1 items-center">
                <p className="text-sm font-bold text-slate-900">
                  Drag and drop your document here
                </p>
                <p className="text-xs text-slate-500">
                  or <span className="text-blue-600 font-semibold underline underline-offset-2">browse files</span>
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-full text-xs text-slate-500">
                <span className="material-symbols-outlined text-[15px] text-slate-400">description</span>
                <span>Supported: PDF, DOCX, TIFF, PNG, JPG (Max 25 MB)</span>
              </div>
            </div>

            {/* Staged File Preview Card */}
            {file && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">{file.name}</span>
                      <span className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>

                    {/* SHA-256 Digest String */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-500">SHA-256:</span>
                      <code className="font-mono text-[11px] text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded select-all truncate max-w-xl">
                        {isHashing ? 'Computing checksum...' : sha256Hash}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyHash}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
                        title="Copy Checksum"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {copiedHash ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setSha256Hash('');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition border border-red-200"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete_outline</span>
                    <span>Replace File</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Document Details Form */}
          <div className="bg-white rounded-xl p-6 shadow-xs border border-slate-200 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Document Classification &amp; Metadata</h2>
                <span className="text-xs text-slate-500">
                  Select official type, department, clearance tier, and record identifiers.
                </span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded">
                METADATA
              </span>
            </div>

            {/* Row 1: Document Title & Auto-Generating ID */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Document Title *</span>
                  <span className="text-slate-400 font-normal text-[11px]">Required</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Annual Budget Allocation Directive 2026-27"
                  className="h-9 px-3 bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded focus:bg-white focus:outline-none focus:border-blue-600 font-medium"
                />
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Record Number</label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateNumber}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">auto_fix_high</span> Auto-Generate
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="e.g., DOC-OM-2026-0921"
                    className="w-full h-9 pl-3 pr-8 bg-slate-50 border border-slate-300 font-mono text-xs text-slate-900 rounded focus:bg-white focus:outline-none focus:border-blue-600 font-medium"
                  />
                  <span className="material-symbols-outlined absolute right-2.5 text-blue-600 text-[18px]">verified</span>
                </div>
              </div>
            </div>

            {/* Row 2: Dynamic Document Type, Department, and Security Classification Tier */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Dynamic Document Type */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Document Type *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded focus:bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                >
                  {docTypes.length > 0 ? (
                    docTypes.map((dt) => (
                      <option key={dt.id} value={dt.code}>
                        {dt.name} ({dt.code})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="OM">Office Memorandum (OM)</option>
                      <option value="LETTER">Official Correspondence / Letter</option>
                      <option value="REPORT">Official Inspection / Audit Report</option>
                      <option value="NOTICE">Public Notice & Circular</option>
                      <option value="ORDER">Executive Order & Sanction</option>
                    </>
                  )}
                </select>
              </div>

              {/* Dynamic Department */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Department / Wing *</label>
                <select
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded focus:bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                >
                  {departments.length > 0 ? (
                    departments.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.name} ({d.code})
                      </option>
                    ))
                  ) : (
                    <option value="ADMIN">General Administration & Governance (ADMIN)</option>
                  )}
                </select>
              </div>

              {/* Dynamic Security Tier with Clearance Enforced */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Security Clearance Tier *</label>
                <select
                  value={secTier}
                  onChange={(e) => setSecTier(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded focus:bg-white focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
                >
                  {securityLevels.length > 0 ? (
                    securityLevels.map((sl) => (
                      <option
                        key={sl.id}
                        value={sl.code}
                        disabled={!sl.isAccessible}
                      >
                        {sl.code} — {sl.name} (Rank {sl.rank}) {!sl.isAccessible ? '🔒 Requires Clearance' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="T1">T1 — Public / Low (Rank 1)</option>
                      <option value="T2">T2 — Internal (Rank 2)</option>
                      <option value="T3">T3 — Confidential (Rank 3)</option>
                      <option value="T4">T4 — Sensitive (Rank 4)</option>
                      <option value="T5">T5 — Highly Sensitive (Rank 5)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Row 3: Description */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Description &amp; Summary</label>
                <span className="font-mono text-[10px] text-slate-400">OPTIONAL</span>
              </div>
              <textarea
                rows={3}
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Add a brief description or summary for search indexing..."
                className="p-3 bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded focus:bg-white focus:outline-none focus:border-blue-600 leading-relaxed font-medium"
              ></textarea>
            </div>
          </div>

          {/* 5. Live Ingestion Progress Bar */}
          {isSubmitting && (
            <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-blue-600 animate-spin text-[20px]">sync</span>
                  <span className="text-xs font-bold text-slate-900">{progressLabel}</span>
                </div>
                <span className="font-mono text-xs text-blue-600 font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                <span>{progressSubtext}</span>
                <span>STATUS: PROCESSING</span>
              </div>
            </div>
          )}

          {/* 6. Sticky Action Footer */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-4 z-30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <span className="text-xs font-bold text-slate-900">Clearance Active</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  Level {userMaxLevel} • {userDepartment || 'Institutional'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onCancel}
                className="px-4 py-2 rounded text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                <span>Upload Document</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
