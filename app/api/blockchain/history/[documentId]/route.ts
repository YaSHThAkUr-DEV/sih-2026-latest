// =============================================================================
// GET /api/blockchain/history/:documentId — Document Anchor History API
// =============================================================================
// Returns all blockchain anchoring records associated with a specific document,
// including transaction IDs, block numbers, and anchor timestamps.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { BlockchainService } from '@/lib/blockchain/service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId parameter.' },
        { status: 400 }
      );
    }

    const history = await BlockchainService.getAnchorHistory(documentId);

    return NextResponse.json({
      success: true,
      documentId,
      totalAnchors: history.length,
      anchors: history,
    });
  } catch (error: any) {
    console.error('[BLOCKCHAIN_HISTORY_API_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve document anchor history' },
      { status: 500 }
    );
  }
}
