import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { isSuperAdmin } from '@/lib/auth/rbac';
import { provisionOfficeInstance } from '@/lib/service/provisioning';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get('query')?.trim() || '';
    const tierId = searchParams.get('tierId')?.trim() || '';
    const categoryId = searchParams.get('categoryId')?.trim() || '';
    const regionId = searchParams.get('regionId')?.trim() || '';
    const stateCode = searchParams.get('stateCode')?.trim() || '';
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE o.status = 'ACTIVE'`;
    const params: any[] = [];
    let paramIndex = 1;

    if (searchQuery) {
      whereClause += ` AND (
        o.name ILIKE $${paramIndex} OR 
        o.code ILIKE $${paramIndex} OR 
        o.agency_code ILIKE $${paramIndex} OR 
        o.nodal_officer_name ILIKE $${paramIndex} OR 
        r.name ILIKE $${paramIndex}
      )`;
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    if (tierId && tierId !== 'ALL') {
      whereClause += ` AND o.tier_id = $${paramIndex}`;
      params.push(tierId);
      paramIndex++;
    }

    if (categoryId && categoryId !== 'ALL') {
      whereClause += ` AND o.domain_category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex++;
    }

    if (regionId && regionId !== 'ALL') {
      whereClause += ` AND o.jurisdiction_region_id = $${paramIndex}`;
      params.push(regionId);
      paramIndex++;
    }

    if (stateCode && stateCode !== 'ALL') {
      whereClause += ` AND r.state_code = $${paramIndex}`;
      params.push(stateCode);
      paramIndex++;
    }

    if (verifiedOnly) {
      whereClause += ` AND o.is_verified_federation_node = true`;
    }

    // Count total matching
    const countSql = `
      SELECT COUNT(*)::int as total
      FROM organizations o
      LEFT JOIN taxonomy_organization_tiers t ON o.tier_id = t.id
      LEFT JOIN taxonomy_domain_categories c ON o.domain_category_id = c.id
      LEFT JOIN taxonomy_jurisdiction_regions r ON o.jurisdiction_region_id = r.id
      ${whereClause}
    `;
    const countResult = await query<{ total: number }>(countSql, params);
    const total = countResult[0]?.total || 0;

    // Fetch page items with department and document type count summaries
    const querySql = `
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
        t.id as "tierId",
        t.code as "tierCode",
        t.name as "tierName",
        t.badge_color as "tierBadgeColor",
        c.id as "categoryId",
        c.code as "categoryCode",
        c.name as "categoryName",
        c.icon_name as "categoryIcon",
        c.badge_color as "categoryBadgeColor",
        r.id as "regionId",
        r.name as "regionName",
        r.state_code as "stateCode",
        (SELECT COUNT(*)::int FROM departments d WHERE d.organization_id = o.id AND d.status = 'ACTIVE') as "departmentsCount",
        (SELECT COUNT(*)::int FROM document_types dt WHERE dt.organization_id = o.id AND dt.active = true) as "documentTypesCount",
        (SELECT COUNT(*)::int FROM documents doc WHERE doc.organization_id = o.id AND doc.status = 'ACTIVE') as "activeDocumentsCount"
      FROM organizations o
      LEFT JOIN taxonomy_organization_tiers t ON o.tier_id = t.id
      LEFT JOIN taxonomy_domain_categories c ON o.domain_category_id = c.id
      LEFT JOIN taxonomy_jurisdiction_regions r ON o.jurisdiction_region_id = r.id
      ${whereClause}
      ORDER BY o.is_verified_federation_node DESC, o.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const organizations = await query(querySql, params);

    return NextResponse.json({
      success: true,
      organizations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error('[COLLABORATION_DIRECTORY_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to search organization directory', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Super Administrator clearance required for organization onboarding' }, { status: 403 });
    }

    const body = await req.json();
    const {
      officeName,
      officeCode,
      agencyCode,
      tierId,
      domainCategoryId,
      jurisdictionRegionId,
      nodalOfficerName,
      nodalOfficerEmail,
      nodalOfficerPhone,
      departments,
      documentTypes,
      adminUser,
      features,
    } = body;

    if (!officeName || !officeCode || !adminUser?.email || !adminUser?.password) {
      return NextResponse.json({ error: 'Office Name, Office Code, Admin Email, and Admin Password are required' }, { status: 400 });
    }

    const result = await provisionOfficeInstance({
      officeName,
      officeCode,
      adminUser,
      departments,
      documentTypes,
      features,
    });

    // Update extended organization metadata
    if (result.organization?.id) {
      await query(
        `UPDATE organizations 
         SET agency_code = $1, tier_id = $2, domain_category_id = $3, jurisdiction_region_id = $4,
             nodal_officer_name = $5, nodal_officer_email = $6, nodal_officer_phone = $7,
             is_verified_federation_node = true
         WHERE id = $8`,
        [
          agencyCode || `GOV-${officeCode.toUpperCase()}-001`,
          tierId || null,
          domainCategoryId || null,
          jurisdictionRegionId || null,
          nodalOfficerName || adminUser.fullName,
          nodalOfficerEmail || adminUser.email,
          nodalOfficerPhone || '+91-11-00000000',
          result.organization.id,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Organization "${officeName}" successfully onboarded into sovereign federation`,
      organizationId: result.organization.id,
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ONBOARD_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to onboard organization', details: error.message },
      { status: 500 }
    );
  }
}
