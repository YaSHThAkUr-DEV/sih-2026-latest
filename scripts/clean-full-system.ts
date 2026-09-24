import { pool, query } from '../lib/db';
import { s3Client, BUCKET_NAME } from '../lib/storage/minio';
import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { invalidateCache } from '../lib/cache/redis';

async function main() {
  console.log('================================================================');
  console.log('   STARTING FULL SYSTEM DATABASE & OBJECT DB PURGE & CLEANUP    ');
  console.log('================================================================\n');

  // 1. Clean Object DB (MinIO)
  console.log(`[1/3] Purging MinIO Object DB Bucket '${BUCKET_NAME}'...`);
  try {
    const listRes = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
    if (listRes.Contents && listRes.Contents.length > 0) {
      console.log(`  Found ${listRes.Contents.length} objects to delete.`);
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: listRes.Contents.map((c) => ({ Key: c.Key! })),
          Quiet: false,
        },
      };
      const delRes = await s3Client.send(new DeleteObjectsCommand(deleteParams));
      console.log(`  ✓ Successfully deleted ${delRes.Deleted?.length || 0} objects from MinIO.`);
    } else {
      console.log(`  ✓ MinIO bucket '${BUCKET_NAME}' is already clean (0 objects).`);
    }

    // Verify
    const verifyList = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
    console.log(`  ✓ MinIO Object DB Status: ${verifyList.KeyCount || 0} remaining objects.`);
  } catch (err: any) {
    console.error('  ⚠️ MinIO purge warning/error:', err.message);
  }

  // 2. Clean Database Transaction Tables
  console.log('\n[2/3] Cleaning PostgreSQL Transaction Tables...');
  const tablesToTruncate = [
    'inter_org_access_logs',
    'inter_org_shares',
    'inter_org_requests',
    'inter_org_workspace_documents',
    'inter_org_workspace_members',
    'inter_org_workspaces',
    'approval_actions',
    'change_requests',
    'deletion_requests',
    'retention_records',
    'ocr_results',
    'ocr_jobs',
    'processing_jobs',
    'blockchain_records',
    'document_tags',
    'document_permissions',
    'notifications',
    'audit_events',
  ];

  for (const table of tablesToTruncate) {
    try {
      await query(`TRUNCATE TABLE ${table} CASCADE;`);
      console.log(`  ✓ Cleared table: ${table}`);
    } catch (err: any) {
      console.warn(`  ⚠️ Could not truncate ${table}: ${err.message}`);
    }
  }

  // Handle documents & document_versions
  try {
    await query(`UPDATE documents SET current_version_id = NULL;`);
    await query(`TRUNCATE TABLE document_versions CASCADE;`);
    await query(`TRUNCATE TABLE documents CASCADE;`);
    console.log(`  ✓ Cleared tables: document_versions, documents`);
  } catch (err: any) {
    console.warn(`  ⚠️ Error clearing documents: ${err.message}`);
  }

  // 3. Clear Redis Cache
  console.log('\n[3/3] Invalidating Redis System Caches...');
  try {
    await invalidateCache('dms:*');
    await invalidateCache('collab:*');
    await invalidateCache('taxonomy:*');
    console.log('  ✓ Redis caches invalidated.');
  } catch (err: any) {
    console.warn('  ⚠️ Redis cache invalidation warning:', err.message);
  }

  // 4. Verification Summary
  console.log('\n================================================================');
  console.log('   SYSTEM STATE VERIFICATION POST-CLEANUP                      ');
  console.log('================================================================');
  
  const orgCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM organizations');
  const deptCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM departments');
  const userCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM users');
  const docCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
  const taxCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM taxonomy_statutory_templates');

  console.log(`  - Sovereign Organizations: ${orgCount[0]?.count} active`);
  console.log(`  - Departments:            ${deptCount[0]?.count} active`);
  console.log(`  - Enrolled Officers:      ${userCount[0]?.count} active`);
  console.log(`  - Vault Documents:        ${docCount[0]?.count} (Pruned & Clean)`);
  console.log(`  - Statutory Taxonomies:   ${taxCount[0]?.count} active`);
  console.log('================================================================\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
