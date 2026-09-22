'use client';

import React, { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-[#0B1C30] font-sans relative">
      <div className="absolute inset-0 bg-micro-grid pointer-events-none opacity-60"></div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-white border border-[#CBD5E1] flex items-center justify-center shadow-md mb-4">
          <div className="w-6 h-6 border-3 border-[#0B1C30] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h3 className="text-sm font-bold text-[#0B1C30]">
          Resolving Sovereign Blockchain Ledger Proof...
        </h3>
        <p className="text-xs text-[#64748B] mt-1 font-mono">
          {resolvedParams?.txId ? `Query: ${resolvedParams.txId.substring(0, 24)}...` : 'Connecting...'}
        </p>
      </div>
    </div>
  );
}
