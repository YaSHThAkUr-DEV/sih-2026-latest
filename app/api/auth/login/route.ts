import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/crypto';
import { createSessionToken, setSessionCookie } from '@/lib/auth/jwt';
import { logAuditEvent } from '@/lib/auth/audit';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown';

  // 0. Institutional Rate Limit Protection
  const rateLimit = await checkRateLimit(`login:${ipAddress}`, RATE_LIMIT_PRESETS.AUTH_LOGIN);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts. Security lock active. Please retry in ${rateLimit.resetSeconds} seconds.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.resetSeconds),
          'X-RateLimit-Limit': String(rateLimit.totalLimit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { email, username, password, orgCode } = body;

    const identifier = (email || username || '').trim().toLowerCase();
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/Username and password are required' },
        { status: 400 }
      );
    }

    // 1. Look up user by email or username
    let userQuery = `
      SELECT 
        u.id, u.organization_id, u.department_id, u.employee_code,
        u.username, u.full_name, u.email, u.designation, u.password_hash, u.status,
        u.max_security_level,
        o.name as organization_name, o.code as organization_code,
        d.name as department_name, d.code as department_code
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE (LOWER(u.email) = $1 OR LOWER(u.username) = $1)
    `;
    const params: any[] = [identifier];

    if (orgCode) {
      userQuery += ` AND LOWER(o.code) = $2`;
      params.push(orgCode.trim().toLowerCase());
    }

    const users = await query(userQuery, params);

    if (users.length === 0) {
      // Find fallback org id to record audit log
      const defaultOrg = await query(`SELECT id FROM organizations LIMIT 1`);
      const orgId = defaultOrg[0]?.id;

      if (orgId) {
        await logAuditEvent({
          organizationId: orgId,
          eventType: 'USER_LOGIN_FAILED',
          result: 'FAILURE',
          failureReason: 'User not found or invalid organization',
          ipAddress,
          userAgent,
          metadata: { attemptedIdentifier: identifier, orgCode },
        });
      }

      return NextResponse.json(
        { error: 'Invalid credentials or organization' },
        { status: 401 }
      );
    }

    const user = users[0];

    // 2. Check user status
    if (user.status !== 'ACTIVE') {
      await logAuditEvent({
        organizationId: user.organization_id,
        eventType: 'USER_LOGIN_FAILED',
        actorId: user.id,
        result: 'DENIED',
        failureReason: `Account status is ${user.status}`,
        ipAddress,
        userAgent,
        metadata: { status: user.status },
      });

      return NextResponse.json(
        { error: `Account is ${user.status.toLowerCase()}. Please contact your security administrator.` },
        { status: 403 }
      );
    }

    // 3. Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      await logAuditEvent({
        organizationId: user.organization_id,
        eventType: 'USER_LOGIN_FAILED',
        actorId: user.id,
        result: 'FAILURE',
        failureReason: 'Invalid password',
        ipAddress,
        userAgent,
        metadata: { attemptedIdentifier: identifier },
      });

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // 4. Fetch Roles and Permissions
    const roleRows = await query(
      `SELECT r.code 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = roleRows.map((r: any) => r.code);

    const permRows = await query(
      `SELECT DISTINCT p.code
       FROM user_roles ur
       JOIN role_permissions rp ON ur.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const permissions = permRows.map((p: any) => p.code);

    // 5. Update last_login_at
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

    // 6. Create JWT Token and set HTTP-only cookie
    const sessionPayload = {
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      designation: user.designation,
      organizationId: user.organization_id,
      organizationCode: user.organization_code,
      organizationName: user.organization_name,
      departmentId: user.department_id,
      departmentName: user.department_name,
      roles,
      permissions,
      maxSecurityLevel: user.max_security_level ?? 3,
    };

    const token = await createSessionToken(sessionPayload);
    await setSessionCookie(token);

    // 7. Write Audit Event
    await logAuditEvent({
      organizationId: user.organization_id,
      eventType: 'USER_LOGIN_SUCCESS',
      actorId: user.id,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { roles, designation: user.designation },
    });

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        employeeCode: user.employee_code,
        designation: user.designation,
        organization: {
          id: user.organization_id,
          code: user.organization_code,
          name: user.organization_name,
        },
        department: user.department_id
          ? {
              id: user.department_id,
              code: user.department_code,
              name: user.department_name,
            }
          : null,
        roles,
        permissions,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal authentication service error' },
      { status: 500 }
    );
  }
}
