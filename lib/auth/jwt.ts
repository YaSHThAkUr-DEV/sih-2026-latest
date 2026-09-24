import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY CONFIGURATION: JWT_SECRET environment variable must be set in production!');
    }
    return new TextEncoder().encode('dms_super_secure_jwt_secret_key_2026_institutional_gov_32chars!');
  }
  return new TextEncoder().encode(secret);
}

const secretKey = getJwtSecret();

export const COOKIE_NAME = 'dms_session';

export interface UserSessionPayload {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  designation?: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  roles: string[];
  permissions: string[];
  maxSecurityLevel?: number; // 1-5, controls which document tiers the user can access/upload
}

export async function createSessionToken(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as UserSessionPayload;
  } catch (err) {
    return null;
  }
}

export async function getCurrentSession(req?: Request): Promise<UserSessionPayload | null> {
  // 1. Check Authorization Bearer header or Cookie header if req provided
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      return verifySessionToken(token);
    }
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
      if (match) {
        return verifySessionToken(decodeURIComponent(match[1]));
      }
    }
  }

  // 2. Fall back to Next.js cookies() helper
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
