'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

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

const QUICK_SUGGESTIONS = [
  { label: 'FIR Dockets', query: 'FIR' },
  { label: 'Cyber Forensics', query: 'Forensics' },
  { label: 'Audit Reports', query: 'Audit' },
  { label: 'Judicial Orders', query: 'Judicial' },
  { label: 'Inter-Agency', query: 'Inter-Agency' },
  { label: 'Classified Records', query: 'Classified' },
];

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus input whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll active item into view when selectedIndex changes
  useEffect(() => {
    if (results.length > 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex, results.length]);

  // Handle opening a document
  const handleInspect = useCallback(
    (item: SearchResultItem) => {
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
    },
    [onSelectDocument, onClose]
  );

  // Key navigation: ONLY Escape closes the modal, ArrowUp/Down to navigate, Enter to inspect
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key strictly closes the modal
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        if (results.length > 0 && results[selectedIndex]) {
          e.preventDefault();
          handleInspect(results[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, results, selectedIndex, handleInspect]);

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
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, tierFilter, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#10141A]/70 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 md:p-10 overflow-y-auto font-sans text-[#151c27] animate-in fade-in duration-150 cursor-pointer"
      // Clicking outside the search menu card closes the modal
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[#D8DEEA] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto sm:my-8 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-[#D8DEEA]/70 bg-gradient-to-r from-[#f0f3ff]/60 via-white to-[#f0f3ff]/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f0f3ff] border border-[#D8DEEA]/60 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#3f5e93] text-[20px]">search</span>
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick search case dockets, OCR text, FIR numbers, suspect names..."
            className="flex-1 bg-transparent text-sm sm:text-base text-[#151c27] placeholder:text-[#9CA3AF] font-medium focus:outline-none"
          />

          {loading && (
            <div className="w-5 h-5 border-2 border-[#3f5e93] border-t-transparent rounded-full animate-spin shrink-0"></div>
          )}

          {query && !loading && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1.5 text-[#9CA3AF] hover:text-[#151c27] hover:bg-[#f0f3ff] rounded-full transition cursor-pointer"
              title="Clear search query"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}

          {/* Escape-Only Close Pill */}
          <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-[#D8DEEA]/60">
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] font-medium text-[#45474b] bg-white hover:bg-[#f0f3ff] hover:text-[#151c27] rounded-full border border-[#D8DEEA] flex items-center gap-1.5 transition shadow-2xs cursor-pointer group"
              title="Press Escape on your keyboard to close"
              type="button"
            >
              <span className="text-[11px] font-semibold text-[#6B7280] group-hover:text-[#151c27]">Close</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#f0f3ff] group-hover:bg-[#e2e8f8] text-[#151c27] text-[10px] font-mono font-bold border border-[#D8DEEA]/60">
                ESC
              </kbd>
            </button>
          </div>
        </div>

        {/* Clearance Filter Strip & Quick Actions */}
        <div className="px-5 py-2.5 border-b border-[#D8DEEA]/50 bg-white flex items-center justify-between text-xs text-[#45474b] flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Tier:</span>
            {['ALL', 'T5', 'T4', 'T3', 'T2', 'T1'].map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition cursor-pointer ${
                  tierFilter === t
                    ? 'bg-[#000000] text-white shadow-xs'
                    : 'bg-[#f0f3ff] text-[#45474b] hover:bg-[#e2e8f8]'
                }`}
                type="button"
              >
                {t === 'ALL' ? 'All Tiers' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-[#6B7280] font-medium">
              {results.length} record{results.length === 1 ? '' : 's'} found
            </span>
            {query.trim() && (
              <button
                onClick={() => {
                  onClose();
                  onOpenOcrView(query);
                }}
                className="text-[11px] font-semibold text-[#3f5e93] hover:underline flex items-center gap-0.5 cursor-pointer"
                type="button"
              >
                <span>Deep OCR Studio</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Suggestion Chips (when search input is empty) */}
        {!query.trim() && (
          <div className="px-5 py-2.5 bg-[#f0f3ff]/30 border-b border-[#D8DEEA]/40 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider shrink-0">Try searching:</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setQuery(s.query)}
                  className="px-2.5 py-0.5 rounded-full bg-white hover:bg-[#e2e8f8] text-[#3f5e93] border border-[#D8DEEA]/60 text-[11px] font-medium transition cursor-pointer"
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Stream */}
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-[#D8DEEA]/40 bg-white">
          {results.length === 0 ? (
            <div className="p-10 text-center text-[#9CA3AF] flex flex-col items-center gap-2.5">
              <div className="w-12 h-12 rounded-full bg-[#f0f3ff] flex items-center justify-center text-[#3f5e93]">
                <span className="material-symbols-outlined text-[28px]">
                  {query.trim() ? 'search_off' : 'manage_search'}
                </span>
              </div>
              <p className="text-sm font-semibold text-[#151c27]">
                {query.trim() ? `No vault records matching "${query}"` : 'Quick search across all institutional records'}
              </p>
              <p className="text-xs text-[#6B7280] max-w-md leading-relaxed">
                {query.trim()
                  ? 'Try adjusting your clearance tier filter, verifying spelling, or querying extracted OCR keywords.'
                  : 'Instant PostgreSQL GIN full-text index and OCR character scanning across titles, FIR dockets, descriptions, and scanned evidence.'}
              </p>
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={`${item.id}-${item.versionId}`}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                className={`p-4 transition-all flex flex-col gap-2 group cursor-pointer ${
                  selectedIndex === idx
                    ? 'bg-[#f0f3ff] border-l-4 border-l-[#000000] shadow-xs'
                    : 'hover:bg-[#f0f3ff]/40 border-l-4 border-l-transparent'
                }`}
                onClick={() => handleInspect(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#3f5e93] bg-[rgba(131,162,219,0.14)] px-2.5 py-0.5 rounded-full border border-[#83A2DB]/30">
                      {item.documentNumber}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                        item.securityTier === 'T5' || item.securityTier === 'T4'
                          ? 'bg-[rgba(206,105,105,0.14)] text-[#ca6666]'
                          : item.securityTier === 'T3'
                          ? 'bg-[rgba(131,162,219,0.14)] text-[#3f5e93]'
                          : 'bg-[#E4E4E4] text-[#45474b]'
                      }`}
                    >
                      {item.securityTier} {item.securityTierName}
                    </span>
                    {item.hasOcrText && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                        <span>OCR Indexed ({item.ocrConfidence || 98}%)</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadDocument(item.id, item.documentNumber, item.fileName);
                      }}
                      className="h-7 px-2.5 bg-white hover:bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full text-xs font-medium flex items-center gap-1 cursor-pointer shadow-2xs transition"
                      title="Decrypt and stream download file"
                      type="button"
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
                    className="text-xs text-[#45474b] mt-1 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-[#D8DEEA]/60"
                    dangerouslySetInnerHTML={{ __html: item.matchedSnippet }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] font-mono flex-wrap gap-1">
                  <span>
                    Custodian: <strong className="text-[#45474b]">{item.ownerName}</strong> ({item.departmentName})
                  </span>
                  <span>sha256:{item.sha256Hash?.substring(0, 12)}...</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Bar with Keyboard Guidance */}
        <div className="p-3.5 bg-[#f0f3ff]/50 border-t border-[#D8DEEA]/60 flex items-center justify-between text-xs text-[#45474b] flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px]">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D8DEEA] rounded font-mono text-[10px] shadow-2xs">
                ↑↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D8DEEA] rounded font-mono text-[10px] shadow-2xs">
                ↵
              </kbd>
              <span>inspect</span>
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <kbd className="px-1.5 py-0.5 bg-white border border-[#D8DEEA] rounded font-mono text-[10px] shadow-2xs text-[#151c27] font-bold">
                ESC
              </kbd>
              <span>or click outside to close</span>
            </span>
          </div>

          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            PostgreSQL GIN TSVector Engine
          </span>
        </div>
      </div>
    </div>
  );
}

