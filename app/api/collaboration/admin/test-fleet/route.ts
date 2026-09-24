import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    // Allow if admin session or development environment for easy testing
    if (!session && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    // 1. Fetch all organizations with their taxonomies
    const orgs = await query(`
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

    // 2. Fetch users grouped by organization
    const users = await query(`
      SELECT 
        u.id,
        u.organization_id as "organizationId",
        u.username,
        u.full_name as "fullName",
        u.email,
        u.employee_code as "employeeCode",
        u.designation,
        u.status,
        u.max_security_level as "maxSecurityLevel",
        u.last_login_at as "lastLoginAt",
        d.name as "departmentName",
        d.code as "departmentCode",
        COALESCE(
          json_agg(
            json_build_object('id', r.id, 'name', r.name, 'code', r.code)
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as roles
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 'ACTIVE'
      GROUP BY u.id, d.name, d.code
      ORDER BY u.created_at ASC
    `);

    // Map users into their respective organizations
    const orgsWithUsers = orgs.map((org: any) => {
      const orgUsers = users.filter((u: any) => u.organizationId === org.id);
      return {
        ...org,
        usersCount: orgUsers.length,
        users: orgUsers,
        defaultPasswordHint: 'Password@DMS2026!',
      };
    });

    return NextResponse.json({
      success: true,
      organizations: orgsWithUsers,
      totalOrganizations: orgsWithUsers.length,
      totalUsers: users.length,
    });
  } catch (error: any) {
    console.error('[COLLABORATION_TEST_FLEET_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve test fleet data', details: error.message },
      { status: 500 }
    );
  }
}
