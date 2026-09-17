import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.organizationId;

    // Fetch policies with document count
    const policies = await query<{
      id: string;
      name: string;
      schedule_code: string;
      retention_days: number;
      permanent: boolean;
      deletion_requires_approval: boolean;
      action_on_expiry: string;
      statutory_framework: string;
      description: string;
      document_count: string;
    }>(
      `SELECT 
         p.id,
         p.name,
         COALESCE(p.schedule_code, 'SCHEDULE_GENERAL') as schedule_code,
         p.retention_days,
         p.permanent,
         p.deletion_requires_approval,
         COALESCE(p.action_on_expiry, 'Crypto-Shred After Expiry') as action_on_expiry,
         COALESCE(p.statutory_framework, 'BNSS 2023') as statutory_framework,
         p.description,
         COUNT(r.id)::text as document_count
       FROM retention_policies p
       LEFT JOIN retention_records r ON r.retention_policy_id = p.id
       WHERE p.organization_id = $1
       GROUP BY p.id
       ORDER BY p.retention_days DESC`,
      [orgId]
    );

    return NextResponse.json({
      policies: policies.map((p) => ({
        id: p.id,
        name: p.name,
        scheduleCode: p.schedule_code,
        retentionDays: p.retention_days,
        retentionYears: p.retention_days ? Math.round(p.retention_days / 365) : 0,
        permanent: p.permanent,
        deletionRequiresApproval: p.deletion_requires_approval,
        actionOnExpiry: p.action_on_expiry,
        statutoryFramework: p.statutory_framework,
        description: p.description,
        documentCount: parseInt(p.document_count, 10) || 0,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching retention policies:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
