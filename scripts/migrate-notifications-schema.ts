import { query, pool } from '../lib/db';

async function migrateNotifications() {
  console.log('--- Migrating Notifications Schema ---');

  await query(`
    ALTER TABLE notifications 
    ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'INFO',
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
  `);

  console.log('✅ Updated notifications table with severity and metadata columns');
  await pool.end();
}

migrateNotifications().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
