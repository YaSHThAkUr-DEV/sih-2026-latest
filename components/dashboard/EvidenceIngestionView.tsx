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

// Bulk Upload Item Interface
interface BulkFileItem {
  id: string;
  file: File;
  title: string;
  docNumber: string;
  sha256Hash: string;
  isHashing: boolean;
  status: 'PENDING' | 'HASHING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  receipt?: {
    id: string;
    documentNumber: string;
    title: string;
    versionId: string;
    sha256Hash: string;
    fileSize: number;
    encryptionAlgorithm: string;
    minioObjectKey: string;
  };
}

export default function EvidenceIngestionView({
  onSuccess,
  onCancel,
  userDepartment = '',
  userDesignation = '',
  userEmployeeCode = '',
}: EvidenceIngestionProps) {
  // Ingestion Mode: 'SINGLE' or 'BULK'
  const [ingestionMode, setIngestionMode] = useState<'SINGLE' | 'BULK'>('SINGLE');

  // --- SINGLE UPLOAD STATE ---
  const [file, setFile] = useState<File | null>(null);
  const [sha256Hash, setSha256Hash] = useState<string>('');
  const [isHashing, setIsHashing] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [title, setTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [synopsis, setSynopsis] = useState('');

  // --- BULK UPLOAD STATE ---
  const [bulkFiles, setBulkFiles] = useState<BulkFileItem[]>([]);
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [bulkBatchNotes, setBulkBatchNotes] = useState('');
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState<number>(-1);
  const [bulkSuccessCount, setBulkSuccessCount] = useState(0);
  const [bulkErrorCount, setBulkErrorCount] = useState(0);
  const [bulkReceipts, setBulkReceipts] = useState<any[]>([]);
  const [copiedManifest, setCopiedManifest] = useState(false);

  // --- SHARED TAXONOMY STATE ---
  const [docType, setDocType] = useState('OM');
  const [deptCode, setDeptCode] = useState('ADMIN');
  const [secTier, setSecTier] = useState('T2');
  const [docTypes, setDocTypes] = useState<TaxonomyDocType[]>([]);
  const [departments, setDepartments] = useState<TaxonomyDepartment[]>([]);
  const [securityLevels, setSecurityLevels] = useState<TaxonomySecurityLevel[]>([]);
  const [userMaxLevel, setUserMaxLevel] = useState<number>(3);

  // --- SUBMISSION & PROGRESS STATE ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [progressSubtext, setProgressSubtext] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadReceipt, setUploadReceipt] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

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

  // Compute Client-Side SHA-256 Hash for a single file
  const computeFileHash = async (inputFile: File): Promise<string> => {
    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      console.error('Failed to compute client-side SHA-256:', err);
      return 'sha256:pending_server_verification';
    }
  };

  // --- SINGLE UPLOAD HANDLERS ---
  const handleSingleFileSelect = async (selected: File) => {
    setFile(selected);
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' '));
    }
    setIsHashing(true);
    const hash = await computeFileHash(selected);
    setSha256Hash(hash);
    setIsHashing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleSingleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (ingestionMode === 'SINGLE') {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await handleSingleFileSelect(e.dataTransfer.files[0]);
      }
    } else {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await handleAddBulkFiles(Array.from(e.dataTransfer.files));
      }
    }
  };

  const handleCopyHash = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
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

  // --- BULK UPLOAD HANDLERS ---
  const handleAddBulkFiles = async (filesToAdd: File[]) => {
    const year = new Date().getFullYear();
    const prefix = docType ? docType.substring(0, 4).toUpperCase() : 'GEN';

    // Build initial items
    const newItems: BulkFileItem[] = filesToAdd.map((f, idx) => {
      const randomSeq = Math.floor(1000 + Math.random() * 9000) + idx;
      const cleanTitle = f.name.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' ');
      return {
        id: `bulk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        file: f,
        title: cleanTitle,
        docNumber: `DOC-${prefix}-${year}-${randomSeq}`,
        sha256Hash: '',
        isHashing: true,
        status: 'PENDING',
      };
    });

    setBulkFiles((prev) => [...prev, ...newItems]);

    // Asynchronously compute hash for each newly added file
    for (const item of newItems) {
      computeFileHash(item.file).then((hash) => {
        setBulkFiles((current) =>
          current.map((f) =>
            f.id === item.id ? { ...f, sha256Hash: hash, isHashing: false } : f
          )
        );
      });
    }
  };

  const handleBulkFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleAddBulkFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input
    }
  };

  const handleRemoveBulkFile = (id: string) => {
    if (isSubmitting) return;
    setBulkFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearBulkQueue = () => {
    if (isSubmitting) return;
    setBulkFiles([]);
    setBulkReceipts([]);
    setBulkSuccessCount(0);
    setBulkErrorCount(0);
  };

  const handleBulkTitleChange = (id: string, newTitle: string) => {
    setBulkFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, title: newTitle } : f))
    );
  };

  const handleBulkDocNumberChange = (id: string, newDocNumber: string) => {
    setBulkFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, docNumber: newDocNumber } : f))
    );
  };

  // --- SUBMISSION FOR SINGLE MODE ---
  const handleSingleSubmit = async (e: React.FormEvent) => {
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

    setProgressPercent(25);
    setProgressLabel('Verifying bit-exact integrity...');
    setProgressSubtext('Calculating SHA-256 checksum & validating clearance rank...');

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

      setProgressPercent(60);
      setProgressLabel('Encrypting with AES-256-GCM envelope...');
      setProgressSubtext('Vault KMS generating DEK • MinIO encrypted upload • Redis queues initiating...');

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setProgressPercent(100);
      setProgressLabel('Sealed & Registered Successfully!');
      setProgressSubtext('Tamper-proof audit chained • OCR background worker queued • Blockchain anchor enqueued.');

      setUploadReceipt(data.document);
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred during document upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMISSION FOR BULK MODE ---
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkFiles.length === 0) {
      setUploadError('Please add at least one document to the bulk queue.');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);
    setBulkSuccessCount(0);
    setBulkErrorCount(0);
    setBulkReceipts([]);

    const totalFiles = bulkFiles.length;
    const completedReceipts: any[] = [];
    let successCounter = 0;
    let errorCounter = 0;

    for (let i = 0; i < totalFiles; i++) {
      const currentItem = bulkFiles[i];
      setBulkCurrentIndex(i);

      // Update state for current file to PROCESSING
      setBulkFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'PROCESSING' } : f))
      );

      const percent = Math.round(((i) / totalFiles) * 100);
      setProgressPercent(percent);
      setProgressLabel(`Processing item ${i + 1} of ${totalFiles}: "${currentItem.file.name}"`);
      setProgressSubtext(`AES-256-GCM Envelope Encryption → MinIO S3 → Redis OCR Pipeline → Blockchain Anchoring`);

      try {
        const formData = new FormData();
        formData.append('file', currentItem.file);
        formData.append('title', currentItem.title.trim() || currentItem.file.name);
        formData.append('documentNumber', currentItem.docNumber.trim());
        formData.append('docTypeCode', docType);
        formData.append('deptCode', deptCode);
        formData.append('secCode', secTier);
        
        const combinedDesc = [
          bulkBatchNotes.trim(),
          `[Batch Ingestion ${i + 1}/${totalFiles}]`
        ].filter(Boolean).join(' • ');
        formData.append('description', combinedDesc);

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Upload failed with status ${res.status}`);
        }

        successCounter++;
        setBulkSuccessCount(successCounter);
        completedReceipts.push(data.document);

        // Mark this item as SUCCESS
        setBulkFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: 'SUCCESS', receipt: data.document, sha256Hash: data.document.sha256Hash }
              : f
          )
        );
      } catch (err: any) {
        errorCounter++;
        setBulkErrorCount(errorCounter);
        const errMsg = err.message || 'Unknown processing error';

        // Mark this item as ERROR
        setBulkFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'ERROR', errorMessage: errMsg } : f
          )
        );
      }
    }

    setProgressPercent(100);
    setProgressLabel(`Batch Complete: ${successCounter} Sealed, ${errorCounter} Failed`);
    setProgressSubtext('All successful documents encrypted with KMS DEK, OCR extracted, and anchored into ledger.');
    setBulkReceipts(completedReceipts);
    setIsSubmitting(false);
  };

  const handleCopyManifest = () => {
    if (bulkReceipts.length === 0) return;
    const manifest = JSON.stringify(
      bulkReceipts.map((r) => ({
        documentNumber: r.documentNumber,
        title: r.title,
        sha256Hash: r.sha256Hash,
        fileSize: r.fileSize,
        encryption: r.encryptionAlgorithm,
        minioKey: r.minioObjectKey,
        securityTier: secTier,
        deptCode: deptCode,
        docTypeCode: docType,
        timestamp: new Date().toISOString(),
      })),
      null,
      2
    );
    navigator.clipboard.writeText(manifest).then(() => {
      setCopiedManifest(true);
      setTimeout(() => setCopiedManifest(false), 2500);
    });
  };

  const isAllBulkComplete = bulkFiles.length > 0 && bulkFiles.every((f) => f.status === 'SUCCESS' || f.status === 'ERROR');

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12 font-sans text-[#151c27]">
      {/* 1. Top Header & Mode Toggle Section */}
      <section className="w-full bg-white/85 backdrop-blur-xl rounded-[26px] p-6 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 rounded-full font-semibold">
              Evidence Ingestion Studio
            </span>
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full font-medium">
              Clearance Level {userMaxLevel} Max
            </span>
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Full Security Pipeline Active
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#151c27] tracking-tight">
            {ingestionMode === 'SINGLE' ? 'Upload & Classify Single Document' : 'Mass Bulk Evidence Ingestion'}
          </h1>
          <p className="text-xs text-[#45474b] max-w-2xl">
            {ingestionMode === 'SINGLE'
              ? 'Institutional record ingestion. Encrypted with AES-256-GCM envelope, verified with SHA-256 digest, OCR indexed, and anchored on blockchain.'
              : 'Batch ingest high-volume records. Each file in the batch receives full envelope encryption, OCR background indexing, Redis job queueing, and blockchain anchoring.'}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start xl:self-auto flex-wrap">
          {/* Mode Switcher Tabs */}
          <div className="bg-[#f0f3ff] p-1 rounded-full border border-[#D8DEEA] flex items-center shadow-xs">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIngestionMode('SINGLE');
                setUploadError(null);
              }}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                ingestionMode === 'SINGLE'
                  ? 'bg-white text-[#151c27] shadow-xs border border-[#D8DEEA]'
                  : 'text-[#606368] hover:text-[#151c27]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">description</span>
              <span>Single Document</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIngestionMode('BULK');
                setUploadError(null);
              }}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                ingestionMode === 'BULK'
                  ? 'bg-white text-[#151c27] shadow-xs border border-[#D8DEEA]'
                  : 'text-[#606368] hover:text-[#151c27]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">folder_copy</span>
              <span>Mass Bulk Upload</span>
              {bulkFiles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#000000] text-white text-[10px] rounded-full font-mono">
                  {bulkFiles.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-10 px-4 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] transition-all border border-[#D8DEEA] shadow-xs flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Dashboard</span>
          </button>
        </div>
      </section>

      {/* Security Pipeline Badge Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-[#D8DEEA] flex items-center gap-2.5 shadow-xs">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
            <span className="material-symbols-outlined text-[17px]">lock</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono text-[#606368] font-bold">Encryption</span>
            <span className="text-xs font-bold text-[#151c27]">AES-256-GCM / DEK</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-[#D8DEEA] flex items-center gap-2.5 shadow-xs">
          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200">
            <span className="material-symbols-outlined text-[17px]">document_scanner</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono text-[#606368] font-bold">OCR Pipeline</span>
            <span className="text-xs font-bold text-[#151c27]">Auto GIN Vector Index</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-[#D8DEEA] flex items-center gap-2.5 shadow-xs">
          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
            <span className="material-symbols-outlined text-[17px]">bolt</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono text-[#606368] font-bold">Redis Queues</span>
            <span className="text-xs font-bold text-[#151c27]">Async Workers</span>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-[#D8DEEA] flex items-center gap-2.5 shadow-xs">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
            <span className="material-symbols-outlined text-[17px]">link</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono text-[#606368] font-bold">Integrity</span>
            <span className="text-xs font-bold text-[#151c27]">Hyperledger Chained</span>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-[20px] text-xs text-red-800 flex items-start gap-2.5 shadow-xs">
          <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0">error</span>
          <div className="flex-1">
            <div className="font-bold">Ingestion Warning / Error</div>
            <div className="mt-0.5">{uploadError}</div>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-500 hover:text-red-800 p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: SINGLE DOCUMENT UPLOAD                                            */}
      {/* ========================================================================= */}
      {ingestionMode === 'SINGLE' && (
        <>
          {uploadReceipt ? (
            <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-xl">verified</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">Document Uploaded &amp; Sealed Successfully!</h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Your record is envelope-encrypted, stored in MinIO S3, indexed via OCR, and anchored into the cryptographic audit trail.
                  </p>
                </div>
              </div>

              <div className="p-5 bg-[#10141A] text-white rounded-2xl font-mono text-xs space-y-2.5 shadow-inner">
                <div className="text-[#83A2DB] font-bold uppercase text-[10px] tracking-wider border-b border-white/10 pb-2 flex items-center justify-between">
                  <span>Cryptographic Ingestion Receipt</span>
                  <span className="text-emerald-400 text-[10px]">ALL PIPELINE STAGES SEALED</span>
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
                    <span className="text-slate-400 block text-[10px] uppercase">Encryption Algorithm</span>
                    <span className="text-white">AES-256-GCM / DEK Envelope Sealed</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">File Size</span>
                    <span className="text-white">{(uploadReceipt.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-400 block text-[10px] uppercase">SHA-256 Digest</span>
                    <span className="text-amber-300 break-all text-[11px] select-all font-semibold font-mono">
                      {uploadReceipt.sha256Hash}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyHash(uploadReceipt.sha256Hash)}
                    className="h-7 px-2.5 bg-white/10 hover:bg-white/20 text-white text-[11px] rounded-full border border-white/20 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedHash ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                  </button>
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
                    setDocNumber('');
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
            <form onSubmit={handleSingleSubmit} className="flex flex-col gap-6">
              {/* Single File Upload Card */}
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

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-[#45474b]">SHA-256:</span>
                          <code className="font-mono text-[11px] text-[#151c27] bg-white border border-[#D8DEEA] px-2 py-0.5 rounded-full select-all truncate max-w-xl">
                            {isHashing ? 'Computing digest...' : sha256Hash}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyHash(sha256Hash)}
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
                      <span>Replace</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Document Details Form */}
              <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-5">
                <div className="flex items-center justify-between pb-1 border-b border-[#D8DEEA]/60">
                  <div>
                    <h2 className="text-sm font-bold text-[#151c27]">Document Classification &amp; Metadata</h2>
                    <span className="text-xs text-[#9CA3AF]">
                      Select official taxonomy, clearance tier, and record identifiers.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2.5 py-1 bg-[#f0f3ff] text-[#151c27] rounded-full border border-[#D8DEEA]">
                    METADATA
                  </span>
                </div>

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

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
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

                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#45474b]">Security Clearance Tier *</label>
                    <select
                      value={secTier}
                      onChange={(e) => setSecTier(e.target.value)}
                      className="w-full h-10 px-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                    >
                      {securityLevels.length > 0 ? (
                        securityLevels.map((sl) => (
                          <option key={sl.id} value={sl.code} disabled={!sl.isAccessible}>
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

              {/* Progress Indicator */}
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
                    <span>STATUS: ENCRYPTING &amp; QUEUEING</span>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
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
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: MASS BULK EVIDENCE INGESTION                                      */}
      {/* ========================================================================= */}
      {ingestionMode === 'BULK' && (
        <div className="flex flex-col gap-6">
          {/* Bulk Drop & Selector Card */}
          <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-[#151c27]">Bulk Document Staging Queue</span>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] rounded-full border border-[#83A2DB]/30">
                  MULTI-FILE STAGING
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-[#9CA3AF]">
                  {bulkFiles.length} {bulkFiles.length === 1 ? 'file' : 'files'} staged
                </span>
                {bulkFiles.length > 0 && !isSubmitting && (
                  <button
                    type="button"
                    onClick={handleClearBulkQueue}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Drag & Drop Multi-file Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => bulkFileInputRef.current?.click()}
              className="group relative rounded-[20px] border-2 border-dashed border-[#D8DEEA] hover:border-[#3f5e93] bg-[#f0f3ff]/30 hover:bg-[#f0f3ff]/60 p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                disabled={isSubmitting}
                onChange={handleBulkFileInputChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-white border border-[#D8DEEA] shadow-xs flex items-center justify-center text-[#3f5e93] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[30px]">library_add</span>
              </div>
              <div className="flex flex-col gap-1 items-center">
                <p className="text-sm font-semibold text-[#151c27]">
                  Drag and drop multiple files to batch ingest
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  or <span className="text-[#3f5e93] font-semibold underline underline-offset-2">select multiple files simultaneously</span>
                </p>
              </div>
              <div className="inline-flex items-center gap-2 bg-white border border-[#D8DEEA] px-4 py-1.5 rounded-full text-[11px] text-[#45474b]">
                <span className="material-symbols-outlined text-[15px] text-[#3f5e93]">verified_user</span>
                <span>Each file automatically triggers Envelope Encryption, OCR Pipeline &amp; Blockchain Anchoring</span>
              </div>
            </div>

            {/* Staged File Queue Table */}
            {bulkFiles.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#151c27]">Staged Files Queue</span>
                  <span className="text-[11px] text-[#606368]">
                    Total Size: {(bulkFiles.reduce((acc, f) => acc + f.file.size, 0) / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>

                <div className="border border-[#D8DEEA] rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#D8DEEA]">
                    {bulkFiles.map((item, index) => {
                      const isCurrent = isSubmitting && bulkCurrentIndex === index;
                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors ${
                            isCurrent
                              ? 'bg-blue-50/60'
                              : item.status === 'SUCCESS'
                              ? 'bg-emerald-50/30'
                              : item.status === 'ERROR'
                              ? 'bg-red-50/30'
                              : 'hover:bg-[#f0f3ff]/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="font-mono text-[11px] text-[#9CA3AF] w-5 text-center shrink-0">
                              {index + 1}
                            </span>
                            <div className="w-9 h-9 rounded-full bg-[#10141A] text-white flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[18px]">
                                {item.file.name.endsWith('.pdf') ? 'picture_as_pdf' : 'description'}
                              </span>
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#151c27] truncate max-w-xs md:max-w-md">
                                  {item.file.name}
                                </span>
                                <span className="font-mono text-[10px] text-[#606368] bg-[#f0f3ff] border border-[#D8DEEA] px-1.5 py-0.2 rounded-full">
                                  {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                                <span className="font-mono text-[10px] text-[#3f5e93] bg-[rgba(131,162,219,0.12)] border border-[#83A2DB]/30 px-1.5 py-0.2 rounded-full">
                                  {item.docNumber}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                <span className="text-[#9CA3AF] font-mono">SHA-256:</span>
                                <span className="font-mono text-[10px] text-[#45474b] truncate max-w-sm">
                                  {item.isHashing ? 'Computing...' : item.sha256Hash || 'pending'}
                                </span>
                                {item.errorMessage && (
                                  <span className="text-red-600 font-semibold text-[11px]">
                                    • {item.errorMessage}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status & Actions */}
                          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
                            {item.status === 'PENDING' && (
                              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold rounded-full border border-slate-300">
                                QUEUED
                              </span>
                            )}
                            {item.status === 'PROCESSING' && (
                              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-semibold rounded-full border border-blue-300 flex items-center gap-1 animate-pulse">
                                <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                                ENCRYPTING &amp; QUEUEING
                              </span>
                            )}
                            {item.status === 'SUCCESS' && (
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold rounded-full border border-emerald-300 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">verified</span>
                                SEALED &amp; OCR ENQUEUED
                              </span>
                            )}
                            {item.status === 'ERROR' && (
                              <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-mono font-semibold rounded-full border border-red-300 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">error</span>
                                FAILED
                              </span>
                            )}

                            {!isSubmitting && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBulkFile(item.id)}
                                className="w-7 h-7 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer"
                                title="Remove file"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Shared Batch Classification Panel */}
          <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-1 border-b border-[#D8DEEA]/60">
              <div>
                <h2 className="text-sm font-bold text-[#151c27]">Shared Batch Classification &amp; Security Tier</h2>
                <span className="text-xs text-[#9CA3AF]">
                  These classifications and security levels will be applied to all documents in this bulk ingestion.
                </span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2.5 py-1 bg-[#f0f3ff] text-[#151c27] rounded-full border border-[#D8DEEA]">
                BATCH TAXONOMY
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#45474b]">Document Type *</label>
                <select
                  disabled={isSubmitting}
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

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#45474b]">Department / Division *</label>
                <select
                  disabled={isSubmitting}
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

              <div className="md:col-span-4 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#45474b]">Security Clearance Tier *</label>
                <select
                  disabled={isSubmitting}
                  value={secTier}
                  onChange={(e) => setSecTier(e.target.value)}
                  className="w-full h-10 px-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium cursor-pointer"
                >
                  {securityLevels.length > 0 ? (
                    securityLevels.map((sl) => (
                      <option key={sl.id} value={sl.code} disabled={!sl.isAccessible}>
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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#45474b]">Batch Ingestion Notes / Audit Tag</label>
              <textarea
                disabled={isSubmitting}
                rows={2}
                value={bulkBatchNotes}
                onChange={(e) => setBulkBatchNotes(e.target.value)}
                placeholder="e.g., Q1 Audit Ingestion Archive - Departmental Circulars & Reports"
                className="p-3.5 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] leading-relaxed font-medium"
              ></textarea>
            </div>
          </div>

          {/* Bulk Ingestion Live Progress Card */}
          {isSubmitting && (
            <div className="bg-white border border-[#D8DEEA] rounded-[22px] p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#3f5e93] animate-spin text-[20px]">sync</span>
                  <span className="text-xs font-bold text-[#151c27]">{progressLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {bulkSuccessCount} Sealed
                  </span>
                  {bulkErrorCount > 0 && (
                    <span className="text-[11px] font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                      {bulkErrorCount} Failed
                    </span>
                  )}
                  <span className="font-mono text-xs text-[#3f5e93] font-bold">{progressPercent}%</span>
                </div>
              </div>

              <div className="w-full bg-[#E9ECF4] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#000000] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[#9CA3AF] font-mono text-[11px]">
                <span>{progressSubtext}</span>
                <span>ACTIVE WORKERS: AES-256 • OCR • FABRIC</span>
              </div>
            </div>
          )}

          {/* Batch Completion Summary / Manifest (Shown when all done) */}
          {isAllBulkComplete && !isSubmitting && (
            <div className="bg-white rounded-[26px] p-6 shadow-xs border border-[#D8DEEA]/80 flex flex-col gap-5">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-2xl">task_alt</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      Batch Ingestion Sealed Successfully! ({bulkSuccessCount}/{bulkFiles.length} Records)
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      All files have been encrypted with envelope keys, placed in MinIO storage, enqueued for Redis OCR extraction, and registered on the blockchain audit ledger.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyManifest}
                  className="h-9 px-4 rounded-full bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copiedManifest ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedManifest ? 'Manifest Copied!' : 'Copy Batch JSON Manifest'}</span>
                </button>
              </div>

              {/* Batch Manifest Table */}
              <div className="border border-[#D8DEEA] rounded-2xl overflow-hidden bg-white">
                <div className="p-3 bg-[#10141A] text-white flex items-center justify-between font-mono text-xs">
                  <span className="text-[#83A2DB] font-bold uppercase text-[10px] tracking-wider">
                    Cryptographic Batch Ledger
                  </span>
                  <span className="text-emerald-400 text-[10px] font-semibold">
                    {bulkReceipts.length} RECORDS REGISTERED
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[#D8DEEA]">
                  {bulkReceipts.map((r, i) => (
                    <div key={i} className="p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#151c27]">{r.title}</span>
                          <span className="font-mono text-[10px] text-[#3f5e93] bg-[#f0f3ff] px-2 py-0.5 rounded-full border border-[#D8DEEA]">
                            {r.documentNumber}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#606368] select-all truncate max-w-lg mt-0.5">
                          SHA-256: {r.sha256Hash}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                          AES-256-GCM
                        </span>
                        <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                          OCR Queued
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClearBulkQueue}
                  className="h-10 px-5 bg-white hover:bg-[#f0f3ff] text-[#151c27] text-xs font-semibold rounded-full border border-[#D8DEEA] transition cursor-pointer"
                >
                  + Ingest Another Batch
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
          )}

          {/* Sticky Bulk Action Footer */}
          {!isAllBulkComplete && (
            <div className="bg-white/90 backdrop-blur-xl border border-[#D8DEEA]/80 rounded-[26px] p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-4 z-30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#f0f3ff] flex items-center justify-center text-[#151c27]">
                  <span className="material-symbols-outlined text-[18px]">folder_special</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-bold text-[#151c27]">
                      {bulkFiles.length} {bulkFiles.length === 1 ? 'Record' : 'Records'} Ready
                    </span>
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
                  type="button"
                  disabled={isSubmitting || bulkFiles.length === 0}
                  onClick={handleBulkSubmit}
                  className="h-10 px-6 rounded-full bg-[#000000] hover:bg-[#181c22] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-[0_6px_18px_rgba(16,20,26,0.22)] transition flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isSubmitting ? 'sync' : 'publish'}
                  </span>
                  <span>
                    {isSubmitting
                      ? `Ingesting Batch (${bulkCurrentIndex + 1}/${bulkFiles.length})...`
                      : `Ingest & Seal Batch (${bulkFiles.length} Records)`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
