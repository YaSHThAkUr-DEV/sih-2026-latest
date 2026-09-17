import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim() || '';
  const departmentId = url.searchParams.get('department_id')?.trim() || '';
  const status = url.searchParams.get('status')?.trim() || '';

  try {
    let whereClauses = [`u.organization_id = $1`];
    let params: any[] = [session.organizationId];

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(
        `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.employee_code ILIKE $${params.length})`
      );
    }

    if (departmentId) {
      params.push(departmentId);
      whereClauses.push(`u.department_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      whereClauses.push(`u.status = $${params.length}`);
    }

    const whereSql = whereClauses.join(' AND ');

    const users = await query(
      `SELECT 
         u.id,
         u.username,
         u.full_name,
         u.email,
         u.phone,
         u.designation,
         u.employee_code,
         u.status,
         u.max_security_level,
         u.department_id,
         d.name as department_name,
         d.code as department_code,
         u.team_id,
         t.name as team_name,
         t.code as team_code,
         u.last_login_at,
         u.created_at,
         COALESCE(
           json_agg(
             json_build_object('id', r.id, 'name', r.name, 'code', r.code)
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) as roles
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN teams t ON u.team_id = t.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE ${whereSql}
       GROUP BY u.id, d.name, d.code, t.name, t.code
       ORDER BY u.created_at DESC`,
      params
    );

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('[ADMIN_GET_USERS_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve user registry.', details: err.message },
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
    const {
      username,
      fullName,
      email,
      phone,
      designation,
      employeeCode,
      departmentId,
      teamId,
      password,
      roleIds,
      maxSecurityLevel = 3,
      status = 'ACTIVE',
    } = body;

    if (!username || !fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required credentials (username, fullName, email, and password).' },
        { status: 400 }
      );
    }

    // Check duplicate username or email
    const existing = await query(
      `SELECT id, username, email FROM users WHERE (username = $1 OR email = $2) AND organization_id = $3`,
      [username, email, session.organizationId]
    );

    if (existing.length > 0) {
      const match = existing[0];
      return NextResponse.json(
        {
          error:
            match.username === username
              ? 'Username is already registered in this organization.'
              : 'Email address is already in use by an existing credential.',
        },
        { status: 409 }
      );
    }

    // Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await query<{ id: string }>(
      `INSERT INTO users (
         organization_id, department_id, team_id, employee_code,
         username, full_name, email, phone, designation,
         password_hash, max_security_level, status, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       RETURNING id;`,
      [
        session.organizationId,
        departmentId || null,
        teamId || null,
        employeeCode || null,
        username,
        fullName,
        email,
        phone || null,
        designation || null,
        passwordHash,
        Math.min(5, Math.max(1, Number(maxSecurityLevel) || 3)),
        status,
      ]
    );

    const userId = newUser[0].id;

    // Assign roles
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [userId, roleId, session.userId]
        );
      }
    }

    // Audit log
    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_USER_CREATED',
      actorId: session.userId,
      resourceType: 'USER',
      resourceId: userId,
      result: 'SUCCESS',
      metadata: {
        createdUserId: userId,
        username,
        email,
        employeeCode,
        departmentId,
        teamId,
        roleIds,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Institutional user enrolled successfully.', userId },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[ADMIN_CREATE_USER_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to create user record.', details: err.message },
      { status: 500 }
    );
  }
}
