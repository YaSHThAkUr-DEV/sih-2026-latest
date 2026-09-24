import { pool, query } from '../lib/db';

async function testWORM() {
  console.log('--- Testing WORM Trigger Protection on PostgreSQL Database ---');

  // 1. Fetch an existing organization ID
  const orgs = await query<{ id: string }>('SELECT id FROM organizations LIMIT 1;');
  const orgId = orgs[0]?.id;

  // 2. Insert a test audit record
  const inserted = await query<{ id: string }>(`
    INSERT INTO audit_events (
      organization_id, event_type, result, event_hash, ip_address
    ) VALUES (
      $1, 'FORENSIC_VIGILANCE_CHECK', 'SUCCESS', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', '127.0.0.1'
    ) RETURNING id;
  `, [orgId]);
  const testId = inserted[0].id;
  console.log('✓ Successfully inserted WORM audit record ID:', testId);

  // 3. Try to UPDATE the record (Must be blocked by database engine trigger)
  try {
    await query(`UPDATE audit_events SET result = 'DENIED' WHERE id = $1;`, [testId]);
    console.error('❌ FAILED: Record was updated! WORM trigger did not fire.');
  } catch (err: any) {
    console.log('✅ UPDATE blocked by DB trigger:\n   ->', err.message);
  }

  // 4. Try to DELETE the record (Must be blocked by database engine trigger)
  try {
    await query(`DELETE FROM audit_events WHERE id = $1;`, [testId]);
    console.error('❌ FAILED: Record was deleted! WORM trigger did not fire.');
  } catch (err: any) {
    console.log('✅ DELETE blocked by DB trigger:\n   ->', err.message);
  }

  await pool.end();
}

testWORM().catch(console.error);
