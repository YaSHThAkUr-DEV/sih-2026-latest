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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{documentNumber} — Revision History</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white font-mono">
                  {versions.length} Revisions
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-md">{documentTitle}</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-3 mx-5 mt-4 rounded-lg text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Upload Revision Action Button / Form */}
        <div className="p-5 border-b border-slate-100 bg-white">
          {!uploadOpen ? (
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">drive_file_rename_outline</span>
                <span className="text-xs text-slate-700 font-medium">Need to stage an updated revision or addendum?</span>
              </div>
              <button
                onClick={() => setUploadOpen(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1 transition"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Upload New Revision</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleUploadNewVersion} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-600 text-[16px]">upload_file</span>
                  <span>Stage Next Revision (v{versions.length + 1}.0)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              {isSensitive && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0">shield_lock</span>
                  <span>
                    <strong>Classification Tier {securityTier} Enforced:</strong> This revision will be cryptographically quarantined and routed to the Department Head Maker-Checker Queue before replacement.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Replacement File (PDF, DOCX, IMG)
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Mandatory Legal Justification Note
                </label>
                <textarea
                  rows={2}
                  value={uploadReason}
                  onChange={(e) => setUploadReason(e.target.value)}
                  placeholder="Explain why this revision is being submitted (e.g. Added forensic packet capture attachments, corrected spelling in section 4)..."
                  className="w-full p-2 bg-white border border-slate-200 text-xs text-slate-900 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-[15px]">enhanced_encryption</span>
                  )}
                  <span>Encrypt & Submit Revision</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Timeline of Versions */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs">Querying PostgreSQL immutable version ledger...</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {versions.map((ver) => (
                <div key={ver.versionId} className="relative group">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    ver.isCurrent
                      ? 'bg-emerald-600 text-white shadow-xs ring-4 ring-emerald-100'
                      : ver.versionStatus === 'PENDING'
                      ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                      : 'bg-slate-300 text-slate-700'
                  }`}>
                    {ver.versionNumber}
                  </div>

                  {/* Version Card */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 space-y-2 hover:bg-white hover:border-slate-300 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          v{ver.versionNumber}.0
                        </span>
                        {ver.isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                            CURRENT ACTIVE DOCKET
                          </span>
                        )}
                        {ver.versionStatus === 'PENDING' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping"></span>
                            PENDING MAKER-CHECKER APPROVAL
                          </span>
                        )}
                        {ver.versionStatus === 'ARCHIVED' && (
                          <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 bg-slate-200/70 rounded">
                            ARCHIVED HISTORIC
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onDownloadVersion(documentId, documentNumber, ver.fileName)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded border border-slate-200 flex items-center gap-1 transition"
                        title="Stream and decrypt this specific revision"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        <span>Decrypt v{ver.versionNumber}.0</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-600 pt-1">
                      <div>
                        <span className="text-slate-400 block text-[10px]">FILE NAME</span>
                        <span className="truncate block font-sans" title={ver.fileName}>{ver.fileName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">FILE SIZE</span>
                        <span>{(ver.fileSize / 1024).toFixed(1)} KB</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">SUBMITTED BY</span>
                        <span className="truncate block font-sans">{ver.creatorName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">TIMESTAMP</span>
                        <span>{new Date(ver.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {ver.changeReason && (
                      <div className="p-2 bg-white rounded border border-slate-200 text-xs text-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Submission Note</span>
                        <p className="italic">{ver.changeReason}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100">
                      <span className="truncate max-w-sm" title={ver.sha256Hash}>
                        sha256: {ver.sha256Hash}
                      </span>
                      {ver.ocrCharCount > 0 && (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1 font-sans">
                          <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                          <span>OCR Indexed ({ver.ocrCharCount} chars)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px] font-mono">
            Cryptographic Version Registry • AES-256-GCM
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
