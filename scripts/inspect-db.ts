import { query, pool } from '../lib/db';

async function main() {
  const tables = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  const users = await query<{ username: string; email: string; designation: string; status: string }>(
    "SELECT username, email, designation, status FROM users ORDER BY created_at"
  );
  const orgs = await query<{ name: string; code: string }>("SELECT name, code FROM organizations");
  const depts = await query<{ name: string; code: string }>("SELECT name, code FROM departments");
  const roles = await query<{ name: string; code: string }>("SELECT name, code FROM roles");
  const audit = await query<{ count: string }>("SELECT count(*) as count FROM audit_events");

  console.log('=== DATABASE STATUS: dms_db ===');
  console.log(`Tables Total: ${tables.length}`);
  console.log('Tables:', tables.map((t) => t.table_name).join(', '));
  console.log(`\nOrganizations (${orgs.length}):`, orgs);
  console.log(`Departments (${depts.length}):`, depts.map((d) => `${d.name} (${d.code})`));
  console.log(`Roles (${roles.length}):`, roles.map((r) => r.code));
  console.log(`Users (${users.length}):`, users);
  console.log(`Audit Events Logged: ${audit[0].count}`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
