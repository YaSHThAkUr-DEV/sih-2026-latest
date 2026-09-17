// =============================================================================
// GET /api/blockchain/status — Blockchain Network Health & Stats API
// =============================================================================
// Returns the current health, mode, and statistics of the blockchain
// integration including total anchored transactions, pending count,
// and last block information.
// =============================================================================

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { BlockchainService } from '@/lib/blockchain/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await BlockchainService.getNetworkStatus();

    return NextResponse.json({
      success: true,
      blockchain: status,
    });
  } catch (error: any) {
    console.error('[BLOCKCHAIN_STATUS_API_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve blockchain status' },
      { status: 500 }
    );
  }
}
