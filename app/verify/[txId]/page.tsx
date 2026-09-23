'use client';

import React, { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const ShaderGradientBackground = dynamic(
  () => import('@/components/auth/ShaderGradientBackground'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-gradient-to-br from-[#94ffd1]/30 via-[#6bf5ff]/20 to-white -z-10" />
    ),
  }
);

export default function DirectVerifyRoute({
  params,
}: {
  params: Promise<{ txId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  useEffect(() => {
    if (resolvedParams?.txId) {
      router.replace(`/verify?key=${encodeURIComponent(resolvedParams.txId)}`);
    } else {
      router.replace('/verify');
    }
  }, [resolvedParams, router]);

  return (
    <div className="min-h-screen w-full bg-[#0E1525]/10 text-slate-800 font-sans flex flex-col items-center justify-center relative overflow-hidden">
      <ShaderGradientBackground />

      <div className="relative z-10 flex flex-col items-center p-6 sm:p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-2xl shadow-slate-900/10 text-center max-w-sm mx-4">
        <div className="w-14 h-14 rounded-2xl bg-white/90 border border-white p-2 flex items-center justify-center shadow-sm mb-4">
          <img
            src="/nirman-logo.png"
            alt="NIRMAN DMS"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="w-6 h-6 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mb-3"></div>
        <h3 className="text-sm font-bold text-slate-900">
          Resolving Sovereign Blockchain Proof...
        </h3>
        <p className="text-xs text-slate-600 mt-1 font-mono">
          {resolvedParams?.txId ? `Query: ${resolvedParams.txId.substring(0, 20)}...` : 'Connecting...'}
        </p>
      </div>
    </div>
  );
}
