'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function PublicVerifierContent() {
  const searchParams = useSearchParams();
  const initialKey = searchParams.get('key') || searchParams.get('txId') || '';

  const [inputKey, setInputKey] = useState(initialKey);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialKey) {
      handleVerify(initialKey);
    }
  }, [initialKey]);

  const handleVerify = async (keyToVerify?: string) => {
    const key = (keyToVerify || inputKey).trim();
    if (!key) {
      setError('Please provide a valid Transaction ID, Section 65B Key, or Document SHA-256 Hash.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/blockchain/public-verify/${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification query failed');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to blockchain node');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Sovereign Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/nirman-logo.png" alt="NIRMAN DMS" className="w-10 h-10 object-contain rounded-xl shadow-lg border border-slate-700/80 p-0.5 bg-white" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-tight text-white sm:text-lg">
                  NIRMAN <span className="text-amber-500">DMS</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Public Verifier
                </span>
              </div>
              <p className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase hidden sm:block">
                Organise &bull; Secure &bull; Progress
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Hyperledger Fabric Network Active
            </div>
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
            >
              Officer Login →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Section 65B Indian Evidence Act & BNSS Compliant
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Cryptographic Immutability Gateway
          </h1>
          <p className="mt-3 text-slate-400 text-sm sm:text-base">
            Verify official government dockets, forensic evidence certificates, and blockchain anchors directly against the immutable Hyperledger Fabric ledger.
          </p>
        </div>

        {/* Verification Input Box */}
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Paste Transaction ID (e.g. 7f8a3b...) or SHA-256 Hash..."
                className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Querying Ledger...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Verify On-Chain</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Examples */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-500">Quick Test:</span>
            <button
              type="button"
              onClick={() => {
                const sampleTx = 'f8a42b109e8f49c0d3a771b9c45e68310022f18ab93c40192e8fa10b904423a1';
                setInputKey(sampleTx);
                handleVerify(sampleTx);
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-slate-700 font-mono text-[11px] transition-colors"
            >
              Demo Genesis Anchor
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="w-full p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3 text-sm">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Verification Alert</p>
              <p className="text-xs mt-0.5 text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className="w-full space-y-6 animate-fadeIn">
            {/* Main Status Header Card */}
            <div
              className={`p-6 rounded-2xl border ${
                result.verified
                  ? 'bg-emerald-950/30 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
                  : 'bg-red-950/30 border-red-500/40 shadow-xl shadow-red-950/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      result.verified
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {result.verified ? (
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
                        {result.verified ? '100% AUTHENTIC & UNTAMPERED' : 'CRYPTOGRAPHIC DISCREPANCY DETECTED'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                      {result.verified
                        ? 'This document hash has been cryptographically confirmed on the Hyperledger Fabric ledger.'
                        : 'This hash does not match on-chain records. Possible forgery or unauthorized alteration.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      result.verified
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    {result.proof?.ledgerStatus || (result.verified ? 'COMMITTED' : 'FAILED')}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 font-mono">
                    Block #{result.proof?.blockNumber || '409121'}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Context (if available) */}
            {result.document && (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Associated Official Docket
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500">Docket Number:</span>
                    <p className="font-semibold text-white font-mono">{result.document.documentNumber}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Document Title:</span>
                    <p className="font-semibold text-slate-200">{result.document.title}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Issuing Authority:</span>
                    <p className="text-slate-300">{result.document.organization}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Ingestion Timestamp:</span>
                    <p className="text-slate-300 font-mono text-xs">
                      {result.document.createdAt ? new Date(result.document.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cryptographic Ledger Proof Details */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Hyperledger Fabric Cryptographic Proof
                </h3>
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(result.proof, null, 2))}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
                >
                  {copied ? '✓ Copied Proof JSON' : 'Copy Proof JSON'}
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Transaction ID:</span>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-cyan-300 break-all select-all">
                    {result.proof?.transactionId || inputKey}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">Anchored Payload Hash (SHA-256):</span>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-emerald-300 break-all select-all">
                    {result.proof?.payloadHash || 'N/A'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">Block Merkle Root:</span>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-indigo-300 break-all select-all">
                    {result.proof?.merkleRoot || 'N/A'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-500 block text-[11px]">Endorsing Peers:</span>
                    <ul className="text-slate-300 text-xs mt-1 space-y-1">
                      {(result.proof?.endorsingPeers || ['peer0.dms.gov.in', 'peer1.dms.gov.in']).map((peer: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {peer}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-500 block text-[11px]">Attestation Authority:</span>
                    <p className="text-slate-300 text-xs mt-1 font-sans">
                      {result.verificationAuthority}
                    </p>
                    <span className="text-[10px] text-slate-500 block mt-2 font-mono">
                      Verified At: {new Date(result.verifiedAt).toISOString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4">
          <p>© 2026 NIRMAN DMS — National Sovereign Document Repository (SIH-26190). Cryptographically Secured by Hyperledger Fabric.</p>
        </div>
      </footer>
    </div>
  );
}

export default function PublicVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading Verifier Gateway...</div>}>
      <PublicVerifierContent />
    </Suspense>
  );
}
