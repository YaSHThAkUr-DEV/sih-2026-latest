// =============================================================================
// GET /api/blockchain/records — Paginated Blockchain Ledger Records API
// =============================================================================
// Returns paginated list of anchored blockchain transactions with search,
// status filtering, and associated document / audit event context.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status') || 'ALL';
    const search = (searchParams.get('search') || '').trim();

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`br.ledger_status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      conditions.push(`(
        br.transaction_id ILIKE $${pIdx} OR
        br.payload_hash ILIKE $${pIdx} OR
        br.channel_name ILIKE $${pIdx} OR
        d.document_number ILIKE $${pIdx} OR
        d.title ILIKE $${pIdx} OR
        ae.event_type ILIKE $${pIdx}
      )`);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total count query
    const countSql = `
      SELECT count(*) as total
      FROM blockchain_records br
      LEFT JOIN audit_events ae ON br.audit_event_id = ae.id
      LEFT JOIN documents d ON ae.document_id = d.id
      WHERE ${whereClause};
    `;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    // 2. Data query
    params.push(limit, offset);
    const dataSql = `
      SELECT 
        br.id,
        br.transaction_id,
        br.payload_hash,
        br.ledger_status,
        br.network_name,
        br.channel_name,
        br.chaincode_name,
        br.submitted_at,
        br.confirmed_at,
        ae.id as audit_event_id,
        ae.event_type,
        ae.actor_id,
        ae.ip_address,
        u.full_name as actor_name,
        d.id as document_id,
        d.document_number,
        d.title as document_title
      FROM blockchain_records br
      LEFT JOIN audit_events ae ON br.audit_event_id = ae.id
      LEFT JOIN users u ON ae.actor_id = u.id
      LEFT JOIN documents d ON ae.document_id = d.id
      WHERE ${whereClause}
      ORDER BY br.submitted_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const records = await query<any>(dataSql, params);

    return NextResponse.json({
      success: true,
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('[BLOCKCHAIN_RECORDS_API_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch blockchain records' },
      { status: 500 }
    );
  }
}
