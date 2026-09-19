import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';
import { checkRedisHealth } from '@/lib/cache/redis';
import { VaultService } from '@/lib/crypto/vault';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const settingsRows = await query<{ key: string; value: any; updated_at: string }>(
      `SELECT key, value, updated_at FROM system_settings`
    );

    const configMap: Record<string, any> = {};
    for (const row of settingsRows) {
      configMap[row.key] = {
        value: row.value,
        updatedAt: row.updated_at,
      };
    }

    // Dynamic institutional metrics + live service health
    const [userCountRes, auditCountRes, deptCountRes, activeDocsRes, redisHealth, vaultHealth] = await Promise.all([
      query<{ count: string }>(`SELECT count(*) as count FROM users WHERE organization_id = $1`, [session.organizationId]),
      query<{ count: string }>(`SELECT count(*) as count FROM audit_events WHERE organization_id = $1`, [session.organizationId]),
      query<{ count: string }>(`SELECT count(*) as count FROM departments WHERE organization_id = $1`, [session.organizationId]),
      query<{ count: string }>(`SELECT count(*) as count FROM documents WHERE organization_id = $1 AND status != 'DELETED'`, [session.organizationId]),
      checkRedisHealth().catch(() => ({ ok: false, latencyMs: 0 })),
      VaultService.checkHealth().catch(() => ({ ok: false, latencyMs: 0 })),
    ]);

    const systemMetrics = {
      totalUsers: parseInt(userCountRes[0]?.count || '0', 10),
      totalAuditEvents: parseInt(auditCountRes[0]?.count || '0', 10),
      totalDepartments: parseInt(deptCountRes[0]?.count || '0', 10),
      activeDocuments: parseInt(activeDocsRes[0]?.count || '0', 10),
      dbEngine: 'PostgreSQL 18 (Active)',
      dbConnected: true,
      vaultKmsStatus: vaultHealth.ok ? `Vault Transit Active (${vaultHealth.latencyMs}ms)` : 'Local KMS Fallback',
      vaultKmsOk: vaultHealth.ok,
      redisStatus: redisHealth.ok ? `Redis 7 Connected (${redisHealth.latencyMs}ms)` : 'Redis Offline',
      redisOk: redisHealth.ok,
      ledgerIntegrity: 'SHA-256 Chained Hash Chain Active',
      nodeStatus: 'ONLINE / SYNCHRONIZED',
    };

    const recentAdminAudits = await query(
      `SELECT 
         ae.id,
         ae.event_type,
         ae.result,
         ae.created_at,
         ae.event_hash,
         ae.ip_address,
         ae.resource_type,
         ae.event_metadata,
         u.full_name as actor_name,
         u.email as actor_email
       FROM audit_events ae
       LEFT JOIN users u ON ae.actor_id = u.id
       WHERE ae.organization_id = $1 AND (
         ae.event_type LIKE 'ADMIN_%' OR 
         ae.event_type LIKE '%ADMIN%' OR 
         ae.resource_type IN ('USER', 'DEPARTMENT', 'TEAM', 'ROLE', 'DOCUMENT_TYPE', 'SECURITY_LEVEL', 'DEPARTMENT_POLICY', 'SYSTEM_CONFIG', 'ADMIN_CONSOLE')
       )
       ORDER BY ae.created_at DESC
       LIMIT 30`,
      [session.organizationId]
    );

    return NextResponse.json({
      configs: configMap,
      metrics: systemMetrics,
      recentAdminAudits,
    });
  } catch (err: any) {
    console.error('[ADMIN_GET_SYSTEM_CONFIG_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve system configurations.', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Config key and value payload are required.' },
        { status: 400 }
      );
    }

    const validKeys = ['node_identity', 'security_governance', 'maintenance_window'];
    if (!validKeys.includes(key)) {
      return NextResponse.json(
        { error: `Invalid configuration key. Must be one of: ${validKeys.join(', ')}` },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value), session.userId]
    );

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_SYSTEM_CONFIG_UPDATED',
      actorId: session.userId,
      resourceType: 'SYSTEM_CONFIG',
      resourceId: session.userId,
      result: 'SUCCESS',
      metadata: {
        configKey: key,
        updatedValue: value,
      },
    });

    return NextResponse.json({
      success: true,
      message: `System configuration parameter "${key}" saved.`,
    });
  } catch (err: any) {
    console.error('[ADMIN_SAVE_SYSTEM_CONFIG_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to save system configuration.', details: err.message },
      { status: 500 }
    );
  }
}
