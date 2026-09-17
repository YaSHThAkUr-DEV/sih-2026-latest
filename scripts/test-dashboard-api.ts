import { query, pool } from '../lib/db';

async function testDashboardData() {
  console.log('--- Testing Dashboard Data Queries ---');

  // Stats
  const totalDocs = await query('SELECT count(*) as count FROM documents');
  const encVersions = await query('SELECT count(*) as count FROM document_versions');
  const pendingApprovals = await query("SELECT count(*) as count FROM change_requests WHERE status = 'PENDING'");
  const auditCount = await query('SELECT count(*) as count FROM audit_events');

  console.log(`✓ Total Case Documents: ${totalDocs[0].count}`);
  console.log(`✓ Encrypted Versions: ${encVersions[0].count}`);
  console.log(`✓ Pending Maker-Checker Approvals: ${pendingApprovals[0].count}`);
  console.log(`✓ Audit Events Logged: ${auditCount[0].count}`);

  // Documents
  const recentDocs = await query(`
    SELECT d.document_number, d.title, dt.name as type, sl.code as tier, dv.version_number
    FROM documents d
    JOIN document_types dt ON d.document_type_id = dt.id
    JOIN security_levels sl ON d.security_level_id = sl.id
    LEFT JOIN document_versions dv ON d.current_version_id = dv.id
    ORDER BY d.created_at DESC
  `);

  console.log('\n--- Recent Documents in DB ---');
  recentDocs.forEach((d: any) => {
    console.log(`• [${d.tier}] ${d.document_number} — ${d.title} (v${d.version_number}) [${d.type}]`);
  });

  await pool.end();
  process.exit(0);
}

testDashboardData().catch((err) => {
  console.error(err);
  process.exit(1);
});
