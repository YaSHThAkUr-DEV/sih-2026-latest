import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const events = await query(
      `SELECT 
         ae.id,
         ae.event_type,
         ae.result,
         ae.created_at,
         ae.event_hash,
         ae.ip_address,
         ae.event_metadata,
         u.full_name as actor_name,
         u.designation as actor_designation,
         d.document_number,
         d.title as document_title
       FROM audit_events ae
       LEFT JOIN users u ON ae.actor_id = u.id
       LEFT JOIN documents d ON ae.document_id = d.id
       WHERE ae.organization_id = $1
       ORDER BY ae.created_at DESC
       LIMIT 10`,
      [session.organizationId]
    );

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: any) {
    console.error('Failed to fetch activity feed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
