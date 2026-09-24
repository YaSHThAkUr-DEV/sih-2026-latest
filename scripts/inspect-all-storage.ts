import { pool, query } from '../lib/db';
import { s3Client, BUCKET_NAME } from '../lib/storage/minio';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

async function check() {
  console.log('--- Checking DB Table Row Counts ---');
  const tables = await query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  for (const t of tables) {
    const res = await query<{ count: string }>(`SELECT COUNT(*) as count FROM ${t.table_name}`);
    console.log(`  ${t.table_name}: ${res[0].count}`);
  }

  console.log('\n--- Checking MinIO Bucket Objects ---');
  try {
    const listRes = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
    console.log(`Bucket '${BUCKET_NAME}' contains ${listRes.KeyCount || 0} objects:`);
    if (listRes.Contents) {
      listRes.Contents.forEach((c) => console.log(`  - ${c.Key} (${c.Size} bytes)`));
    }
  } catch (err: any) {
    console.log('MinIO check:', err.message);
  }

  await pool.end();
}

check().catch(console.error);
