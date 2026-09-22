import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'dms_super_secure_jwt_secret_key_2026_institutional_gov_32chars!';
const secretKey = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = 'dms_session';

// Routes requiring authentication
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/documents', '/approvals', '/audit'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

  // Helper to inject security headers
  const applySecurityHeaders = (response: NextResponse) => {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    response.headers.set('x-correlation-id', correlationId);
    return response;
  };

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    const res = NextResponse.next();
    return applySecurityHeaders(res);
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  try {
    await jwtVerify(token, secretKey);
    const res = NextResponse.next();
    return applySecurityHeaders(res);
  } catch {
    // Token expired or tampered
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return applySecurityHeaders(response);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
