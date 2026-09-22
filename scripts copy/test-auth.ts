import { query } from '../lib/db';
import { verifyPassword } from '../lib/auth/crypto';
import { createSessionToken, verifySessionToken } from '../lib/auth/jwt';
import { logAuditEvent } from '../lib/auth/audit';

async function testAuthPipeline() {
  console.log('====================================');
  console.log('🧪 RUNNING AUTH BACKEND VERIFICATION');
  console.log('====================================\n');

  // Test 1: User lookup & password hash verification
  console.log('Test 1: User lookup & bcrypt verification...');
  const users = await query('SELECT * FROM users WHERE email = $1', ['admin@dms.gov.in']);
  if (users.length === 0) {
    throw new Error('Admin user not found in database! Did seed run?');
  }
  const admin = users[0];
  console.log(`✓ Admin user found: ${admin.full_name} (${admin.email})`);

  const passOk = await verifyPassword('Admin@DMS2026!', admin.password_hash);
  if (!passOk) {
    throw new Error('Password verification failed for Admin@DMS2026!');
  }
  console.log('✓ Valid password verification succeeded.');

  const passFail = await verifyPassword('WrongPassword123!', admin.password_hash);
  if (passFail) {
    throw new Error('Wrong password unexpectedly verified as true!');
  }
  console.log('✓ Invalid password correctly rejected.');

  // Test 2: Roles and Permissions aggregation
  console.log('\nTest 2: Role & Permission aggregation...');
  const roles = await query(
    `SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1`,
    [admin.id]
  );
  console.log(`✓ Roles assigned: ${roles.map((r: any) => r.code).join(', ')}`);

  const perms = await query(
    `SELECT DISTINCT p.code FROM user_roles ur 
     JOIN role_permissions rp ON ur.role_id = rp.role_id 
     JOIN permissions p ON rp.permission_id = p.id 
     WHERE ur.user_id = $1`,
    [admin.id]
  );
  console.log(`✓ Permissions count: ${perms.length} system permissions resolved.`);

  // Test 3: JWT Token generation and verification
  console.log('\nTest 3: JWT creation & verification...');
  const token = await createSessionToken({
    userId: admin.id,
    username: admin.username,
    fullName: admin.full_name,
    email: admin.email,
    organizationId: admin.organization_id,
    organizationCode: 'DEMO',
    organizationName: 'General Administration Department',
    roles: roles.map((r: any) => r.code),
    permissions: perms.map((p: any) => p.code),
    maxSecurityLevel: admin.max_security_level ?? 5,
  });
  console.log(`✓ JWT generated (length: ${token.length} chars).`);

  const verified = await verifySessionToken(token);
  if (!verified || verified.userId !== admin.id) {
    throw new Error('JWT verification failed or payload mismatch!');
  }
  console.log(`✓ JWT verified: Subject=${verified.username}, Roles=${verified.roles.join(',')}`);

  // Test 4: Audit Event logging
  console.log('\nTest 4: Tamper-evident Audit Logging...');
  const auditId = await logAuditEvent({
    organizationId: admin.organization_id,
    eventType: 'TEST_AUTH_VERIFICATION',
    actorId: admin.id,
    result: 'SUCCESS',
    ipAddress: '127.0.0.1',
    userAgent: 'DMS-Test-Runner/1.0',
    metadata: { test: true, timestamp: new Date().toISOString() },
  });

  const auditRows = await query('SELECT * FROM audit_events WHERE id = $1', [auditId]);
  if (auditRows.length === 0) {
    throw new Error('Audit event was not persisted to audit_events table!');
  }
  const event = auditRows[0];
  console.log(`✓ Audit event stored in DB with ID: ${event.id}`);
  console.log(`✓ Tamper-evident SHA-256 event hash: ${event.event_hash}`);

  console.log('\n====================================');
  console.log('🎉 ALL AUTH BACKEND TESTS PASSED!');
  console.log('====================================');
  process.exit(0);
}

testAuthPipeline().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
