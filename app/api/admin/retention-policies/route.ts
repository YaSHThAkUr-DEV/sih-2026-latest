import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/retention-policies
 * Returns all retention schedules/policies configured for the current organization.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const policies = await query(
      `SELECT 
         p.id,
         p.name,
         p.schedule_code,
         p.retention_days,
         p.permanent,
         p.deletion_requires_approval,
         p.action_on_expiry,
         p.statutory_framework,
         p.description,
         COUNT(r.id) as document_count,
         COUNT(DISTINCT dtp.id) as assigned_policies_count
       FROM retention_policies p
       LEFT JOIN retention_records r ON r.retention_policy_id = p.id
       LEFT JOIN document_type_policies dtp ON dtp.retention_policy_id = p.id
       WHERE p.organization_id = $1
       GROUP BY p.id
       ORDER BY p.permanent DESC, p.retention_days DESC`,
      [session.organizationId]
    );

    return NextResponse.json({ policies });
  } catch (err: any) {
    console.error('[ADMIN_GET_RETENTION_POLICIES_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve retention policies.', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/retention-policies
 * Creates a new custom retention schedule for the current organization.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const body = await req.json();
    const {
      name,
      scheduleCode,
      retentionDays,
      permanent = false,
      deletionRequiresApproval = true,
      actionOnExpiry = 'Maker-Checker Review & Cryptographic Zeroization',
      statutoryFramework = 'Institutional Statutory Directive',
      description,
    } = body;

    if (!name || !scheduleCode) {
      return NextResponse.json(
        { error: 'Schedule Name and unique Schedule Code are required.' },
        { status: 400 }
      );
    }

    const cleanCode = scheduleCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');

    // Check duplicate code within organization
    const existing = await query(
      `SELECT id FROM retention_policies WHERE schedule_code = $1 AND organization_id = $2`,
      [cleanCode, session.organizationId]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Retention schedule code "${cleanCode}" already exists in this organization.` },
        { status: 409 }
      );
    }

    const days = permanent ? null : (parseInt(retentionDays, 10) || 365);

    const res = await query<{ id: string }>(
      `INSERT INTO retention_policies (
         organization_id, name, schedule_code, retention_days,
         permanent, deletion_requires_approval, action_on_expiry,
         statutory_framework, description
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id;`,
      [
        session.organizationId,
        name.trim(),
        cleanCode,
        days,
        permanent,
        deletionRequiresApproval,
        actionOnExpiry.trim(),
        statutoryFramework.trim(),
        description?.trim() || null,
      ]
    );

    const policyId = res[0].id;

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_RETENTION_SCHEDULE_CREATED',
      actorId: session.userId,
      resourceType: 'RETENTION_POLICY',
      resourceId: policyId,
      result: 'SUCCESS',
      metadata: {
        policyId,
        name: name.trim(),
        scheduleCode: cleanCode,
        retentionDays: days,
        permanent,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Statutory retention schedule created successfully.', policyId },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[ADMIN_CREATE_RETENTION_POLICY_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to create retention schedule.', details: err.message },
      { status: 500 }
    );
  }
}
