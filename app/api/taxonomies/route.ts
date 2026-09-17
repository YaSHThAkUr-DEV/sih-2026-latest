import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { isSuperAdmin, getMaxSecurityLevel } from '@/lib/auth/rbac';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const orgId = session.organizationId;
    const userMaxLevel = getMaxSecurityLevel(session);

    // 1. Fetch Active Document Types for Organization
    const docTypes = await query<any>(
      `SELECT id, name, code, description, active
       FROM document_types
       WHERE organization_id = $1 AND active = true
       ORDER BY name ASC`,
      [orgId]
    );

    // 2. Fetch Active Departments for Organization
    const departments = await query<any>(
      `SELECT id, name, code, status
       FROM departments
       WHERE organization_id = $1 AND status = 'ACTIVE'
       ORDER BY name ASC`,
      [orgId]
    );

    // 3. Fetch Security Levels with Clearance Flag
    const securityLevels = await query<any>(
      `SELECT id, name, code, rank, approval_required, encryption_required, audit_level
       FROM security_levels
       WHERE organization_id = $1
       ORDER BY rank ASC`,
      [orgId]
    );

    // Map security levels with accessible flag based on user's maxSecurityLevel
    const mappedSecLevels = securityLevels.map((sl: any) => ({
      ...sl,
      rank: Number(sl.rank),
      isAccessible: isSuperAdmin(session) || userMaxLevel >= Number(sl.rank),
    }));

    // 4. Fetch Roles for Org (only return all if user has user management permissions or admin)
    let roles: any[] = [];
    const canManageUsers = isSuperAdmin(session) || (session.permissions || []).includes('USER_MANAGE') || (session.permissions || []).includes('PERMISSION_MANAGE');
    if (canManageUsers) {
      roles = await query<any>(
        `SELECT id, name, code, description, is_system_role
         FROM roles
         WHERE organization_id = $1
         ORDER BY is_system_role DESC, name ASC`,
        [orgId]
      );
    }

    return NextResponse.json({
      success: true,
      userMaxSecurityLevel: userMaxLevel,
      isSuperAdmin: isSuperAdmin(session),
      documentTypes: docTypes.map((dt: any) => ({
        id: dt.id,
        name: dt.name,
        code: dt.code,
        description: dt.description,
      })),
      departments: departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.code,
      })),
      securityLevels: mappedSecLevels,
      roles,
    });
  } catch (error: any) {
    console.error('[TAXONOMIES_API_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to load organization taxonomies', details: error.message },
      { status: 500 }
    );
  }
}
