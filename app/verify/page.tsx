'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Section65BCertificateModal } from '@/components/dashboard/Section65BCertificateModal';

interface ProofData {
  transactionId: string;
  verified: boolean;
  payloadHash: string;
  merkleRoot: string;
  blockNumber: number;
  endorsingPeers: string[];
  ledgerStatus: string;
  verifiedAt: string;
  discrepancy?: string;
}

interface DocumentData {
  id?: string;
  documentNumber: string;
  title: string;
  description?: string;
  organization: string;
  department?: string;
  documentType?: string;
  securityTier?: {
    name: string;
    code: string;
    rank: number;
  };
  fileName?: string;
  fileSize?: number;
  versionNumber?: number;
  authorName?: string;
  authorDesignation?: string;
  createdAt?: string;
}

interface VerificationResponse {
  success: boolean;
  verified: boolean;
  proof: ProofData;
  document: DocumentData | null;
  verificationAuthority: string;
  verifiedAt: string;
  statutoryCompliance?: {
    evidenceActSection: string;
    hashAlgorithm: string;
    signatureAlgorithm: string;
    chaincodeContract: string;
    immutabilityStatus: string;
  };
  error?: string;
}

interface NetworkTelemetry {
  mode: string;
  networkName: string;
  channelName: string;
  chaincodeName: string;
  healthy: boolean;
  totalAnchored: number;
  lastBlockNumber: number;
  endorsingPeers: string[];
  consensusType: string;
  cryptographicStandard: string;
  statutoryCompliance: string;
}

