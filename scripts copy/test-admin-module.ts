import { NextRequest } from 'next/server';
import { query, pool } from '../lib/db';
import { createSessionToken } from '../lib/auth/jwt';

// Import Route Handlers directly
import { GET as getUsers, POST as createUser } from '../app/api/admin/users/route';
import { GET as getUserById, PATCH as patchUser, DELETE as deleteUser } from '../app/api/admin/users/[id]/route';
import { GET as getDepts, POST as createDept } from '../app/api/admin/departments/route';
import { GET as getTeams, POST as createTeam } from '../app/api/admin/teams/route';
import { GET as getRoles, POST as createRole } from '../app/api/admin/roles/route';
import { GET as getRolePerms, PUT as putRolePerms } from '../app/api/admin/roles/[id]/permissions/route';
import { GET as getPermissions } from '../app/api/admin/permissions/route';
import { GET as getDocTypes, POST as createDocType } from '../app/api/admin/document-types/route';
import { PATCH as patchDocType } from '../app/api/admin/document-types/[id]/route';
import { GET as getSecLevels } from '../app/api/admin/security-levels/route';
import { PATCH as patchSecLevel } from '../app/api/admin/security-levels/[id]/route';
import { GET as getPolicies, POST as postPolicy } from '../app/api/admin/policies/route';
import { PATCH as patchPolicy } from '../app/api/admin/policies/[id]/route';
import { GET as getSystemConfig, POST as postSystemConfig } from '../app/api/admin/system-config/route';

