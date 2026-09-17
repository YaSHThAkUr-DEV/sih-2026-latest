import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { logAuditEvent } from '@/lib/auth/audit';
import {
  getOrganizationFeatures,
  updateOrganizationFeatures,
  MODULE_DESCRIPTIONS,
  OrganizationFeatureConfig,
} from '@/lib/service/service-config';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/organization-features
 * Returns the enabled feature modules and metadata for the caller's organization.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const orgRows = await query<{ name: string; code: string; status: string }>(
      `SELECT name, code, status FROM organizations WHERE id = $1;`,
      [session.organizationId]
    );

    const features = await getOrganizationFeatures(session.organizationId);

    return NextResponse.json({
      success: true,
      organization: {
        id: session.organizationId,
        name: orgRows[0]?.name || session.organizationName,
        code: orgRows[0]?.code || session.organizationCode,
        status: orgRows[0]?.status || 'ACTIVE',
      },
      features,
      modules: MODULE_DESCRIPTIONS,
    });
  } catch (err: unknown) {
    console.error('Failed to get organization features:', err);
    const message = err instanceof Error ? err.message : 'Failed to retrieve organization features.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organization-features
 * Updates module toggles for the caller's organization.
 */
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const body = await req.json();
    const featureUpdates: Partial<OrganizationFeatureConfig> = body.features || body;

    const previous = await getOrganizationFeatures(session.organizationId);
    const updated = await updateOrganizationFeatures(session.organizationId, featureUpdates);

    // Write audit event
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ORGANIZATION_FEATURES_UPDATED',
      actorId: session.userId,
      resourceType: 'ORGANIZATION_CONFIG',
      result: 'SUCCESS',
      metadata: {
        organizationId: session.organizationId,
        previous,
        updated,
        changedBy: session.email,
      },
    });

    return NextResponse.json({
      success: true,
      features: updated,
      message: 'Office modules and feature configuration updated successfully.',
    });
  } catch (err: unknown) {
    console.error('Failed to update organization features:', err);
    const message = err instanceof Error ? err.message : 'Failed to update organization features.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
