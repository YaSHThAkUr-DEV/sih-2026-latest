import { query } from '../lib/db';

async function sanitizeDatabase() {
  console.log('--- PURGING DUMMY & TEST DATA FROM DATABASE ---');

  // Truncate transactional, user, and taxonomies with CASCADE
  const tablesToClear = [
    'deletion_requests',
    'approval_actions',
    'change_requests',
    'retention_records',
    'ocr_results',
    'ocr_jobs',
    'processing_jobs',
    'blockchain_records',
    'notifications',
    'audit_events',
    'document_tags',
    'document_permissions',
    'document_versions',
    'documents',
    'tags',
    'system_settings',
    'user_roles',
    'users',
    'role_permissions',
    'roles',
    'document_types',
    'security_levels',
    'departments',
    'organizations',
  ];

  for (const table of tablesToClear) {
    try {
      await query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`✅ Cleared table: ${table}`);
    } catch (err: any) {
      console.warn(`⚠️ Warning on ${table}:`, err.message);
    }
  }

  // Also check if users or organizations need cleaning or reset
  const users = await query<{ id: string; email: string; full_name: string; status: string; role: string }>(
    `SELECT u.id, u.email, u.full_name, u.status, r.name as role
     FROM users u
     LEFT JOIN user_roles ur ON u.id = ur.user_id
     LEFT JOIN roles r ON ur.role_id = r.id
     ORDER BY u.email`
  );

  console.log('\n--- CURRENT LOGIN PROFILES ---');
  for (const u of users) {
    console.log(`👤 ${u.email} | ${u.full_name} | Role: ${u.role || 'NONE'} | Status: ${u.status}`);
  }

  console.log(`\nTotal Login Profiles: ${users.length}`);
  console.log('--- SANITIZATION COMPLETE ---');
  process.exit(0);
}

sanitizeDatabase().catch((err) => {
  console.error('Fatal error during sanitization:', err);
  process.exit(1);
});
