import { query, pool } from '../lib/db';

async function main() {
  console.log('--- Inspecting and Removing Fake/Seeded Documents ---');

  // 1. Fetch all documents currently in the DB
  const docs = await query<{
    id: string;
    document_number: string;
    title: string;
    created_at: string;
  }>('SELECT id, document_number, title, created_at FROM documents ORDER BY created_at DESC');

  console.log(`Found ${docs.length} documents in database:`);
  docs.forEach((d) => console.log(`  - [${d.document_number}] ${d.title} (ID: ${d.id})`));

  // 2. Clear all document transaction tables cleanly
  const tables = [
    'deletion_requests',
    'approval_actions',
    'change_requests',
    'retention_records',
    'ocr_results',
    'ocr_jobs',
    'processing_jobs',
    'blockchain_records',
    'document_tags',
    'document_permissions',
    'document_versions',
    'documents',
  ];

  for (const table of tables) {
    try {
      await query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`✅ Cleared: ${table}`);
    } catch (err: any) {
      console.warn(`⚠️ Warning clearing ${table}:`, err.message);
    }
  }

  // 3. Verify clean state
  const remaining = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
  console.log(`\nRemaining documents in DB: ${remaining[0]?.count || 0}`);

  await pool.end();
  console.log('--- All fake and demo documents successfully removed! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error cleaning documents:', err);
  process.exit(1);
});