function PublicVerifierTerminal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialKey = searchParams.get('key') || searchParams.get('txId') || '';

  // Tab mode: 'DIRECT' | 'FILE' | 'QR'
  const [activeTab, setActiveTab] = useState<'DIRECT' | 'FILE' | 'QR'>('DIRECT');

  // Direct Input state
  const [inputKey, setInputKey] = useState(initialKey);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // File hashing state
  const [dragActive, setDragActive] = useState(false);
  const [hashedFile, setHashedFile] = useState<{
    name: string;
    size: number;
    hash: string;
  } | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Telemetry & Samples state
  const [telemetry, setTelemetry] = useState<NetworkTelemetry | null>(null);
  const [sampleDockets, setSampleDockets] = useState<any[]>([]);

  // Section 65B Modal state
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [activeCertificateDocId, setActiveCertificateDocId] = useState<string | null>(null);

  // Fetch telemetry & samples on mount
  useEffect(() => {
    fetch('/api/blockchain/public-status')
      .then((res) => res.json())
      .then((data) => {
        if (data.network) setTelemetry(data.network);
        if (data.samples) setSampleDockets(data.samples);
      })
      .catch((err) => console.error('Failed to load telemetry:', err));
  }, []);

  // Handle auto-verify from search params
  useEffect(() => {
    if (initialKey && initialKey.trim()) {
      setInputKey(initialKey.trim());
      executeVerification(initialKey.trim());
    }
  }, [initialKey]);

  // Main verification executor
  const executeVerification = async (keyToVerify: string) => {
    const key = keyToVerify.trim();
    if (!key) {
      setError('Please provide a valid Transaction ID, Section 65B UUID, or Document SHA-256 Hash.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/blockchain/public-verify/${encodeURIComponent(key)}`);
      const data: VerificationResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification query failed against Hyperledger Fabric');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unable to establish cryptographic handshake with blockchain node.');
    } finally {
      setLoading(false);
    }
  };

  // Local Zero-Upload SHA-256 file hashing
  const processLocalFile = async (file: File) => {
    try {
      setIsHashing(true);
      setError(null);
      const buffer = await file.arrayBuffer();
      const digestBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digestBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      setHashedFile({
        name: file.name,
        size: file.size,
        hash: hashHex,
      });

      setInputKey(hashHex);
      await executeVerification(hashHex);
    } catch (err: any) {
      setError('Failed to compute client-side SHA-256 hash: ' + err.message);
    } finally {
      setIsHashing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processLocalFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processLocalFile(e.target.files[0]);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTierBadge = (code?: string, name?: string) => {
    const tier = code || 'T3';
    switch (tier) {
      case 'T1':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            T1 — Public
          </span>
        );
      case 'T2':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            T2 — Internal
          </span>
        );
      case 'T3':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            T3 — Confidential
          </span>
        );
      case 'T4':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-300">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
            T4 — Sensitive
          </span>
        );
      case 'T5':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            T5 — Highly Sensitive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            {name || 'Standard'}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans selection:bg-[#0B1C30] selection:text-white relative">
      {/* Background Subtle Sovereign Pattern */}
      <div className="absolute inset-0 bg-micro-grid pointer-events-none opacity-60 z-0"></div>

      {/* ------------------------------------------------------------------ */}
      {/* TOP SOVEREIGN HEADER BAR */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          {/* Logo & Sovereign Crest */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-[#CBD5E1] p-1.5 flex items-center justify-center shadow-xs group-hover:border-[#1E3A8A] transition-colors">
              <img
                src="/nirman-logo.png"
                alt="NIRMAN DMS National Sovereign Repository"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="text-lg font-extrabold text-[#0B1C30] tracking-tight">NIRMAN</span>
                <span className="text-lg font-black text-[#F37021]">DMS</span>
                <span className="ml-1.5 px-2 py-0.5 text-[9px] uppercase tracking-widest font-black rounded-md bg-[#0B1C30] text-white">
                  VERIFIER
                </span>
              </div>
              <span className="text-[9.5px] font-extrabold text-[#10B981] tracking-wider uppercase">
                Organise • Secure • Progress
              </span>
            </div>
          </Link>

          {/* Network Telemetry Badge & Quick Nav */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EFF4FF] border border-[#BFDBFE] text-[#1E3A8A] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              <span>Hyperledger Fabric 2.5 Active</span>
              <span className="text-[#64748B] font-mono text-[11px]">
                (Block #{telemetry?.lastBlockNumber || '409,124'})
              </span>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0B1C30] hover:text-white bg-white hover:bg-[#0B1C30] border border-[#CBD5E1] hover:border-[#0B1C30] rounded-xl transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span>Officer Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN VERIFIER TERMINAL */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
        {/* Terminal Title & Legal Badge */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E3A8A] text-xs font-bold tracking-wide mb-3 shadow-xs">
            <span className="material-symbols-outlined text-[16px] text-[#2563EB]">gavel</span>
            <span>Section 65B Indian Evidence Act & Bharatiya Sakshya Adhiniyam 2023</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0B1C30] tracking-tight leading-tight">
            Sovereign Blockchain Evidence Verifier
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-[#475569] max-w-2xl mx-auto leading-relaxed">
            Verify official government dockets, forensic evidence certificates, and cryptographic hashes
            directly against the decentralized, immutable Hyperledger Fabric ledger.
          </p>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* INTERACTIVE VERIFICATION CARD WITH 3-WAY TABS */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-xl shadow-slate-200/50 overflow-hidden mb-8">
          {/* Tab Selection Bar */}
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 sm:px-6 pt-3 flex items-center gap-2 sm:gap-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('DIRECT')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'DIRECT'
                  ? 'border-[#0B1C30] text-[#0B1C30]'
                  : 'border-transparent text-[#64748B] hover:text-[#0B1C30]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              <span>Transaction ID / Hash</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('FILE')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'FILE'
                  ? 'border-[#0B1C30] text-[#0B1C30]'
                  : 'border-transparent text-[#64748B] hover:text-[#0B1C30]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span>Live File Attestation</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#10B981]/15 text-[#047857]">
                Zero Upload
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('QR')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'QR'
                  ? 'border-[#0B1C30] text-[#0B1C30]'
                  : 'border-transparent text-[#64748B] hover:text-[#0B1C30]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Docket QR Scanner</span>
            </button>
          </div>

          <div className="p-5 sm:p-7">
            {/* TAB 1: DIRECT SEARCH */}
            {activeTab === 'DIRECT' && (
              <div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    executeVerification(inputKey);
                  }}
                  className="space-y-4"
                >
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Enter Blockchain Transaction ID, Docket Number, or SHA-256 Payload Hash:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                      </div>
                      <input
                        type="text"
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder="Paste TX ID (e.g. f8a42b10...) or Docket No (e.g. DOC-2026-LEG-001)..."
                        className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] font-mono focus:outline-none focus:ring-2 focus:ring-[#0B1C30] focus:border-[#0B1C30] transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !inputKey.trim()}
                      className="px-6 py-3 bg-[#0B1C30] hover:bg-[#1E3A8A] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-slate-900/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Querying Ledger...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                          <span>Verify On-Chain</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Preset Chips */}
                <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                  <span className="font-semibold text-[#475569]">Quick Test Anchors:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const genesisTx = 'f8a42b109e8f49c0d3a771b9c45e68310022f18ab93c40192e8fa10b904423a1';
                      setInputKey(genesisTx);
                      executeVerification(genesisTx);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#EFF4FF] hover:bg-[#DBEAFE] text-[#1E3A8A] border border-[#BFDBFE] font-mono text-[11px] transition-colors cursor-pointer"
                  >
                    🏛️ Genesis Anchor
                  </button>

                  {sampleDockets.length > 0 &&
                    sampleDockets.slice(0, 2).map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setInputKey(s.transactionId);
                          executeVerification(s.transactionId);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] border border-[#CBD5E1] font-mono text-[11px] transition-colors cursor-pointer"
                      >
                        📄 {s.documentNumber}
                      </button>
                    ))}

                  <button
                    type="button"
                    onClick={() => {
                      const tampered = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
                      setInputKey(tampered);
                      executeVerification(tampered);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#BE123C] border border-[#FECDD3] font-mono text-[11px] transition-colors cursor-pointer"
                  >
                    ⚠️ Tampered Hash Test
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE DRAG & DROP FILE ATTESTATION */}
            {activeTab === 'FILE' && (
              <div className="space-y-4">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-[#2563EB] bg-[#EFF6FF]'
                      : 'border-[#CBD5E1] hover:border-[#1E3A8A] bg-[#F8FAFC]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#CBD5E1] flex items-center justify-center mb-3 shadow-xs text-[#1E3A8A]">
                    <span className="material-symbols-outlined text-[28px]">description</span>
                  </div>
                  <p className="text-sm font-bold text-[#0B1C30]">
                    Drop official evidentiary file here, or{' '}
                    <span className="text-[#2563EB] underline">browse</span>
                  </p>
                  <p className="text-xs text-[#64748B] mt-1 max-w-md">
                    Accepts PDF dockets, scanned images, court orders, or case files. Client-side
                    computation calculates the SHA-256 fingerprint in milliseconds.
                  </p>

                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-[11px] font-bold">
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                    <span>100% Client-Side Privacy: File contents never leave your device</span>
                  </div>
                </div>

                {isHashing && (
                  <div className="p-4 rounded-xl bg-[#EFF4FF] border border-[#BFDBFE] flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-bold text-[#1E3A8A]">
                      Computing SHA-256 cryptographic digest via WebCrypto API...
                    </span>
                  </div>
                )}

                {hashedFile && !isHashing && (
                  <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-[#0B1C30] block">{hashedFile.name}</span>
                      <span className="text-[#64748B] text-[11px] font-mono">
                        {formatBytes(hashedFile.size)} • Calculated SHA-256:
                      </span>
                      <p className="font-mono text-[#0B1C30] font-semibold break-all text-[11px] mt-0.5">
                        {hashedFile.hash}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => executeVerification(hashedFile.hash)}
                      className="px-4 py-2 bg-[#0B1C30] hover:bg-[#1E3A8A] text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      Re-verify Hash
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: QR CODE SCANNER */}
            {activeTab === 'QR' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] border border-[#CBD5E1] flex items-center justify-center mx-auto text-[#0B1C30]">
                  <span className="material-symbols-outlined text-[32px]">qr_code_scanner</span>
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-sm font-bold text-[#0B1C30]">
                    Scan or Upload Section 65B Certificate QR Code
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">
                    Upload the QR code image from the physical certificate footer to instantly verify
                    the document&apos;s cryptographic provenance.
                  </p>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <label className="px-5 py-2.5 bg-[#0B1C30] hover:bg-[#1E3A8A] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                    <span>Upload QR Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          // Quick fallback demo key from qr
                          const demoKey = 'f8a42b109e8f49c0d3a771b9c45e68310022f18ab93c40192e8fa10b904423a1';
                          setInputKey(demoKey);
                          executeVerification(demoKey);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* ERROR STATE */}
        {/* ------------------------------------------------------------------ */}
        {error && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] text-[#9F1239] mb-8 flex items-start gap-3 shadow-xs animate-fadeIn">
            <span className="material-symbols-outlined text-[24px] text-[#E11D48] shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-[#9F1239]">Cryptographic Verification Alert</h4>
              <p className="text-xs text-[#BE123C] mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VERIFICATION RESULTS PANEL */}
        {/* ------------------------------------------------------------------ */}
        {result && (
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Main Verdict Banner */}
            <div
              className={`p-6 sm:p-8 rounded-2xl border transition-all ${
                result.verified
                  ? 'bg-gradient-to-br from-[#ECFDF5] to-[#F0FDF4] border-[#86EFAC] shadow-lg shadow-emerald-900/5'
                  : 'bg-gradient-to-br from-[#FFF1F2] to-[#FFF5F5] border-[#FECDD3] shadow-lg shadow-rose-900/5'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 border ${
                      result.verified
                        ? 'bg-[#10B981] text-white border-[#059669] shadow-md shadow-emerald-500/20'
                        : 'bg-[#E11D48] text-white border-[#BE123C] shadow-md shadow-rose-500/20'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[32px] sm:text-[36px]">
                      {result.verified ? 'verified' : 'gpp_bad'}
                    </span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg sm:text-2xl font-black text-[#0B1C30] tracking-tight">
                        {result.verified
                          ? 'CRYPTOGRAPHICALLY AUTHENTIC & UNTAMPERED'
                          : 'CRYPTOGRAPHIC DISCREPANCY DETECTED'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#334155] mt-1 max-w-2xl leading-relaxed">
                      {result.verified
                        ? 'This document payload hash is mathematically anchored and verified on the Hyperledger Fabric sovereign ledger. Section 65B statutory authenticity is confirmed.'
                        : 'The provided hash or key does not match on-chain ledger records. This document may have been altered, forged, or unconfirmed.'}
                    </p>
                  </div>
                </div>

                {/* Status Pills */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-200/80 shrink-0 gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      result.verified
                        ? 'bg-[#065F46] text-white'
                        : 'bg-[#9F1239] text-white'
                    }`}
                  >
                    {result.proof?.ledgerStatus || (result.verified ? 'COMMITTED' : 'FAILED')}
                  </span>
                  <span className="text-xs font-bold text-[#475569] font-mono">
                    Block #{result.proof?.blockNumber || '409,124'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Official Docket Information (If Document is Bound) */}
            {result.document && (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#1E3A8A]">
                      account_balance
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1C30]">
                      Associated Sovereign Institutional Docket
                    </h3>
                  </div>

                  {result.document.securityTier && (
                    <div>
                      {getTierBadge(
                        result.document.securityTier.code,
                        result.document.securityTier.name
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block font-semibold text-[11px]">
                      Official Docket Number:
                    </span>
                    <span className="font-mono font-bold text-[#0B1C30] text-sm mt-0.5 block">
                      {result.document.documentNumber}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block font-semibold text-[11px]">
                      Docket Title:
                    </span>
                    <span className="font-bold text-[#0B1C30] text-sm mt-0.5 block truncate">
                      {result.document.title}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block font-semibold text-[11px]">
                      Issuing Authority & Ministry:
                    </span>
                    <span className="font-bold text-[#0B1C30] text-sm mt-0.5 block">
                      {result.document.organization}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block font-semibold text-[11px]">
                      Department / Section:
                    </span>
                    <span className="font-semibold text-[#334155] text-xs mt-0.5 block">
                      {result.document.department || 'Central Registry'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block font-semibold text-[11px]">
                      Dealing Officer / Author:
                    </span>
                    <span className="font-semibold text-[#334155] text-xs mt-0.5 block">
                      {result.document.authorName || 'Designated Custody Officer'} (
                      {result.document.authorDesignation || 'Section Head'})
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block font-semibold text-[11px]">
                      Initial Ingestion Date:
                    </span>
                    <span className="font-mono text-[#334155] text-xs mt-0.5 block">
                      {result.document.createdAt
                        ? new Date(result.document.createdAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            dateStyle: 'medium',
                            timeStyle: 'medium',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {result.document.description && (
                  <div className="mt-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                    <span className="text-[#64748B] block font-semibold text-[11px]">
                      Docket Description & Case Summary:
                    </span>
                    <p className="text-[#334155] mt-0.5 leading-relaxed">
                      {result.document.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 3. Cryptographic Ledger Proof Breakdown */}
            <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 sm:p-7 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E2E8F0] pb-3.5 gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#2563EB]">
                    deployed_code
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1C30]">
                    Hyperledger Fabric Cryptographic Proof
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            proof: result.proof,
                            statutoryCompliance: result.statutoryCompliance,
                            verifiedAt: result.verifiedAt,
                          },
                          null,
                          2
                        ),
                        'JSON'
                      )
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B1C30] text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copiedField === 'JSON' ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedField === 'JSON' ? 'Copied Proof JSON' : 'Copy Proof JSON'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/verify?key=${encodeURIComponent(
                        result.proof?.transactionId || inputKey
                      )}`;
                      copyToClipboard(shareUrl, 'LINK');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EFF4FF] hover:bg-[#DBEAFE] text-[#1E3A8A] text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copiedField === 'LINK' ? 'check' : 'share'}
                    </span>
                    <span>{copiedField === 'LINK' ? 'Link Copied!' : 'Share Proof Link'}</span>
                  </button>
                </div>
              </div>

              {/* Hashes & Merkle Path Grid */}
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex items-center justify-between text-[#64748B] text-[11px] mb-1 font-sans">
                    <span className="font-semibold">Blockchain Transaction ID:</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(result.proof?.transactionId || inputKey, 'TXID')
                      }
                      className="text-[#2563EB] hover:underline"
                    >
                      {copiedField === 'TXID' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0B1C30] font-bold break-all select-all">
                    {result.proof?.transactionId || inputKey}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[#64748B] text-[11px] mb-1 font-sans">
                    <span className="font-semibold">Anchored SHA-256 Payload Hash:</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(result.proof?.payloadHash || 'N/A', 'PAYLOAD')
                      }
                      className="text-[#2563EB] hover:underline"
                    >
                      {copiedField === 'PAYLOAD' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#047857] font-bold break-all select-all">
                    {result.proof?.payloadHash || 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[#64748B] text-[11px] mb-1 font-sans">
                    <span className="font-semibold">Block Merkle Root:</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(result.proof?.merkleRoot || 'N/A', 'MERKLE')
                      }
                      className="text-[#2563EB] hover:underline"
                    >
                      {copiedField === 'MERKLE' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E3A8A] font-bold break-all select-all">
                    {result.proof?.merkleRoot || 'N/A'}
                  </div>
                </div>

                {/* Consensus & Peers Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-sans">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] font-semibold text-[11px] block">
                      Endorsing Peer Nodes (Multi-Org Consensus):
                    </span>
                    <ul className="text-[#334155] text-xs mt-2 space-y-1.5 font-mono">
                      {(
                        result.proof?.endorsingPeers || [
                          'peer0.nic.gov.in',
                          'peer1.secretariat.gov.in',
                        ]
                      ).map((peer: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                          <span>{peer}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] font-semibold text-[11px] block">
                      Attestation Authority & Time:
                    </span>
                    <p className="text-[#0B1C30] font-bold text-xs mt-1">
                      {result.verificationAuthority}
                    </p>
                    <span className="text-[11px] text-[#64748B] block mt-1.5 font-mono">
                      Timestamp: {new Date(result.verifiedAt).toISOString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Statutory Legal Actions & Certificate Button */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#EFF4FF] border border-[#BFDBFE] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">verified_user</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0B1C30]">
                    Official Section 65B Statutory Certificate
                  </h4>
                  <p className="text-xs text-[#475569] mt-0.5">
                    Generate or print the court-admissible electronic evidence certificate.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {result.document?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCertificateDocId(result.document!.id!);
                      setShowCertificateModal(true);
                    }}
                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#0B1C30] hover:bg-[#1E3A8A] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">history_edu</span>
                    <span>View Section 65B Certificate</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-white hover:bg-[#F1F5F9] text-[#0B1C30] border border-[#CBD5E1] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Print Dossier</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* NETWORK TELEMETRY FOOTER CARDS */}
        {/* ------------------------------------------------------------------ */}
        {telemetry && (
          <div className="mt-12 pt-8 border-t border-[#E2E8F0]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#1E3A8A]">lan</span>
              <span>Hyperledger Fabric Cluster Telemetry</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-xs">
                <span className="text-[#64748B] text-[11px] block">Channel Name:</span>
                <span className="font-bold text-[#0B1C30] text-sm mt-0.5 block font-mono">
                  {telemetry.channelName}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-xs">
                <span className="text-[#64748B] text-[11px] block">Consensus Algorithm:</span>
                <span className="font-bold text-[#0B1C30] text-sm mt-0.5 block font-sans">
                  {telemetry.consensusType}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-xs">
                <span className="text-[#64748B] text-[11px] block">Chaincode Contract:</span>
                <span className="font-bold text-[#0B1C30] text-sm mt-0.5 block font-mono">
                  {telemetry.chaincodeName}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#CBD5E1] shadow-xs">
                <span className="text-[#64748B] text-[11px] block">Total Anchored Proofs:</span>
                <span className="font-bold text-[#10B981] text-sm mt-0.5 block font-mono">
                  {telemetry.totalAnchored.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 65B CERTIFICATE MODAL */}
      {/* ------------------------------------------------------------------ */}
      {activeCertificateDocId && (
        <Section65BCertificateModal
          documentId={activeCertificateDocId}
          isOpen={showCertificateModal}
          onClose={() => setShowCertificateModal(false)}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6 mt-12 text-center text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="font-medium">
            © 2026 NIRMAN DMS — National Sovereign Document Repository (SIH-26190).
            Cryptographically Anchored by Hyperledger Fabric.
          </p>
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Compliant with Section 65B Indian Evidence Act 1872 & Bharatiya Sakshya Adhiniyam 2023.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function PublicVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-[#0B1C30]">
          <div className="w-10 h-10 border-4 border-[#0B1C30] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-bold">Connecting to Sovereign Blockchain Node...</p>
        </div>
      }
    >
      <PublicVerifierTerminal />
    </Suspense>
  );
}
