import { query, pool } from '../lib/db';

async function migrate() {
  console.log('--- Migrating Retention Schema & Columns ---');

  // 1. Add extra columns to retention_policies if not exists
  await query(`
    ALTER TABLE retention_policies 
    ADD COLUMN IF NOT EXISTS schedule_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS action_on_expiry VARCHAR(100) DEFAULT 'Crypto-Shred After Expiry',
    ADD COLUMN IF NOT EXISTS statutory_framework VARCHAR(100) DEFAULT 'BNSS 2023'
  `);
  console.log('✅ Updated retention_policies columns');

  // 2. Add extra columns to retention_records if not exists
  await query(`
    ALTER TABLE retention_records 
    ADD COLUMN IF NOT EXISTS legal_hold_order_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS legal_hold_authority VARCHAR(200),
    ADD COLUMN IF NOT EXISTS legal_hold_reason TEXT,
    ADD COLUMN IF NOT EXISTS legal_hold_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS legal_hold_applied_at TIMESTAMPTZ
  `);
  console.log('✅ Updated retention_records columns');

  // 3. Add extra columns to deletion_requests if not exists
  await query(`
    ALTER TABLE deletion_requests 
    ADD COLUMN IF NOT EXISTS shred_method VARCHAR(100) DEFAULT 'WORM Object Purge + KMS Transit Key Zeroization',
    ADD COLUMN IF NOT EXISTS approver_token_id VARCHAR(100)
  `);
  console.log('✅ Updated deletion_requests columns');

  await pool.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
