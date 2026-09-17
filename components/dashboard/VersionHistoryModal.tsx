'use client';

import React, { useState, useEffect } from 'react';

export interface DocumentVersionItem {
  versionId: string;
  versionNumber: number;
  versionStatus: string;
  isCurrent: boolean;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  encryptionAlgorithm: string;
  checksumVerified: boolean;
  createdAt: string;
  creatorName: string;
  creatorDesignation: string;
  changeReason: string | null;
  approvalStatus: string | null;
  ocrConfidence: number | null;
  ocrCharCount: number;
}

interface VersionHistoryModalProps {
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  securityTier: string;
  isOpen: boolean;
  onClose: () => void;
  onDownloadVersion: (docId: string, docNumber: string, fileName: string) => void;
  onVersionUploaded: () => void;
}

export function VersionHistoryModal({
  documentId,
  documentNumber,
  documentTitle,
  securityTier,
  isOpen,
  onClose,
  onDownloadVersion,
  onVersionUploaded,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadReason, setUploadReason] = useState('');
  const [requireDualCustody, setRequireDualCustody] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to load version history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
      setUploadOpen(false);
      setFeedback(null);
    }
  }, [isOpen, documentId]);

  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setFeedback({ type: 'error', message: 'Please select a replacement evidence file.' });
      return;
    }
    if (!uploadReason.trim()) {
      setFeedback({ type: 'error', message: 'Mandatory change justification note is required.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('reason', uploadReason.trim());
      formData.append('requireApproval', requireDualCustody ? 'true' : 'false');

      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit revision');
      }

      setFeedback({ type: 'success', message: data.message });
      setUploadFile(null);
      setUploadReason('');
      setUploadOpen(false);
      await fetchVersions();
      onVersionUploaded();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isSensitive = securityTier === 'T4' || securityTier === 'T5';

  return (
    <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans text-[#151c27]">
      <div 
        className="bg-white w-full max-w-2xl rounded-[26px] shadow-2xl border border-[#D8DEEA] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#D8DEEA]/60 bg-[#f0f3ff]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center border border-[#83A2DB]/30">
              <span className="material-symbols-outlined text-[20px]">history</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#151c27]">{documentNumber} — Revision History</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#000000] text-white font-mono">
                  {versions.length} Revisions
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF] truncate max-w-md">{documentTitle}</p>
            </div>
          </div>

          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#151c27] p-1.5 rounded-full cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-3 mx-5 mt-4 rounded-2xl text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}

        {/* Upload Revision Action Button / Form */}
        <div className="p-5 border-b border-[#D8DEEA]/40 bg-white">
          {!uploadOpen ? (
            <div className="flex items-center justify-between bg-[#f0f3ff]/50 p-3 rounded-2xl border border-[#D8DEEA]/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3f5e93] text-[18px]">drive_file_rename_outline</span>
                <span className="text-xs text-[#151c27] font-medium">Need to stage an updated revision or addendum?</span>
              </div>
              <button
                onClick={() => setUploadOpen(true)}
                className="h-8 px-4 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full flex items-center gap-1 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Upload New Revision</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleUploadNewVersion} className="p-4 bg-[#f0f3ff]/40 rounded-2xl border border-[#D8DEEA] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#151c27] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#3f5e93] text-[16px]">upload_file</span>
                  <span>Stage Next Revision (v{versions.length + 1}.0)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="text-xs text-[#9CA3AF] hover:text-[#151c27] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Dual Custody Option */}
              <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-blue-950 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#3f5e93] shrink-0 mt-0.5">rule</span>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={requireDualCustody}
                    onChange={(e) => setRequireDualCustody(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-slate-300 text-[#3f5e93] focus:ring-0 cursor-pointer mt-0.5"
                  />
                  <span>
                    <strong>Maker-Checker Dual-Custody Approval:</strong> Route this revision through the Approvals Queue for Section Head / Approver sign-off before promoting to active docket.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#45474b] uppercase mb-1">
                  Replacement File (PDF, DOCX, IMG)
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#45474b] file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#f0f3ff] file:text-[#151c27] hover:file:bg-[#e2e8f8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#45474b] uppercase mb-1">
                  Mandatory Change Justification Note
                </label>
                <textarea
                  rows={2}
                  value={uploadReason}
                  onChange={(e) => setUploadReason(e.target.value)}
                  placeholder="Explain why this revision is being submitted..."
                  className="w-full p-2.5 bg-white border border-[#D8DEEA] text-xs text-[#151c27] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3f5e93]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="h-8 px-4 bg-white hover:bg-[#f0f3ff] text-[#151c27] text-xs font-semibold rounded-full border border-[#D8DEEA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-8 px-4 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-[15px]">enhanced_encryption</span>
                  )}
                  <span>Encrypt &amp; Submit Revision</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Timeline of Versions */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-[#9CA3AF]">
              <div className="w-6 h-6 border-2 border-[#3f5e93] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs">Querying immutable version ledger...</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D8DEEA]">
              {versions.map((ver) => {
                const isPending =
                  ver.versionStatus === 'PENDING' ||
                  ver.versionStatus === 'PENDING_APPROVAL' ||
                  ver.approvalStatus === 'PENDING';

                return (
                  <div key={ver.versionId} className="relative group">
                    {/* Timeline Dot */}
                    <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      ver.isCurrent
                        ? 'bg-[#3f5e93] text-white shadow-xs ring-4 ring-blue-100'
                        : isPending
                        ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                        : 'bg-slate-300 text-slate-700'
                    }`}>
                      {ver.versionNumber}
                    </div>

                    {/* Version Card */}
                    <div className="bg-[#f0f3ff]/40 border border-[#D8DEEA]/70 rounded-2xl p-4 space-y-2 hover:bg-white hover:border-[#D8DEEA] transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#151c27]">
                            v{ver.versionNumber}.0
                          </span>
                          {ver.isCurrent && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                              CURRENT ACTIVE
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping"></span>
                              PENDING APPROVAL
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => onDownloadVersion(documentId, documentNumber, ver.fileName)}
                          className="h-7 px-3 bg-white hover:bg-[#f0f3ff] text-[#151c27] text-xs font-semibold rounded-full border border-[#D8DEEA] flex items-center gap-1 transition cursor-pointer"
                          title="Stream and decrypt this revision"
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span>
                          <span>Decrypt v{ver.versionNumber}.0</span>
                        </button>
                      </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-[#45474b] pt-1">
                      <div>
                        <span className="text-[#9CA3AF] block text-[10px]">FILE NAME</span>
                        <span className="truncate block font-sans" title={ver.fileName}>{ver.fileName}</span>
                      </div>
                      <div>
                        <span className="text-[#9CA3AF] block text-[10px]">FILE SIZE</span>
                        <span>{(ver.fileSize / 1024).toFixed(1)} KB</span>
                      </div>
                      <div>
                        <span className="text-[#9CA3AF] block text-[10px]">SUBMITTED BY</span>
                        <span className="truncate block font-sans">{ver.creatorName}</span>
                      </div>
                      <div>
                        <span className="text-[#9CA3AF] block text-[10px]">DATE</span>
                        <span>{new Date(ver.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {ver.changeReason && (
                      <div className="p-2 bg-white rounded-xl border border-[#D8DEEA]/60 text-xs text-[#45474b]">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase block mb-0.5">Submission Note</span>
                        <p className="italic">{ver.changeReason}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#9CA3AF] pt-1 border-t border-[#D8DEEA]/40">
                      <span className="truncate max-w-sm" title={ver.sha256Hash}>
                        sha256: {ver.sha256Hash}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs text-[#45474b]">
          <span className="text-[11px] font-mono">
            Cryptographic Version Registry • AES-256-GCM
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 bg-[#000000] text-white text-xs font-semibold rounded-full hover:bg-[#181c22] cursor-pointer"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
