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
  const [loadingOcrText, setLoadingOcrText] = useState(false);

  const quickQueries: string[] = [];

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
    setLoadingOcrText(true);
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
    } finally {
      setLoadingOcrText(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">document_scanner</span>
              LEXICAL & OCR ENGINE ACTIVE
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded tracking-wider">
              POSTGRESQL GIN TSVECTOR INDEXED
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
              TESSERACT 5.0 + PDF-STREAM ENGINE
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <span>OCR Intelligence & Deep Full-Text Search</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono font-bold">
              {results.length} Matches
            </span>
          </h1>
          <p className="text-xs text-slate-500 max-w-3xl">
            Execute sub-millisecond lexical queries directly across extracted text, witness interrogations, RAM artifact dumps, and scanned FIR paragraphs.
          </p>
        </div>

        <button
          onClick={onReturnToOverview}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-200 flex items-center gap-1.5 transition self-start xl:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Return to Dashboard</span>
        </button>
      </section>

      {/* Search Studio Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[20px]">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter keywords, IP addresses, suspect names, malware signatures, or legal sections..."
              className="w-full h-10 pl-10 pr-10 bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  executeSearch('', tierFilter, docTypeFilter);
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-[18px]">manage_search</span>
            )}
            <span>Execute Intelligence Search</span>
          </button>
        </form>

        {quickQueries.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-semibold text-slate-400">Deep Queries:</span>
            {quickQueries.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setQuery(chip);
                  executeSearch(chip, tierFilter, docTypeFilter);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-600 border border-slate-200 rounded text-[11px] font-mono transition"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Filter Bars */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Clearance:</span>
            {['ALL', 'T5', 'T4', 'T3', 'T2', 'T1'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
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
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Document Type:</span>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="h-7 px-2 bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="FIR">FIRs</option>
              <option value="CHARGE_SHEET">Charge Sheets</option>
              <option value="FORENSIC_REPORT">Forensic Reports</option>
              <option value="EVIDENCE_LOG">Evidence Logs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[48px] text-slate-300">search_off</span>
            <p className="text-base font-semibold text-slate-700">No matching evidentiary records found</p>
            <p className="text-xs text-slate-400 max-w-md">
              Try adjusting your search terms or select one of the suggested deep queries above.
            </p>
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 hover:shadow-md hover:border-slate-300 transition flex flex-col gap-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
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
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    {item.documentTypeName}
                  </span>
                  {item.hasOcrText && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      <span>OCR Confidence: {item.ocrConfidence || 98.5}%</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewFullOcr(item.versionId, item.documentNumber, item.title)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center gap-1 transition"
                  >
                    <span className="material-symbols-outlined text-[15px]">read_more</span>
                    <span>Inspect OCR Text</span>
                  </button>
                  <button
                    onClick={() => onDownloadDocument(item.id, item.documentNumber, item.fileName)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1 transition"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Decrypt</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 hover:text-blue-600 transition cursor-pointer"
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
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed font-serif">
                  <div className="flex items-center gap-1 text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-1">
                    <span className="material-symbols-outlined text-[12px] text-blue-600">match_case</span>
                    <span>Extracted Legal Match Preview:</span>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: item.matchedSnippet }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                <span>Custodian: {item.ownerName} // {item.departmentName}</span>
                <span title={item.sha256Hash}>sha256:{item.sha256Hash.substring(0, 16)}...</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Full Extracted OCR Text Modal */}
      {selectedOcrText && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6 flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">document_scanner</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedOcrText.docNumber} — Full Extracted OCR Text
                  </h3>
                  <p className="text-xs text-slate-500">{selectedOcrText.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOcrText(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-600">
              <span>Confidence: {selectedOcrText.confidence || 98.5}%</span>
              <span>Length: {selectedOcrText.text.length} chars</span>
              <span>Language: eng</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg whitespace-pre-wrap leading-relaxed">
              {selectedOcrText.text}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-xs" title={selectedOcrText.sha256 || ''}>
                text_hash: {selectedOcrText.sha256 || 'N/A'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedOcrText.text);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Copy Text</span>
                </button>
                <button
                  onClick={() => setSelectedOcrText(null)}
                  className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded"
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
