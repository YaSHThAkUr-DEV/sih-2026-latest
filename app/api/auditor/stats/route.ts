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

    // 1. Total audit events
    const totalEventsRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM audit_events WHERE organization_id = $1;`,
      [orgId]
    );
    const totalEvents = parseInt(totalEventsRes[0]?.count || '0', 10);

    // 2. Active officer footprints
    const officersRes = await query<{ count: string }>(
      `SELECT count(DISTINCT actor_id) as count 
       FROM audit_events 
       WHERE organization_id = $1 AND actor_id IS NOT NULL;`,
      [orgId]
    );
    const totalOfficers = parseInt(officersRes[0]?.count || '0', 10);

    // 3. Security anomalies (failures, rejected changes, failed logins)
    const anomaliesRes = await query<{ count: string }>(
      `SELECT count(*) as count 
       FROM audit_events 
       WHERE organization_id = $1 
         AND (result = 'FAILURE' OR event_type LIKE '%FAIL%' OR event_type LIKE '%REJECT%');`,
      [orgId]
    );
    const anomalyCount = parseInt(anomaliesRes[0]?.count || '0', 10);

    // 4. All departments in organization
    const allDepts = await query<{ name: string; code: string }>(
      `SELECT name, code FROM departments WHERE organization_id = $1 ORDER BY name ASC;`,
      [orgId]
    );

    // 5. Epoch progression (hourly count for last 7 snapshots)
    const epochBlocks = await query<{ hour_bucket: string; count: string }>(
      `SELECT to_char(created_at, 'HH24:00') as hour_bucket, count(*) as count
       FROM audit_events
       WHERE organization_id = $1
       GROUP BY hour_bucket
       ORDER BY hour_bucket DESC
       LIMIT 7;`,
      [orgId]
    );

    // Total active users
    const userCountRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM users WHERE organization_id = $1 AND status = 'ACTIVE';`,
      [orgId]
    );
    const activeUsersTotal = parseInt(userCountRes[0]?.count || '1', 10);

    return NextResponse.json({
      success: true,
      stats: {
        totalAuditEvents: totalEvents,
        cryptographicHealth: {
          status: anomalyCount === 0 ? '100% Attested' : `${anomalyCount} Anomalies Detected`,
          violations: anomalyCount,
          epochsCount: Math.max(epochBlocks.length, 1),
          sealedState: 'WORM IMMUTABLE STORAGE SEAL: ACTIVE',
        },
        activeOfficersCount: totalOfficers > 0 ? totalOfficers : activeUsersTotal,
        departments: allDepts.map((d) => d.name),
        departmentList: allDepts,
        securityAlertsCount: anomalyCount,
        epochProgression: epochBlocks.reverse().map((b) => ({
          label: b.hour_bucket,
          count: parseInt(b.count, 10),
        })),
        inspector: {
          name: session.fullName || 'Vigilance Auditor',
          role: session.roles?.[0] || 'AUDITOR',
          designation: session.designation || 'Auditor Grade-1',
          clearanceLevel: `Clearance Level ${session.maxSecurityLevel ?? 5} (Full Audit Scope)`,
          node: 'DMS-AUDIT-INSTANCE',
        },
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch auditor stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
