// =============================================================================
// GET /api/blockchain/verify/:txId — Transaction Verification & Proof API
// =============================================================================
// Verifies a previously anchored transaction and returns a cryptographic
// proof including Merkle root, endorsing peers, and tamper-detection status.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { BlockchainService } from '@/lib/blockchain/service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { txId } = await params;

    if (!txId || txId.length < 16) {
      return NextResponse.json(
        { error: 'Invalid transaction ID. Provide a valid blockchain transaction hash.' },
        { status: 400 }
      );
    }

    const proof = await BlockchainService.verifyTransaction(txId);

    return NextResponse.json({
      success: true,
      proof,
    });
  } catch (error: any) {
    console.error('[BLOCKCHAIN_VERIFY_API_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify blockchain transaction' },
      { status: 500 }
    );
  }
}