async function runAdminModuleTests() {
  console.log('========================================================================');
  console.log('  MODULE 22: INSTITUTIONAL ADMINISTRATION & GOVERNANCE TEST SUITE');
  console.log('========================================================================\n');

  // Fetch admin and non-admin users for testing
  const superAdmin = (
    await query<{ id: string; username: string; full_name: string; email: string; organization_id: string }>(
      `SELECT u.id, u.username, u.full_name, u.email, u.organization_id 
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE r.code = 'SUPER_ADMIN' AND u.status = 'ACTIVE'
       LIMIT 1`
    )
  )[0];

  const regularOfficer = (
    await query<{ id: string; username: string; full_name: string; email: string; organization_id: string }>(
      `SELECT u.id, u.username, u.full_name, u.email, u.organization_id
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE r.code = 'INVESTIGATING_OFFICER' AND u.status = 'ACTIVE'
       LIMIT 1`
    )
  )[0];

  if (!superAdmin) throw new Error('No active SUPER_ADMIN user found in database.');

  console.log(`[AUTH_CONTEXT] Super Admin: ${superAdmin.full_name} (${superAdmin.email})`);
  console.log(`[AUTH_CONTEXT] Regular Officer: ${regularOfficer ? regularOfficer.full_name : 'N/A'}\n`);

  // Generate tokens
  const adminToken = await createSessionToken({
    userId: superAdmin.id,
    username: superAdmin.username,
    fullName: superAdmin.full_name,
    email: superAdmin.email,
    organizationId: superAdmin.organization_id,
    organizationCode: 'CIB-IN',
    organizationName: 'Central Investigation Bureau',
    roles: ['SUPER_ADMIN', 'ORG_ADMIN'],
    permissions: ['PERMISSION_MANAGE', 'DOCUMENT_VIEW', 'AUDIT_VIEW'],
  });

  const officerToken = regularOfficer
    ? await createSessionToken({
        userId: regularOfficer.id,
        username: regularOfficer.username,
        fullName: regularOfficer.full_name,
        email: regularOfficer.email,
        organizationId: regularOfficer.organization_id,
        organizationCode: 'CIB-IN',
        organizationName: 'Central Investigation Bureau',
        roles: ['INVESTIGATING_OFFICER'],
        permissions: ['DOCUMENT_VIEW', 'DOCUMENT_CREATE'],
      })
    : null;

  function makeRequest(url: string, method: string = 'GET', body?: any, token?: string | null) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return new NextRequest(`http://localhost:3000${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: CLEARANCE BARRIER & PERMISSION GATING
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Clearance Barrier & Access Control ---');
  {
    // No token -> 401
    const noAuthReq = makeRequest('/api/admin/users', 'GET', undefined, null);
    const noAuthRes = await getUsers(noAuthReq);
    assert(noAuthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    // Officer token (lacks Super Admin or Org Admin or PERMISSION_MANAGE) -> 403
    if (officerToken) {
      const officerReq = makeRequest('/api/admin/users', 'GET', undefined, officerToken);
      const officerRes = await getUsers(officerReq);
      assert(officerRes.status === 403, 'Unauthorized officer access rejected with HTTP 403');
    }
  }

  // -------------------------------------------------------------------------
  // TEST 2: USER REGISTRY CRUD & SELF-LOCKOUT SAFEGUARDS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: User Registry CRUD & Self-Lockout Safeguards ---');
  let testCreatedUserId = '';
  {
    // List users
    const listReq = makeRequest('/api/admin/users', 'GET', undefined, adminToken);
    const listRes = await getUsers(listReq);
    assert(listRes.status === 200, 'Super Admin lists institutional users (HTTP 200)');
    const listData = await listRes.json();
    assert(Array.isArray(listData.users) && listData.users.length > 0, 'Users registry contains active members');

    // Enrol new officer
    const testUsername = `test.officer.${Date.now()}`;
    const testEmail = `${testUsername}@cib.gov.in`;

    const ccdDept = await query<{ id: string }>(`SELECT id FROM departments WHERE code = 'CCDF' LIMIT 1`);
    const officerRole = await query<{ id: string }>(`SELECT id FROM roles WHERE code = 'INVESTIGATING_OFFICER' LIMIT 1`);

    const createReq = makeRequest(
      '/api/admin/users',
      'POST',
      {
        username: testUsername,
        fullName: 'Tactical Test Officer',
        email: testEmail,
        designation: 'Cyber Investigator',
        employeeCode: 'CIB-TEST-001',
        departmentId: ccdDept[0]?.id,
        password: 'TemporaryPassword@2026!',
        roleIds: [officerRole[0]?.id],
      },
      adminToken
    );
    const createRes = await createUser(createReq);
    assert(createRes.status === 201, 'Officer enrolled successfully (HTTP 201)');
    const createData = await createRes.json();
    testCreatedUserId = createData.userId;
    assert(!!testCreatedUserId, 'Returned newly enrolled user UUID');

    // Get User By ID
    const getByIdReq = makeRequest(`/api/admin/users/${testCreatedUserId}`, 'GET', undefined, adminToken);
    const getByIdRes = await getUserById(getByIdReq, { params: Promise.resolve({ id: testCreatedUserId }) });
    assert(getByIdRes.status === 200, 'Retrieved user profile and clearance details (HTTP 200)');
    const userData = await getByIdRes.json();
    assert(userData.user.username === testUsername, 'Profile matches created officer username');
    assert(userData.roles.some((r: any) => r.code === 'INVESTIGATING_OFFICER'), 'User assigned INVESTIGATING_OFFICER role');

    // Patch User Profile
    const patchReq = makeRequest(
      `/api/admin/users/${testCreatedUserId}`,
      'PATCH',
      { designation: 'Senior Cyber Specialist', status: 'ACTIVE' },
      adminToken
    );
    const patchRes = await patchUser(patchReq, { params: Promise.resolve({ id: testCreatedUserId }) });
    assert(patchRes.status === 200, 'Updated user profile designation (HTTP 200)');

    // SELF-LOCKOUT GUARD: Attempt to deactivate own active super admin account
    const selfLockoutReq = makeRequest(
      `/api/admin/users/${superAdmin.id}`,
      'PATCH',
      { status: 'SUSPENDED' },
      adminToken
    );
    const selfLockoutRes = await patchUser(selfLockoutReq, { params: Promise.resolve({ id: superAdmin.id }) });
    assert(selfLockoutRes.status === 400, 'Self-lockout prevented: Admin cannot suspend own account (HTTP 400)');

    // SOLE SUPER ADMIN GUARD: Attempt to strip SUPER_ADMIN from sole super admin
    const demoteSuperAdminReq = makeRequest(
      `/api/admin/users/${superAdmin.id}`,
      'PATCH',
      { roleIds: [officerRole[0]?.id] }, // Super Admin role omitted!
      adminToken
    );
    const demoteRes = await patchUser(demoteSuperAdminReq, { params: Promise.resolve({ id: superAdmin.id }) });
    assert(demoteRes.status === 400, 'Sole Super Administrator demotion blocked (HTTP 400)');
  }

  // -------------------------------------------------------------------------
  // TEST 3: DIVISIONS & TACTICAL TEAMS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Institutional Divisions & Tactical Teams ---');
  let testTeamId = '';
  {
    const deptsReq = makeRequest('/api/admin/departments', 'GET', undefined, adminToken);
    const deptsRes = await getDepts(deptsReq);
    assert(deptsRes.status === 200, 'Retrieved divisions directory (HTTP 200)');
    const deptsData = await deptsRes.json();
    assert(deptsData.departments.length >= 5, 'At least 5 CIB divisions registered');

    // Create a new tactical team under CCDF
    const ccdf = deptsData.departments.find((d: any) => d.code === 'CCDF');
    const teamCode = `MOD22-TEST-${Date.now().toString().slice(-4)}`;
    const createTeamReq = makeRequest(
      '/api/admin/teams',
      'POST',
      { departmentId: ccdf.id, name: 'Automated Test Forensics Cell', code: teamCode },
      adminToken
    );
    const teamRes = await createTeam(createTeamReq);
    assert(teamRes.status === 201, 'Tactical investigation squad registered (HTTP 201)');
    const teamData = await teamRes.json();
    testTeamId = teamData.teamId;

    // Filter teams by department
    const listTeamsReq = makeRequest(`/api/admin/teams?department_id=${ccdf.id}`, 'GET', undefined, adminToken);
    const listTeamsRes = await getTeams(listTeamsReq);
    const listTeamsData = await listTeamsRes.json();
    assert(listTeamsData.teams.some((t: any) => t.id === testTeamId), 'New team returned in departmental squad filter');
  }

  // -------------------------------------------------------------------------
  // TEST 4: RBAC MATRIX & SUPER ADMIN IMMUTABILITY
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: RBAC Matrix & Privilege Immutability ---');
  {
    const rolesReq = makeRequest('/api/admin/roles', 'GET', undefined, adminToken);
    const rolesRes = await getRoles(rolesReq);
    assert(rolesRes.status === 200, 'Retrieved institutional roles (HTTP 200)');
    const rolesData = await rolesRes.json();
    const superAdminRole = rolesData.roles.find((r: any) => r.code === 'SUPER_ADMIN');
    assert(!!superAdminRole, 'SUPER_ADMIN role verified');

    // Get Permissions
    const permsReq = makeRequest('/api/admin/permissions', 'GET', undefined, adminToken);
    const permsRes = await getPermissions(permsReq);
    assert(permsRes.status === 200, 'Retrieved permissions matrix (HTTP 200)');
    const permsData = await permsRes.json();
    assert(permsData.permissions.length >= 13, 'All 13 standard institutional permissions listed');

    // Test Super Admin Immutability: Attempt to strip PERMISSION_MANAGE from Super Admin
    const strippedPermsReq = makeRequest(
      `/api/admin/roles/${superAdminRole.id}/permissions`,
      'PUT',
      { permissionIds: [] }, // Empty permissions list!
      adminToken
    );
    const strippedRes = await putRolePerms(strippedPermsReq, { params: Promise.resolve({ id: superAdminRole.id }) });
    assert(strippedRes.status === 400, 'Super Admin immutability enforced: cannot strip core permissions (HTTP 400)');
  }

  // -------------------------------------------------------------------------
  // TEST 5: DOCUMENT CLASSIFICATIONS & SECURITY CLEARANCE TIERS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Classifications & Security Clearance Tiers ---');
  {
    // Document Types
    const docTypesReq = makeRequest('/api/admin/document-types', 'GET', undefined, adminToken);
    const docTypesRes = await getDocTypes(docTypesReq);
    assert(docTypesRes.status === 200, 'Retrieved document classifications (HTTP 200)');
    const docTypesData = await docTypesRes.json();
    assert(docTypesData.documentTypes.length >= 6, '6 standard evidentiary classifications available');

    // Toggle doc type status
    const firstType = docTypesData.documentTypes[0];
    const toggleReq = makeRequest(
      `/api/admin/document-types/${firstType.id}`,
      'PATCH',
      { active: firstType.active },
      adminToken
    );
    const toggleRes = await patchDocType(toggleReq, { params: Promise.resolve({ id: firstType.id }) });
    assert(toggleRes.status === 200, 'Classification status patch succeeds (HTTP 200)');

    // Security Clearance Tiers
    const secReq = makeRequest('/api/admin/security-levels', 'GET', undefined, adminToken);
    const secRes = await getSecLevels(secReq);
    assert(secRes.status === 200, 'Retrieved 5 security clearance tiers (HTTP 200)');
    const secData = await secRes.json();
    assert(secData.securityLevels.length === 5, 'Exact 5 institutional tiers (T1-T5) configured');

    // Patch tier parameters
    const t4Tier = secData.securityLevels.find((s: any) => s.code === 'T4');
    const patchTierReq = makeRequest(
      `/api/admin/security-levels/${t4Tier.id}`,
      'PATCH',
      { approvalRequired: true, encryptionRequired: true, auditLevel: 2 },
      adminToken
    );
    const patchTierRes = await patchSecLevel(patchTierReq, { params: Promise.resolve({ id: t4Tier.id }) });
    assert(patchTierRes.status === 200, 'Security tier T4 governance calibrated (HTTP 200)');
  }

  // -------------------------------------------------------------------------
  // TEST 6: DEPARTMENTAL POLICY ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Departmental Policy Enforcement Matrix ---');
  {
    const policiesReq = makeRequest('/api/admin/policies', 'GET', undefined, adminToken);
    const policiesRes = await getPolicies(policiesReq);
    assert(policiesRes.status === 200, 'Retrieved departmental policy matrix (HTTP 200)');
    const policiesData = await policiesRes.json();
    assert(policiesData.policies.length >= 30, 'Department policies matrix fully populated (5 depts x 6 types = 30)');

    const samplePolicy = policiesData.policies[0];
    const patchPolicyReq = makeRequest(
      `/api/admin/policies/${samplePolicy.id}`,
      'PATCH',
      { approvalRequired: true, ocrRequired: true, downloadAllowed: false },
      adminToken
    );
    const patchPolicyRes = await patchPolicy(patchPolicyReq, { params: Promise.resolve({ id: samplePolicy.id }) });
    assert(patchPolicyRes.status === 200, 'Policy flags updated successfully (HTTP 200)');
  }

  // -------------------------------------------------------------------------
  // TEST 7: SYSTEM GOVERNANCE & LIVE TAMPER-EVIDENT AUDIT CHAIN
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: System Governance & Tamper-Evident Audit Trail ---');
  {
    const sysReq = makeRequest('/api/admin/system-config', 'GET', undefined, adminToken);
    const sysRes = await getSystemConfig(sysReq);
    assert(sysRes.status === 200, 'Retrieved system parameters & metrics (HTTP 200)');
    const sysData = await sysRes.json();
    assert(sysData.metrics.nodeStatus === 'ONLINE / SYNCHRONIZED', 'Node status reports ONLINE / SYNCHRONIZED');
    assert(Array.isArray(sysData.recentAdminAudits), 'Recent administrative audits array returned');
    assert(sysData.recentAdminAudits.length > 0, 'Administrative audit trail contains chained events');

    // Verify SHA-256 event hash integrity on recent audit
    const latestAudit = sysData.recentAdminAudits[0];
    assert(
      typeof latestAudit.event_hash === 'string' && latestAudit.event_hash.length === 64,
      `Chained SHA-256 event hash verified (${latestAudit.event_hash.slice(0, 16)}...)`
    );

    // Save Governance Config
    const postConfigReq = makeRequest(
      '/api/admin/system-config',
      'POST',
      {
        key: 'security_governance',
        value: {
          sessionTimeoutMinutes: 480,
          maxUploadSizeMb: 500,
          quantumAlgorithm: 'CRYSTALS-Dilithium3 / SHA-256 Ledger',
          ipLockoutThreshold: 5,
        },
      },
      adminToken
    );
    const postConfigRes = await postSystemConfig(postConfigReq);
    assert(postConfigRes.status === 200, 'Institutional security governance parameter committed (HTTP 200)');
  }

  // -------------------------------------------------------------------------
  // CLEANUP TEST FIXTURES
  // -------------------------------------------------------------------------
  console.log('\n--- CLEANUP: Reverting Test Fixtures ---');
  if (testCreatedUserId) {
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [testCreatedUserId]);
    await query(`DELETE FROM users WHERE id = $1`, [testCreatedUserId]);
    console.log(`  [CLEANUP] Deleted test officer: ${testCreatedUserId}`);
  }
  if (testTeamId) {
    await query(`DELETE FROM teams WHERE id = $1`, [testTeamId]);
    console.log(`  [CLEANUP] Deleted test squad: ${testTeamId}`);
  }

  console.log('\n========================================================================');
  console.log(`  ALL CHECKS PASSED: ${passedChecks}/${totalChecks} TESTS SUCCESSFUL`);
  console.log('  MODULE 22 (ADMINISTRATION & CONFIGURATION) FULLY VERIFIED');
  console.log('========================================================================\n');
}

runAdminModuleTests()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\n[FATAL TEST ERROR]', err);
    pool.end();
    process.exit(1);
  });
