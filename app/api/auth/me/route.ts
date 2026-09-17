import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { getOrganizationFeatures } from '@/lib/service/service-config';

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 }
    );
  }

  // Refresh latest status & details from DB
  const users = await query(
    `SELECT u.id, u.username, u.full_name, u.email, u.employee_code, u.designation, u.status, u.last_login_at,
            o.name as organization_name, o.code as organization_code,
            d.name as department_name, d.code as department_code
     FROM users u
     JOIN organizations o ON u.organization_id = o.id
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = $1`,
    [session.userId]
  );

  if (users.length === 0 || users[0].status !== 'ACTIVE') {
    return NextResponse.json(
      { authenticated: false, error: 'User is inactive or deleted' },
      { status: 403 }
    );
  }

  const u = users[0];
  const features = await getOrganizationFeatures(session.organizationId);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      email: u.email,
      employeeCode: u.employee_code,
      designation: u.designation,
      organization: {
        id: session.organizationId,
        code: u.organization_code,
        name: u.organization_name,
        features,
      },
      department: u.department_code
        ? {
            id: session.departmentId,
            code: u.department_code,
            name: u.department_name,
          }
        : null,
      roles: session.roles,
      permissions: session.permissions,
      lastLoginAt: u.last_login_at,
    },
  });
}
