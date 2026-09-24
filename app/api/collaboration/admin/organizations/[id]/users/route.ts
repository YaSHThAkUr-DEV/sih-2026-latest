import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/auth/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Admin clearance required' }, { status: 403 });
    }

    const { id: orgId } = await params;
    const body = await req.json();

    const {
      fullName,
      email,
      username,
      employeeCode,
      designation,
      password,
      departmentId,
      maxSecurityLevel,
      roleCodes = ['OFFICER'],
    } = body;

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Full name, email, and password are required' },
        { status: 400 }
      );
    }

    const userEmail = email.trim().toLowerCase();
    const userUsername = (username || email.split('@')[0]).trim().toLowerCase();
    const userCode = (employeeCode || `EMP-${Date.now().toString().slice(-4)}`).trim().toUpperCase();

    // Check duplicate email
    const duplicateEmail = await query(`SELECT id FROM users WHERE LOWER(email) = $1`, [userEmail]);
    if (duplicateEmail.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const clearance = Number(maxSecurityLevel) || 3;

    const insertUser = await query(
      `
      INSERT INTO users (
        organization_id, department_id, employee_code, username, full_name,
        email, designation, password_hash, status, max_security_level
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)
      RETURNING id, full_name, email, username, employee_code, designation, max_security_level, status, created_at;
      `,
      [
        orgId,
        departmentId || null,
        userCode,
        userUsername,
        fullName.trim(),
        userEmail,
        designation || 'Officer',
        hashedPassword,
        clearance,
      ]
    );

    const newUser = insertUser[0];

    // Assign Roles
    if (roleCodes && Array.isArray(roleCodes) && roleCodes.length > 0) {
      for (const rCode of roleCodes) {
        const roleRes = await query(
          `SELECT id FROM roles WHERE organization_id = $1 AND UPPER(code) = UPPER($2)`,
          [orgId, rCode]
        );
        if (roleRes.length > 0) {
          await query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newUser.id, roleRes[0].id]
          );
        } else {
          // Fallback to global/first matching system role
          const fallbackRole = await query(
            `SELECT id FROM roles WHERE UPPER(code) = UPPER($1) LIMIT 1`,
            [rCode]
          );
          if (fallbackRole.length > 0) {
            await query(
              `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [newUser.id, fallbackRole[0].id]
            );
          }
        }
      }
    }

    await logAuditEvent({
      organizationId: orgId,
      eventType: 'USER_CREATED',
      actorId: session.userId,
      resourceType: 'USER',
      resourceId: newUser.id,
      result: 'SUCCESS',
      metadata: { userEmail, userCode, fullName: newUser.full_name },
    });

    return NextResponse.json({
      success: true,
      message: `User ${newUser.full_name} enrolled successfully`,
      user: newUser,
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ADMIN_ENROLL_USER_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to enroll user', details: error.message },
      { status: 500 }
    );
  }
}
