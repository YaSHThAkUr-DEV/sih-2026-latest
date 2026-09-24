import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { isSuperAdmin } from '@/lib/auth/rbac';
import { normalizeFeatures } from '@/lib/service/service-config-shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Super Administrator clearance required' }, { status: 403 });
    }

    // 1. Overall Fleet KPIs
    const fleetKpis = await query(`
      SELECT 
        COUNT(*)::int as "totalOrganizations",
        COUNT(CASE WHEN is_verified_federation_node = true THEN 1 END)::int as "verifiedNodes",
        (SELECT COUNT(*)::int FROM users WHERE status = 'ACTIVE') as "totalActiveUsers",
        (SELECT COUNT(*)::int FROM documents WHERE status = 'ACTIVE') as "totalDocumentsInVaults",
        (SELECT COUNT(*)::int FROM inter_org_requests) as "totalInterOrgRequisitions",
        (SELECT COUNT(*)::int FROM inter_org_shares WHERE is_revoked = false AND expires_at > NOW()) as "activeInterOrgShares",
        (SELECT COUNT(*)::int FROM inter_org_access_logs) as "totalExchangeAuditEvents"
      FROM organizations
    `);

    // 2. Organizations Fleet Table with Extended Metrics
    const orgsList = await query(`
      SELECT 
        o.id,
        o.name,
        o.code,
        o.agency_code as "agencyCode",
        o.status,
        o.is_verified_federation_node as "isVerified",
        o.nodal_officer_name as "nodalOfficerName",
        o.nodal_officer_email as "nodalOfficerEmail",
        o.nodal_officer_phone as "nodalOfficerPhone",
        o.features,
        o.created_at as "createdAt",
        t.name as "tierName",
        t.badge_color as "tierColor",
        c.name as "categoryName",
        c.icon_name as "categoryIcon",
        r.name as "regionName",
        r.state_code as "stateCode",
        (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) as "usersCount",
        (SELECT COUNT(*)::int FROM departments d WHERE d.organization_id = o.id) as "departmentsCount",
        (SELECT COUNT(*)::int FROM documents doc WHERE doc.organization_id = o.id) as "documentsCount",
        (SELECT COUNT(*)::int FROM inter_org_requests req WHERE req.requesting_org_id = o.id) as "outboundRequestsCount",
        (SELECT COUNT(*)::int FROM inter_org_requests req WHERE req.target_org_id = o.id) as "inboundRequestsCount"
      FROM organizations o
      LEFT JOIN taxonomy_organization_tiers t ON o.tier_id = t.id
      LEFT JOIN taxonomy_domain_categories c ON o.domain_category_id = c.id
      LEFT JOIN taxonomy_jurisdiction_regions r ON o.jurisdiction_region_id = r.id
      ORDER BY o.is_verified_federation_node DESC, o.name ASC
    `);

    return NextResponse.json({
      success: true,
      fleetSummary: fleetKpis[0] || {},
      organizations: orgsList,
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ADMIN_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to fetch federation fleet overview', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Super Administrator clearance required' }, { status: 403 });
    }

    const body = await req.json();
    const { organizationId, status, isVerified, features } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    let updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (isVerified !== undefined) {
      updateFields.push(`is_verified_federation_node = $${paramIndex}`);
      params.push(Boolean(isVerified));
      paramIndex++;
    }

    if (features) {
      const normalized = normalizeFeatures(features);
      updateFields.push(`features = $${paramIndex}`);
      params.push(JSON.stringify(normalized));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }

    params.push(organizationId);
    const updateSql = `
      UPDATE organizations
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, name, code, status, is_verified_federation_node, features;
    `;

    const res = await query(updateSql, params);
    if (res.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Organization ${res[0].name} updated successfully`,
      organization: res[0],
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ADMIN_PATCH_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to update organization configuration', details: error.message },
      { status: 500 }
    );
  }
}
