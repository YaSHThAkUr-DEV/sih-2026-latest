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
  const [synopsis, setSynopsis] = useState('');

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
    setProgressSubtext('Computing bit-exact SHA-256 digest...');

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
      setProgressLabel('Upload completed and sealed!');
      setProgressSubtext('Document registered in database and GIN index updated.');

      setUploadReceipt(data.document);
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred during document upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12 font-sans text-[#151c27]">
      {/* 1. Header Section */}
      <section className="w-full bg-white/85 backdrop-blur-xl rounded-[26px] p-6 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 rounded-full font-semibold">
              Evidence Ingestion Studio
            </span>
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full">
              Clearance Level {userMaxLevel} Max
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#151c27] tracking-tight">Upload &amp; Classify Document</h1>
          <p className="text-xs text-[#45474b] max-w-2xl">
            Upload institutional records. Documents are verified with bit-exact SHA-256 digests, envelope encrypted with AES-256-GCM, and indexed into search.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="h-10 px-4 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] transition-all border border-[#D8DEEA] shadow-xs flex items-center gap-2 text-xs font-semibold self-start xl:self-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Return to Dashboard</span>
        </button>
      </section>

      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-[20px] text-xs text-red-800 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">error</span>
          <div>
            <div className="font-bold">Upload Error</div>
            <div>{uploadError}</div>
          </div>
        </div>
      )}

      {/* 2. Success Receipt View */}
      {uploadReceipt ? (
        <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-6">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-xl">verified</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">Document Uploaded Successfully!</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Your document has been encrypted, stored securely, and recorded in the cryptographic audit ledger.
              </p>
            </div>
          </div>

          <div className="p-5 bg-[#10141A] text-white rounded-2xl font-mono text-xs space-y-2.5">
            <div className="text-[#83A2DB] font-bold uppercase text-[10px] tracking-wider border-b border-white/10 pb-2">
              Ingestion Receipt
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
                <span className="text-white">AES-256-GCM / DEK Sealed</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">File Size</span>
                <span className="text-white">{(uploadReceipt.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <span className="text-slate-400 block text-[10px] uppercase">SHA-256 Digest</span>
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
              className="h-10 px-5 bg-white hover:bg-[#f0f3ff] text-[#151c27] text-xs font-semibold rounded-full border border-[#D8DEEA] transition cursor-pointer"
            >
              + Ingest Another Record
            </button>
            <button
              type="button"
              onClick={onSuccess}
              className="h-10 px-6 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full shadow-[0_6px_18px_rgba(16,20,26,0.22)] transition cursor-pointer"
            >
              Return to Documents
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 3. File Upload Card */}
          <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#151c27]">Document File</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] rounded-full border border-[#83A2DB]/30">
                  INTEGRITY SEALED
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#9CA3AF]">MAX SIZE: 25 MB</span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group relative rounded-[20px] border-2 border-dashed border-[#D8DEEA] hover:border-[#3f5e93] bg-[#f0f3ff]/30 hover:bg-[#f0f3ff]/60 p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                disabled={isSubmitting}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-white border border-[#D8DEEA] shadow-xs flex items-center justify-center text-[#3f5e93] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[30px]">cloud_upload</span>
              </div>
              <div className="flex flex-col gap-1 items-center">
                <p className="text-sm font-semibold text-[#151c27]">
                  Drag and drop your document here
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  or <span className="text-[#3f5e93] font-semibold underline underline-offset-2">browse files from disk</span>
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white border border-[#D8DEEA] px-3.5 py-1 rounded-full text-[11px] text-[#45474b]">
                <span className="material-symbols-outlined text-[15px] text-[#9CA3AF]">description</span>
                <span>Supported: PDF, DOCX, TIFF, PNG, JPG (Max 25 MB)</span>
              </div>
            </div>

            {/* Staged File Preview Card */}
            {file && (
              <div className="bg-[#f0f3ff]/60 border border-[#D8DEEA] rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-full bg-[#000000] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#151c27] truncate">{file.name}</span>
                      <span className="font-mono text-[10px] text-[#45474b] bg-white border border-[#D8DEEA] px-2 py-0.5 rounded-full">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>

                    {/* SHA-256 Digest String */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-[#45474b]">SHA-256:</span>
                      <code className="font-mono text-[11px] text-[#151c27] bg-white border border-[#D8DEEA] px-2 py-0.5 rounded-full select-all truncate max-w-xl">
                        {isHashing ? 'Computing digest...' : sha256Hash}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyHash}
                        className="text-[#9CA3AF] hover:text-[#151c27] p-1 rounded-full transition-colors cursor-pointer"
                        title="Copy Checksum"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {copiedHash ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setSha256Hash('');
                  }}
                  className="h-8 px-3 rounded-full bg-[rgba(206,105,105,0.14)] hover:bg-[rgba(206,105,105,0.25)] text-[#ca6666] text-xs font-semibold transition border border-[#CE6969]/30 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">delete_outline</span>
                  <span>Replace File</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Document Details Form */}
          <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-1 border-b border-[#D8DEEA]/60">
              <div>
                <h2 className="text-sm font-bold text-[#151c27]">Document Classification &amp; Metadata</h2>
                <span className="text-xs text-[#9CA3AF]">
                  Select official classification, department, clearance tier, and record identifiers.
                </span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2.5 py-1 bg-[#f0f3ff] text-[#151c27] rounded-full border border-[#D8DEEA]">
                METADATA
              </span>
            </div>

            {/* Row 1: Document Title & Auto-Generating ID */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#45474b] flex items-center justify-between">
                  <span>Document Title *</span>
                  <span className="text-[#9CA3AF] font-normal text-[11px]">Required</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Annual Governance & Security Directives FY26"
                  className="h-10 px-4 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium"
                />
              </div>

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#45474b]">Record Number</label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateNumber}
                    className="text-[11px] font-semibold text-[#3f5e93] hover:underline flex items-center gap-1 cursor-pointer"
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
                    className="w-full h-10 pl-4 pr-9 bg-[#f0f3ff] border border-[#D8DEEA] font-mono text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium"
                  />
                  <span className="material-symbols-outlined absolute right-3 text-[#3f5e93] text-[18px]">verified</span>
                </div>
              </div>
            </div>

            {/* Row 2: Dynamic Document Type, Department, and Security Classification Tier */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Dynamic Document Type */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#45474b]">Document Type *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
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
                      <option value="LETTER">Official Correspondence</option>
                      <option value="REPORT">Inspection &amp; Audit Report</option>
                      <option value="ORDER">Executive Sanction &amp; Order</option>
                    </>
                  )}
                </select>
              </div>

              {/* Dynamic Department */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#45474b]">Department / Division *</label>
                <select
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                >
                  {departments.length > 0 ? (
                    departments.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.name} ({d.code})
                      </option>
                    ))
                  ) : (
                    <option value="ADMIN">General Administration (ADMIN)</option>
                  )}
                </select>
              </div>

              {/* Dynamic Security Tier */}
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#45474b]">Security Clearance Tier *</label>
                <select
                  value={secTier}
                  onChange={(e) => setSecTier(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                >
                  {securityLevels.length > 0 ? (
                    securityLevels.map((sl) => (
                      <option
                        key={sl.id}
                        value={sl.code}
                        disabled={!sl.isAccessible}
                      >
                        {sl.code} — {sl.name} (Rank {sl.rank}) {!sl.isAccessible ? '🔒 Restricted' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="T1">T1 — Public (Rank 1)</option>
                      <option value="T2">T2 — Internal (Rank 2)</option>
                      <option value="T3">T3 — Confidential (Rank 3)</option>
                      <option value="T4">T4 — Secret (Rank 4)</option>
                      <option value="T5">T5 — Top Secret (Rank 5)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Row 3: Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#45474b]">Summary &amp; Case Notes</label>
              <textarea
                rows={3}
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder="Add a brief description or summary for lexical search indexing..."
                className="p-3.5 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] leading-relaxed font-medium"
              ></textarea>
            </div>
          </div>

          {/* 5. Live Ingestion Progress Bar */}
          {isSubmitting && (
            <div className="bg-white border border-[#D8DEEA] rounded-[22px] p-5 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#3f5e93] animate-spin text-[20px]">sync</span>
                  <span className="text-xs font-bold text-[#151c27]">{progressLabel}</span>
                </div>
                <span className="font-mono text-xs text-[#3f5e93] font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-[#E9ECF4] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#000000] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[#9CA3AF] font-mono text-[11px]">
                <span>{progressSubtext}</span>
                <span>STATUS: SEALING</span>
              </div>
            </div>
          )}

          {/* 6. Sticky Action Footer */}
          <div className="bg-white/90 backdrop-blur-xl border border-[#D8DEEA]/80 rounded-[26px] p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-4 z-30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#f0f3ff] flex items-center justify-center text-[#151c27]">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold text-[#151c27]">Clearance Active</span>
                </div>
                <span className="font-mono text-[11px] text-[#9CA3AF]">
                  Level {userMaxLevel} • {userDepartment || 'Institutional Vault'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onCancel}
                className="h-10 px-5 rounded-full text-xs font-semibold text-[#45474b] hover:text-[#151c27] bg-[#f0f3ff] hover:bg-[#e2e8f8] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-6 rounded-full bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold shadow-[0_6px_18px_rgba(16,20,26,0.22)] transition flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                <span>Ingest &amp; Seal Record</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
