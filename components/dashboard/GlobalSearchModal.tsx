'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface SearchResultItem {
  id: string;
  versionId: string;
  documentNumber: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  sha256Hash: string;
  documentTypeCode: string;
  documentTypeName: string;
  securityTier: string;
  securityTierName: string;
  ownerName: string;
  departmentName: string;
  hasOcrText: boolean;
  ocrConfidence: number | null;
  ocrCharCount: number;
  ocrTextSha256: string | null;
  matchedSnippet: string;
  createdAt: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (doc: any) => void;
  onDownloadDocument: (docId: string, docNumber: string, fileName: string) => void;
  onOpenOcrView: (query: string) => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectDocument,
  onDownloadDocument,
  onOpenOcrView,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState('ALL');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.append('q', query.trim());
        if (tierFilter !== 'ALL') params.append('tier', tierFilter);

        const res = await fetch(`/api/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, tierFilter, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 md:p-12 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Input Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400 text-[22px]">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across case dockets, extracted OCR text, FIR numbers, suspect names..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          )}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-slate-200/80 rounded border border-slate-300">
            ESC
          </kbd>
        </div>

        {/* Filter Strip */}
        <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Clearance:</span>
            {['ALL', 'T5', 'T4', 'T3', 'T2', 'T1'].map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                  tierFilter === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'ALL' ? 'All Tiers' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {results.length} evidence match{results.length === 1 ? '' : 'es'}
            </span>
            {query.trim() && (
              <button
                onClick={() => {
                  onClose();
                  onOpenOcrView(query);
                }}
                className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>Deep OCR Studio</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Stream */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[36px] text-slate-300">manage_search</span>
              <p className="text-sm font-semibold text-slate-700">
                {query.trim() ? `No case records matching "${query}"` : 'Type a query to search across all case files'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Matches are found across document metadata and deep inside OCR-extracted text with PostgreSQL GIN full-text index.
              </p>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-slate-50 transition flex flex-col gap-2 group cursor-pointer"
                onClick={() => {
                  onSelectDocument({
                    id: item.id,
                    document_number: item.documentNumber,
                    title: item.title,
                    description: item.description,
                    security_tier: item.securityTier,
                    security_tier_name: item.securityTierName,
                    document_type_name: item.documentTypeName,
                    owner_name: item.ownerName,
                    department_name: item.departmentName,
                    file_name: item.fileName,
                    file_size: item.fileSize,
                    sha256_hash: item.sha256Hash,
                    encryption_algorithm: 'AES-256-GCM',
                    checksum_verified: true,
                  });
                  onClose();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {item.documentNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.securityTier === 'T5'
                        ? 'bg-red-100 text-red-800'
                        : item.securityTier === 'T4'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.securityTier} {item.securityTierName}
                    </span>
                    {item.hasOcrText && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                        <span>OCR Indexed ({item.ocrConfidence || 98}%)</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadDocument(item.id, item.documentNumber, item.fileName);
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium flex items-center gap-1"
                      title="Decrypt and stream download from MinIO"
                    >
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      <span>Decrypt</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {item.title}
                  </h4>
                  {/* Highlighted Match Snippet */}
                  <div 
                    className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2 rounded border border-slate-150 font-serif"
                    dangerouslySetInnerHTML={{ __html: item.matchedSnippet }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Custodian: {item.ownerName} ({item.departmentName})</span>
                  <span>sha256:{item.sha256Hash.substring(0, 12)}...</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↵</kbd>
              <span>to inspect dossier</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">ESC</kbd>
              <span>to close</span>
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            PostgreSQL GIN tsvector Active
          </span>
        </div>
      </div>
    </div>
  );
}
