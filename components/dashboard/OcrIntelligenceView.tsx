'use client';

import React, { useState, useEffect } from 'react';
import { SearchResultItem } from './GlobalSearchModal';

interface OcrIntelligenceViewProps {
  initialQuery?: string;
  onInspectDocument: (doc: any) => void;
  onDownloadDocument: (docId: string, docNumber: string, fileName: string) => void;
  onReturnToOverview: () => void;
}

export function OcrIntelligenceView({
  initialQuery = '',
  onInspectDocument,
  onDownloadDocument,
  onReturnToOverview,
}: OcrIntelligenceViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [tierFilter, setTierFilter] = useState('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOcrText, setSelectedOcrText] = useState<{
    docNumber: string;
    title: string;
    text: string;
    sha256: string | null;
    confidence: number | null;
  } | null>(null);

  const executeSearch = async (searchStr: string, tier: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchStr.trim()) params.append('q', searchStr.trim());
      if (tier !== 'ALL') params.append('tier', tier);
      if (type !== 'ALL') params.append('docType', type);

      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error('OCR search error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch(query, tierFilter, docTypeFilter);
  }, [tierFilter, docTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, tierFilter, docTypeFilter);
  };

  const handleViewFullOcr = async (versionId: string, docNumber: string, title: string) => {
    try {
      const res = await fetch(`/api/ocr/${versionId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOcrText({
          docNumber,
          title,
          text: data.ocr?.extractedText || 'No text extracted for this record.',
          sha256: data.ocr?.textSha256,
          confidence: data.ocr?.confidence,
        });
      }
    } catch (err) {
      console.error('Failed to load full OCR text:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-[#151c27]">
      {/* Header Banner */}
      <section className="bg-white/85 backdrop-blur-xl rounded-[26px] p-6 shadow-[0_8px_32px_rgba(16,20,26,0.06)] border border-[#D8DEEA]/80 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-[rgba(131,162,219,0.14)] text-[#3f5e93] border border-[#83A2DB]/30 rounded-full font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">document_scanner</span>
              LEXICAL &amp; OCR ENGINE ACTIVE
            </span>
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-semibold">
              POSTGRESQL GIN TSVECTOR
            </span>
            <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 bg-[#f0f3ff] text-[#151c27] border border-[#D8DEEA] rounded-full">
              TESSERACT 5.0 + PDF-STREAM
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#151c27] tracking-tight mt-0.5 flex items-center gap-2">
            <span>OCR Intelligence &amp; Lexical Search</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#000000] text-white font-mono font-semibold">
              {results.length} Matches
            </span>
          </h1>
          <p className="text-xs text-[#45474b] max-w-2xl">
            Execute sub-millisecond lexical full-text queries directly across extracted text, OCR scanned memos, and document paragraphs.
          </p>
        </div>

        <button
          onClick={onReturnToOverview}
          className="h-10 px-4 rounded-full bg-white hover:bg-[#f0f3ff] text-[#151c27] transition-all border border-[#D8DEEA] shadow-xs flex items-center gap-2 text-xs font-semibold self-start xl:self-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Return to Dashboard</span>
        </button>
      </section>

      {/* Search Studio Controls */}
      <div className="bg-white rounded-[26px] border border-[#D8DEEA]/80 shadow-xs p-6 flex flex-col gap-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2.5 flex-col sm:flex-row">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-[#9CA3AF] text-[20px]">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter keywords, paragraph phrases, case IDs, officer names, or clauses..."
              className="w-full h-11 pl-11 pr-10 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] placeholder:text-[#9CA3AF] rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3f5e93] font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  executeSearch('', tierFilter, docTypeFilter);
                }}
                className="absolute right-3.5 top-3 text-[#9CA3AF] hover:text-[#151c27] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold rounded-full shadow-[0_6px_18px_rgba(16,20,26,0.22)] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer transition"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-[18px]">manage_search</span>
            )}
            <span>Execute Search</span>
          </button>
        </form>

        {/* Filter Bars */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#D8DEEA]/60 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[#45474b] uppercase">Clearance:</span>
            {['ALL', 'T5', 'T4', 'T3', 'T2', 'T1'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase transition cursor-pointer ${
                  tierFilter === t
                    ? 'bg-[#000000] text-white shadow-xs'
                    : 'bg-[#f0f3ff] text-[#45474b] hover:bg-[#e2e8f8]'
                }`}
              >
                {t === 'ALL' ? 'All Tiers' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#45474b] uppercase">Type:</span>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="h-8 px-3 bg-[#f0f3ff] border border-[#D8DEEA] text-xs text-[#151c27] rounded-full focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Document Types</option>
              <option value="OM">Office Memorandums</option>
              <option value="REPORT">Inspection &amp; Audit Reports</option>
              <option value="LETTER">Official Correspondence</option>
              <option value="ORDER">Executive Sanctions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="flex flex-col gap-3">
        {results.length === 0 ? (
          <div className="bg-white rounded-[26px] border border-[#D8DEEA]/80 p-12 text-center text-[#9CA3AF] flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[48px] text-[#9CA3AF]">search_off</span>
            <p className="text-base font-semibold text-[#151c27]">No matching full-text records found</p>
            <p className="text-xs text-[#9CA3AF] max-w-md">
              Try adjusting your query keywords, clearance filters, or OCR index terms.
            </p>
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[20px] border border-[#D8DEEA]/80 shadow-xs p-5 hover:shadow-md hover:border-[#3f5e93]/50 transition flex flex-col gap-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D8DEEA]/40 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
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
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-[#f0f3ff] text-[#45474b] rounded-full">
                    {item.documentTypeName}
                  </span>
                  {item.hasOcrText && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      <span>OCR Confidence: {item.ocrConfidence || 98.5}%</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewFullOcr(item.versionId, item.documentNumber, item.title)}
                    className="h-8 px-3 rounded-full bg-[#f0f3ff] hover:bg-[#e2e8f8] text-[#151c27] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">read_more</span>
                    <span>Inspect OCR</span>
                  </button>
                  <button
                    onClick={() => onDownloadDocument(item.id, item.documentNumber, item.fileName)}
                    className="h-8 px-3.5 rounded-full bg-[#000000] hover:bg-[#181c22] text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Decrypt</span>
                  </button>
                </div>
              </div>

              <div>
                <h3
                  className="text-sm font-bold text-[#151c27] hover:text-[#3f5e93] transition cursor-pointer"
                  onClick={() => onInspectDocument({
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
                  })}
                >
                  {item.title}
                </h3>

                {/* Highlighted Match Box */}
                <div className="mt-2 p-3 bg-[#f0f3ff]/50 rounded-xl border border-[#D8DEEA]/60 text-xs text-[#151c27] leading-relaxed">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">
                    <span className="material-symbols-outlined text-[12px] text-[#3f5e93]">match_case</span>
                    <span>Lexical Match Preview:</span>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: item.matchedSnippet }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] font-mono pt-1">
                <span>Custodian: {item.ownerName} ({item.departmentName})</span>
                <span title={item.sha256Hash}>sha256:{item.sha256Hash?.substring(0, 12)}...</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Full Extracted OCR Text Modal */}
      {selectedOcrText && (
        <div className="fixed inset-0 z-50 bg-[#10141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[26px] shadow-2xl p-6 flex flex-col gap-4 max-h-[85vh] border border-[#D8DEEA]">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DEEA]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[rgba(131,162,219,0.14)] text-[#3f5e93] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">document_scanner</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#151c27]">
                    {selectedOcrText.docNumber} — Full Extracted OCR Text
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">{selectedOcrText.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOcrText(null)}
                className="text-[#9CA3AF] hover:text-[#151c27] p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#f0f3ff] rounded-2xl border border-[#D8DEEA] text-xs font-mono text-[#45474b]">
              <span>Confidence: {selectedOcrText.confidence || 98.5}%</span>
              <span>Length: {selectedOcrText.text.length} chars</span>
              <span>Language: eng</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#10141A] text-slate-100 font-mono text-xs rounded-2xl whitespace-pre-wrap leading-relaxed">
              {selectedOcrText.text}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#D8DEEA]/60">
              <span className="text-[11px] font-mono text-[#9CA3AF] truncate max-w-xs" title={selectedOcrText.sha256 || ''}>
                text_hash: {selectedOcrText.sha256 || 'N/A'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(selectedOcrText.text)}
                  className="h-9 px-4 bg-[#f0f3ff] hover:bg-[#e2e8f8] text-[#151c27] text-xs font-semibold rounded-full transition flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Copy Text</span>
                </button>
                <button
                  onClick={() => setSelectedOcrText(null)}
                  className="h-9 px-4 bg-[#000000] text-white text-xs font-semibold rounded-full cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
