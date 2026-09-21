import { UserSessionPayload } from './jwt';

/**
 * Modular RBAC Enforcement Module
 * 
 * Design: ALL roles (except SUPER_ADMIN) are fully configurable.
 * Role names, descriptions, and permission sets are managed by org admins
 * through the UI and stored in the database. This module never checks
 * hardcoded role names — it checks permissions and security levels.
 * 
 * SUPER_ADMIN is the only reserved system role that bypasses all checks.
 */

// ---------------------------------------------------------------------------
// Permission Checks (permission-based, not role-name-based)
// ---------------------------------------------------------------------------

/**
 * Check if the session has a specific permission code.
 * SUPER_ADMIN bypasses all permission checks.
 */
export function hasPermission(session: UserSessionPayload, permissionCode: string): boolean {
  if (!session) return false;
  if (session.roles.includes('SUPER_ADMIN')) return true;
  return (session.permissions || []).includes(permissionCode);
}

/**
 * Check if the session has ANY of the specified permissions.
 */
export function hasAnyPermission(session: UserSessionPayload, permissionCodes: string[]): boolean {
  if (!session) return false;
  if (session.roles.includes('SUPER_ADMIN')) return true;
  return permissionCodes.some((p) => (session.permissions || []).includes(p));
}

/**
 * Check if the session has ALL of the specified permissions.
 */
export function hasAllPermissions(session: UserSessionPayload, permissionCodes: string[]): boolean {
  if (!session) return false;
  if (session.roles.includes('SUPER_ADMIN')) return true;
  return permissionCodes.every((p) => (session.permissions || []).includes(p));
}

// ---------------------------------------------------------------------------
// Module Specific Permission Helpers
// ---------------------------------------------------------------------------

export function canViewBlockchain(session: UserSessionPayload): boolean {
  return hasAnyPermission(session, ['BLOCKCHAIN_VIEW', 'AUDIT_VIEW', 'PERMISSION_MANAGE']);
}

export function canAnchorBlockchain(session: UserSessionPayload): boolean {
  return hasAnyPermission(session, ['BLOCKCHAIN_ANCHOR', 'PERMISSION_MANAGE']);
}

export function canVerifyBlockchain(session: UserSessionPayload): boolean {
  return hasAnyPermission(session, ['BLOCKCHAIN_VERIFY', 'BLOCKCHAIN_VIEW', 'AUDIT_VIEW', 'DOCUMENT_VIEW']);
}

// ---------------------------------------------------------------------------
// Role Checks (only used for SUPER_ADMIN bypass — everything else is permissions)
// ---------------------------------------------------------------------------

/**
 * Check if user is the system-reserved SUPER_ADMIN.
 * This is the ONLY hardcoded role check in the entire system.
 */
export function isSuperAdmin(session: UserSessionPayload): boolean {
  if (!session) return false;
  return session.roles.includes('SUPER_ADMIN');
}

/**
 * Check if user has administrative capabilities.
 * Uses permission-based check, not role-name check.
 */
export function isAdmin(session: UserSessionPayload): boolean {
  if (!session) return false;
  if (isSuperAdmin(session)) return true;
  // Any user with PERMISSION_MANAGE or USER_MANAGE is considered an admin
  return hasAnyPermission(session, ['PERMISSION_MANAGE', 'USER_MANAGE', 'DEPARTMENT_MANAGE']);
}

// ---------------------------------------------------------------------------
// Security Level Enforcement
// ---------------------------------------------------------------------------

/**
 * Get the user's maximum allowed security level (1-5).
 * SUPER_ADMIN always gets level 5.
 */
export function getMaxSecurityLevel(session: UserSessionPayload): number {
  if (!session) return 0;
  if (isSuperAdmin(session)) return 5;
  return session.maxSecurityLevel ?? 3; // Default to level 3 if not set
}

/**
 * Check if user can access a document/resource at the given security tier rank.
 */
export function canAccessSecurityTier(session: UserSessionPayload, tierRank: number): boolean {
  return getMaxSecurityLevel(session) >= tierRank;
}

// ---------------------------------------------------------------------------
// Enforcement Helpers (throw on failure — use in API routes)
// ---------------------------------------------------------------------------

export class RBACDeniedError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = 'RBACDeniedError';
    this.statusCode = statusCode;
  }
}

/**
 * Enforce that the session has a specific permission. Throws RBACDeniedError if not.
 */
export function enforcePermission(session: UserSessionPayload, permissionCode: string): void {
  if (!hasPermission(session, permissionCode)) {
    throw new RBACDeniedError(
      `Access denied: you do not have the required permission (${permissionCode}).`
    );
  }
}

/**
 * Enforce that the session can operate at the given security tier rank.
 */
export function enforceSecurityLevel(session: UserSessionPayload, tierRank: number, tierCode?: string): void {
  if (!canAccessSecurityTier(session, tierRank)) {
    throw new RBACDeniedError(
      `Your security clearance level (${getMaxSecurityLevel(session)}) does not permit access to ${tierCode || `Level ${tierRank}`} documents.`
    );
  }
}

/**
 * Enforce admin-level access. Throws if user lacks admin permissions.
 */
export function enforceAdmin(session: UserSessionPayload): void {
  if (!isAdmin(session)) {
    throw new RBACDeniedError('Administrative clearance required for this operation.');
  }
}
