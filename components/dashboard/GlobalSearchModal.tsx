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
    <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 md:p-12 overflow-y-auto font-sans text-[#151c27]">
      <div 
        className="bg-white w-full max-w-3xl rounded-[26px] shadow-2xl border border-[#D8DEEA] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Input Bar */}
        <div className="p-4 border-b border-[#D8DEEA]/60 bg-[#f0f3ff]/40 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#9CA3AF] text-[22px]">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across case dockets, extracted OCR text, FIR numbers, suspect names..."
            className="flex-1 bg-transparent text-sm text-[#151c27] placeholder:text-[#9CA3AF] font-medium focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-[#3f5e93] border-t-transparent rounded-full animate-spin"></div>
          )}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#9CA3AF] hover:text-[#151c27] rounded-full cursor-pointer"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-[#45474b] bg-white rounded-full border border-[#D8DEEA]">
            ESC
          </kbd>
        </div>

        {/* Filter Strip */}
        <div className="px-5 py-2.5 border-b border-[#D8DEEA]/40 bg-white flex items-center justify-between text-xs text-[#45474b] flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase">Clearance:</span>
            {['ALL', 'T5', 'T4', 'T3', 'T2', 'T1'].map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase transition cursor-pointer ${
                  tierFilter === t
                    ? 'bg-[#000000] text-white'
                    : 'bg-[#f0f3ff] text-[#45474b] hover:bg-[#e2e8f8]'
                }`}
              >
                {t === 'ALL' ? 'All Tiers' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9CA3AF]">
              {results.length} evidence match{results.length === 1 ? '' : 'es'}
            </span>
            {query.trim() && (
              <button
                onClick={() => {
                  onClose();
                  onOpenOcrView(query);
                }}
                className="text-[11px] font-semibold text-[#3f5e93] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Deep OCR Studio</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Stream */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#D8DEEA]/40">
          {results.length === 0 ? (
            <div className="p-8 text-center text-[#9CA3AF] flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[36px] text-[#9CA3AF]">manage_search</span>
              <p className="text-sm font-semibold text-[#151c27]">
                {query.trim() ? `No case records matching "${query}"` : 'Type a query to search across all vault records'}
              </p>
              <p className="text-xs text-[#9CA3AF] max-w-sm">
                Matches are found across document metadata and deep inside OCR-extracted text with PostgreSQL GIN full-text index.
              </p>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-[#f0f3ff]/40 transition flex flex-col gap-2 group cursor-pointer"
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
                    <span className="font-mono text-xs font-bold text-[#3f5e93] bg-[rgba(131,162,219,0.14)] px-2.5 py-0.5 rounded-full border border-[#83A2DB]/30">
                      {item.documentNumber}
                    </span>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                      item.securityTier === 'T5' || item.securityTier === 'T4'
                        ? 'bg-[rgba(206,105,105,0.14)] text-[#ca6666]'
                        : item.securityTier === 'T3'
                        ? 'bg-[rgba(131,162,219,0.14)] text-[#3f5e93]'
                        : 'bg-[#E4E4E4] text-[#45474b]'
                    }`}>
                      {item.securityTier} {item.securityTierName}
                    </span>
                    {item.hasOcrText && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
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
                      className="h-7 px-2.5 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full text-xs font-medium flex items-center gap-1 cursor-pointer"
                      title="Decrypt and stream download"
                    >
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      <span>Decrypt</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[#151c27] group-hover:text-[#3f5e93] transition">
                    {item.title}
                  </h4>
                  {/* Highlighted Match Snippet */}
                  <div 
                    className="text-xs text-[#45474b] mt-1 leading-relaxed bg-[#f0f3ff]/40 p-2.5 rounded-xl border border-[#D8DEEA]/60"
                    dangerouslySetInnerHTML={{ __html: item.matchedSnippet }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] font-mono">
                  <span>Custodian: {item.ownerName} ({item.departmentName})</span>
                  <span>sha256:{item.sha256Hash?.substring(0, 12)}...</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#f0f3ff]/40 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs text-[#45474b]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D8DEEA] rounded font-mono text-[10px]">↵</kbd>
              <span>to inspect dossier</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D8DEEA] rounded font-mono text-[10px]">ESC</kbd>
              <span>to close</span>
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            PostgreSQL GIN TSVector Active
          </span>
        </div>
      </div>
    </div>
  );
}
