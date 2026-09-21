'use client';

import React, { use } from 'react';
import { useRouter } from 'next/navigation';

export default function DirectVerifyRoute({
  params,
}: {
  params: Promise<{ txId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  React.useEffect(() => {
    if (resolvedParams?.txId) {
      router.replace(`/verify?key=${encodeURIComponent(resolvedParams.txId)}`);
    } else {
      router.replace('/verify');
    }
  }, [resolvedParams, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-spin mb-4">
        <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <p className="text-sm font-medium">Resolving Cryptographic Blockchain Proof...</p>
    </div>
  );
}
