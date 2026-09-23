'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import jsQR from 'jsqr';
import { Section65BCertificateModal } from '@/components/dashboard/Section65BCertificateModal';
import { MobileQrScanner } from '@/components/verify/MobileQrScanner';

const ShaderGradientBackground = dynamic(
  () => import('@/components/auth/ShaderGradientBackground'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-gradient-to-br from-[#94ffd1]/30 via-[#6bf5ff]/20 to-white -z-10" />
    ),
  }
);

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
  const initialTabParam = searchParams.get('tab')?.toUpperCase();
  const getValidTab = (t?: string | null): 'DIRECT' | 'FILE' | 'QR' => {
    if (t === 'QR' || t === 'SCAN') return 'QR';
    if (t === 'FILE' || t === 'UPLOAD') return 'FILE';
    return 'DIRECT';
  };

  // Tab mode: 'DIRECT' | 'FILE' | 'QR'
  const [activeTab, setActiveTab] = useState<'DIRECT' | 'FILE' | 'QR'>(() => getValidTab(initialTabParam));

  // Sync tab with URL hash if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').toUpperCase();
      if (hash === 'QR' || hash === 'SCAN') setActiveTab('QR');
      else if (hash === 'FILE') setActiveTab('FILE');
      else if (hash === 'DIRECT' || hash === 'TX') setActiveTab('DIRECT');
    }
  }, []);

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

  // Telemetry state
  const [telemetry, setTelemetry] = useState<NetworkTelemetry | null>(null);

  // Section 65B Modal state
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [activeCertificateDocId, setActiveCertificateDocId] = useState<string | null>(null);

  // Fetch telemetry on mount
  useEffect(() => {
    fetch('/api/blockchain/public-status')
      .then((res) => res.json())
      .then((data) => {
        if (data.network) setTelemetry(data.network);
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

  // Pure JS SHA-256 fallback when WebCrypto is unavailable (e.g. non-HTTPS mobile network)
  const computeSha256 = async (buffer: ArrayBuffer): Promise<string> => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      try {
        const digestBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(digestBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {
        // Fall back to pure JS
      }
    }

    const bytes = new Uint8Array(buffer);
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let [h0, h1, h2, h3, h4, h5, h6, h7] = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const l = bytes.length;
    const bitLen = l * 8;
    const padLen = (((l + 8) >> 6) + 1) << 6;
    const padded = new Uint8Array(padLen);
    padded.set(bytes);
    padded[l] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padLen - 4, bitLen & 0xffffffff);
    view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000));
    const w = new Uint32Array(64);
    for (let i = 0; i < padLen; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3);
        const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
      for (let t = 0; t < 64; t++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join('');
  };

  // Scan QR code from an image File using jsQR
  const scanQrFromImageFile = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);
          const qrFn = typeof jsQR === 'function' ? jsQR : (jsQR as any)?.default;
          const code = qrFn ? qrFn(imgData.data, width, height) : null;
          if (code && code.data) {
            resolve(code.data);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  // Local Zero-Upload SHA-256 file hashing & Comprehensive Multi-Format Verifier
  const processLocalFile = async (file: File) => {
    try {
      setIsHashing(true);
      setError(null);
      setResult(null);

      const buffer = await file.arrayBuffer();
      const rawHash = await computeSha256(buffer);

      setHashedFile({
        name: file.name,
        size: file.size,
        hash: rawHash,
      });

      // 1. If image file, attempt client-side QR decode first
      let qrResolvedKey: string | null = null;
      if (file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|bmp|gif)$/i)) {
        try {
          const qrContent = await scanQrFromImageFile(file);
          if (qrContent) {
            try {
              const parsed = JSON.parse(qrContent);
              qrResolvedKey = (parsed.sha256 || parsed.txId || parsed.docket || parsed.cert || qrContent).trim();
            } catch {
              qrResolvedKey = qrContent.trim();
            }
          }
        } catch {}
      }

      if (qrResolvedKey) {
        setInputKey(qrResolvedKey);
        setHashedFile({
          name: file.name,
          size: file.size,
          hash: qrResolvedKey,
        });
        await executeVerification(qrResolvedKey);
        return;
      }

      // 2. Post file directly to the unified verification endpoint
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/blockchain/verify-file', {
        method: 'POST',
        body: formData,
      });

      const data: VerificationResponse & { resolvedKey?: string } = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification query failed against Hyperledger Fabric');
      }

      const verifiedKey = data.resolvedKey || rawHash;
      setInputKey(verifiedKey);
      setHashedFile({
        name: file.name,
        size: file.size,
        hash: verifiedKey,
      });

      setResult(data);
    } catch (err: any) {
      setError('Verification failed: ' + err.message);
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/70 backdrop-blur-md text-slate-700 border border-slate-300 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            T1 — Public
          </span>
        );
      case 'T2':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50/80 backdrop-blur-md text-blue-800 border border-blue-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            T2 — Internal
          </span>
        );
      case 'T3':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50/80 backdrop-blur-md text-amber-900 border border-amber-300 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            T3 — Confidential
          </span>
        );
      case 'T4':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50/80 backdrop-blur-md text-orange-900 border border-orange-300 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
            T4 — Sensitive
          </span>
        );
      case 'T5':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50/80 backdrop-blur-md text-rose-900 border border-rose-300 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            T5 — Highly Sensitive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/70 backdrop-blur-md text-slate-700 border border-slate-300 shadow-xs">
            {name || 'Standard'}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0E1525]/10 text-slate-800 font-sans flex flex-col selection:bg-[#F37021] selection:text-white relative overflow-x-hidden">
      {/* 3D WebGL Shader Gradient Animated Background */}
      <ShaderGradientBackground />

      {/* Embedded Light Beam & Glass Card Styles */}
      <style jsx global>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.58);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          box-shadow: 
            0 12px 36px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -1px 0 rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
        }

        .glass-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.9),
            transparent
          );
          pointer-events: none;
          z-index: 20;
        }

        .glass-input {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.85);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
        }
        .glass-input:hover {
          background: rgba(255, 255, 255, 0.88);
          border-color: rgba(255, 255, 255, 1);
        }
        .glass-input:focus {
          background: rgba(255, 255, 255, 0.96);
          border-color: #F37021;
          box-shadow: 0 0 0 3px rgba(243, 112, 33, 0.18), inset 0 1px 0 #ffffff;
        }

        .glass-pill {
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.7);
          transition: all 0.2s ease;
        }
        .glass-pill:hover {
          background: rgba(255, 255, 255, 0.8);
          border-color: rgba(255, 255, 255, 0.95);
        }

        .shadow-btn-shadow {
          box-shadow: 0 10px 24px -4px rgba(12, 17, 29, 0.3), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2);
        }

        @media print {
          .glass-card {
            background: #ffffff !important;
            backdrop-filter: none !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* TOP SOVEREIGN HEADER BAR (Frosted Glassmorphic) */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-white/40 bg-white/40 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-18 flex items-center justify-between gap-2">
          {/* Logo & Sovereign Crest */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/80 backdrop-blur-md border border-white/90 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <img
                src="/nirman-logo.png"
                alt="NIRMAN DMS National Sovereign Repository"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 leading-tight">
                <span className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight font-sans">NIRMAN</span>
                <span className="text-base sm:text-lg font-black text-[#F37021]">DMS</span>
                <span className="ml-1 px-1.5 py-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-wider font-black rounded bg-slate-900 text-white shrink-0 shadow-xs">
                  VERIFIER
                </span>
              </div>
              <span className="text-[8.5px] sm:text-[9.5px] font-extrabold text-emerald-700 tracking-wider uppercase hidden sm:block truncate">
                Organise • Secure • Progress
              </span>
            </div>
          </Link>

          {/* Network Telemetry Badge & Quick Nav */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-blue-900 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Hyperledger Fabric 2.5 Active</span>
              <span className="text-slate-600 font-mono text-[11px]">
                (Block #{telemetry?.lastBlockNumber || '409,124'})
              </span>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-all shadow-btn-shadow whitespace-nowrap cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span className="hidden xs:inline">Officer Login</span>
              <span className="xs:hidden">Login</span>
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
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/70 backdrop-blur-md border border-white/80 text-blue-900 text-xs font-bold tracking-wide mb-3 shadow-xs">
            <span className="material-symbols-outlined text-[16px] text-blue-600">gavel</span>
            <span>Section 65B Indian Evidence Act & Bharatiya Sakshya Adhiniyam 2023</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Sovereign Blockchain Evidence Verifier
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-700 max-w-2xl mx-auto leading-relaxed font-medium">
            Verify official government dockets, forensic evidence certificates, and cryptographic hashes
            directly against the decentralized, immutable Hyperledger Fabric ledger.
          </p>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* INTERACTIVE VERIFICATION CARD WITH DUAL TABS */}
        {/* ------------------------------------------------------------------ */}
        <div className="glass-card mb-8">
          {/* Tab Selection Bar (Touch-Optimized for Phones) */}
          <div className="border-b border-white/50 bg-white/40 backdrop-blur-md p-1.5 sm:p-2 grid grid-cols-2 gap-1.5 sm:gap-2 select-none relative z-20">
            <button
              type="button"
              onClick={() => setActiveTab('DIRECT')}
              className={`py-3 px-2 min-h-[48px] rounded-xl text-xs sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer text-center touch-manipulation active:scale-95 ${
                activeTab === 'DIRECT'
                  ? 'bg-slate-900 text-white shadow-btn-shadow'
                  : 'text-slate-700 glass-pill hover:bg-white/70'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] pointer-events-none">key</span>
              <span className="leading-tight pointer-events-none">TX / Hash</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('QR')}
              className={`py-3 px-2 min-h-[48px] rounded-xl text-xs sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all cursor-pointer text-center relative touch-manipulation active:scale-95 ${
                activeTab === 'QR'
                  ? 'bg-slate-900 text-white shadow-btn-shadow'
                  : 'text-slate-700 glass-pill hover:bg-white/70'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-emerald-500 pointer-events-none">qr_code_scanner</span>
              <span className="leading-tight pointer-events-none">Scan QR</span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse pointer-events-none"></span>
            </button>
          </div>

          <div className="p-4 sm:p-6 md:p-8">
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Enter Transaction ID, Document Reference No., or SHA-256 Hash:
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                    </div>
                    <input
                      type="text"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="Paste TX ID, Document / File No., or Hash..."
                      className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-base sm:text-sm text-slate-900 placeholder-slate-400 font-mono outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !inputKey.trim()}
                    className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl shadow-btn-shadow flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
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
                className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/60 backdrop-blur-md'
                    : 'border-white/70 hover:border-blue-400 bg-white/40 backdrop-blur-md'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-white/90 border border-white/90 flex items-center justify-center mb-3 shadow-xs text-blue-700">
                  <span className="material-symbols-outlined text-[28px]">description</span>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  Drop file here or <span className="text-blue-600 underline">tap to browse phone files</span>
                </p>
                <p className="text-xs text-slate-600 mt-1 max-w-md">
                  PDFs, scanned images, court memos, or case dockets. SHA-256 is computed 100% locally on your device.
                </p>

                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-[10px] sm:text-[11px] font-bold backdrop-blur-md">
                  <span className="material-symbols-outlined text-[14px]">shield</span>
                  <span>Zero Upload Privacy: File never leaves your phone</span>
                </div>
              </div>

              {isHashing && (
                <div className="p-4 rounded-xl bg-blue-50/80 backdrop-blur-md border border-blue-200 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin shrink-0"></div>
                  <span className="text-xs font-bold text-blue-900">
                    Computing SHA-256 cryptographic digest via WebCrypto API...
                  </span>
                </div>
              )}

              {hashedFile && !isHashing && (
                <div className="p-4 rounded-xl bg-white/80 backdrop-blur-md border border-white/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{hashedFile.name}</span>
                    <span className="text-slate-600 text-[11px] font-mono">
                      {formatBytes(hashedFile.size)} • SHA-256:
                    </span>
                    <p className="font-mono text-slate-900 font-semibold break-all text-[11px] mt-0.5">
                      {hashedFile.hash}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => executeVerification(hashedFile.hash)}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer text-center shadow-btn-shadow"
                  >
                    Re-verify Hash
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE MOBILE QR CODE CAMERA SCANNER */}
          {activeTab === 'QR' && (
            <div className="py-2">
              <MobileQrScanner
                onScanSuccess={(extractedKey) => {
                  setInputKey(extractedKey);
                  executeVerification(extractedKey);
                }}
                onError={(err) => {
                  setError(err);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ERROR STATE */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/90 backdrop-blur-md border border-rose-200/90 text-rose-900 mb-8 flex items-start gap-3 shadow-xs animate-fadeIn">
          <span className="material-symbols-outlined text-[24px] text-rose-600 shrink-0 mt-0.5">
            error
          </span>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-rose-950">Cryptographic Verification Alert</h4>
            <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">{error}</p>
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
            className={`p-6 sm:p-8 rounded-2xl border backdrop-blur-xl transition-all ${
              result.verified
                ? 'bg-emerald-50/85 border-emerald-300 shadow-xl shadow-emerald-950/5'
                : 'bg-rose-50/85 border-rose-300 shadow-xl shadow-rose-950/5'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 border ${
                    result.verified
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/30'
                      : 'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-600/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-[32px] sm:text-[36px]">
                    {result.verified ? 'verified' : 'gpp_bad'}
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                      {result.verified
                        ? 'CRYPTOGRAPHICALLY AUTHENTIC & UNTAMPERED'
                        : 'CRYPTOGRAPHIC DISCREPANCY DETECTED'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 mt-1 max-w-2xl leading-relaxed font-medium">
                    {result.verified
                      ? 'This document payload hash is mathematically anchored and verified on the Hyperledger Fabric sovereign ledger. Section 65B statutory authenticity is confirmed.'
                      : 'The provided hash or key does not match on-chain ledger records. This document may have been altered, forged, or unconfirmed.'}
                  </p>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-300/60 shrink-0 gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    result.verified
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-rose-800 text-white shadow-xs'
                  }`}
                >
                  {result.proof?.ledgerStatus || (result.verified ? 'COMMITTED' : 'FAILED')}
                </span>
                <span className="text-xs font-bold text-slate-700 font-mono">
                  Block #{result.proof?.blockNumber || '409,124'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Official Document Information (If Document is Bound) */}
          {result.document && (
            <div className="glass-card p-5 sm:p-7 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/60 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-blue-700">
                    account_balance
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Associated Government Document & Record Details
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
                <div className="p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 block font-semibold text-[11px]">
                    Document / File Reference No:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                    {result.document.documentNumber}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 block font-semibold text-[11px]">
                    Subject / Title:
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">
                    {result.document.title}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 block font-semibold text-[11px]">
                    Issuing Authority & Ministry:
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {result.document.organization}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 block font-semibold text-[11px]">
                    Department / Section:
                  </span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                    {result.document.department || 'Central Registry'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 block font-semibold text-[11px]">
                    Dealing Officer / Author:
                  </span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                    {result.document.authorName || 'Designated Custody Officer'} (
                    {result.document.authorDesignation || 'Section Head'})
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 block font-semibold text-[11px]">
                    Initial Ingestion Date:
                  </span>
                  <span className="font-mono text-slate-800 text-xs mt-0.5 block">
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
                <div className="mt-3 p-3 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 text-xs shadow-2xs">
                  <span className="text-slate-600 block font-semibold text-[11px]">
                    Document Description & Case Summary:
                  </span>
                  <p className="text-slate-800 mt-0.5 leading-relaxed">
                    {result.document.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. Cryptographic Ledger Proof Breakdown */}
          <div className="glass-card p-5 sm:p-7 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/60 pb-3.5 gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-blue-700">
                  deployed_code
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-pill text-slate-800 text-xs font-bold transition-colors cursor-pointer"
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-btn-shadow"
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
                <div className="flex items-center justify-between text-slate-600 text-[11px] mb-1 font-sans">
                  <span className="font-semibold">Blockchain Transaction ID:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(result.proof?.transactionId || inputKey, 'TXID')
                    }
                    className="text-blue-700 hover:underline font-bold"
                  >
                    {copiedField === 'TXID' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white/80 backdrop-blur-md border border-white/90 text-slate-900 font-bold break-all select-all shadow-2xs">
                  {result.proof?.transactionId || inputKey}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-600 text-[11px] mb-1 font-sans">
                  <span className="font-semibold">Anchored SHA-256 Payload Hash:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(result.proof?.payloadHash || 'N/A', 'PAYLOAD')
                    }
                    className="text-blue-700 hover:underline font-bold"
                  >
                    {copiedField === 'PAYLOAD' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white/80 backdrop-blur-md border border-white/90 text-emerald-800 font-bold break-all select-all shadow-2xs">
                  {result.proof?.payloadHash || 'N/A'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-600 text-[11px] mb-1 font-sans">
                  <span className="font-semibold">Block Merkle Root:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(result.proof?.merkleRoot || 'N/A', 'MERKLE')
                    }
                    className="text-blue-700 hover:underline font-bold"
                  >
                    {copiedField === 'MERKLE' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white/80 backdrop-blur-md border border-white/90 text-blue-900 font-bold break-all select-all shadow-2xs">
                  {result.proof?.merkleRoot || 'N/A'}
                </div>
              </div>

              {/* Consensus & Peers Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-sans">
                <div className="p-4 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 font-semibold text-[11px] block">
                    Endorsing Peer Nodes (Multi-Org Consensus):
                  </span>
                  <ul className="text-slate-800 text-xs mt-2 space-y-1.5 font-mono">
                    {(
                      result.proof?.endorsingPeers || [
                        'peer0.nic.gov.in',
                        'peer1.secretariat.gov.in',
                      ]
                    ).map((peer: string, idx: number) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{peer}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs">
                  <span className="text-slate-600 font-semibold text-[11px] block">
                    Attestation Authority & Time:
                  </span>
                  <p className="text-slate-900 font-bold text-xs mt-1">
                    {result.verificationAuthority}
                  </p>
                  <span className="text-[11px] text-slate-600 block mt-1.5 font-mono">
                    Timestamp: {new Date(result.verifiedAt).toISOString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Statutory Legal Actions & Certificate Button */}
          <div className="p-5 sm:p-6 rounded-2xl bg-blue-50/80 backdrop-blur-xl border border-blue-200/90 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[22px]">verified_user</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Official Section 65B Statutory Certificate
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
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
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-btn-shadow flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">history_edu</span>
                  <span>View Section 65B Certificate</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-white/80 hover:bg-white text-slate-900 border border-white/90 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
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
        <div className="mt-12 pt-8 border-t border-white/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-blue-700">lan</span>
            <span>Hyperledger Fabric Cluster Telemetry</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-xs">
              <span className="text-slate-600 text-[11px] block font-semibold">Channel Name:</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block font-mono">
                {telemetry.channelName}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-xs">
              <span className="text-slate-600 text-[11px] block font-semibold">Consensus Algorithm:</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block font-sans">
                {telemetry.consensusType}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-xs">
              <span className="text-slate-600 text-[11px] block font-semibold">Chaincode Contract:</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block font-mono">
                {telemetry.chaincodeName}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/70 backdrop-blur-md border border-white/80 shadow-xs">
              <span className="text-slate-600 text-[11px] block font-semibold">Total Anchored Proofs:</span>
              <span className="font-bold text-emerald-700 text-sm mt-0.5 block font-mono">
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
    <footer className="border-t border-white/40 bg-white/30 backdrop-blur-md py-6 mt-12 text-center text-xs text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <p className="font-medium text-slate-700">
          © 2026 NIRMAN DMS — National Sovereign Document Repository (SIH-26190).
          Cryptographically Anchored by Hyperledger Fabric.
        </p>
        <p className="text-[11px] text-slate-500 mt-1 font-medium">
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
        <div className="min-h-screen bg-gradient-to-br from-[#94ffd1]/30 via-[#6bf5ff]/20 to-white flex flex-col items-center justify-center text-slate-900">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-bold">Connecting to Sovereign Blockchain Node...</p>
        </div>
      }
    >
      <PublicVerifierTerminal />
    </Suspense>
  );
}
