import { pool, query } from '../lib/db';

async function enforceWORMImmutability() {
  console.log('--- Enforcing PostgreSQL Database-Level WORM Immutability ---');

  // 1. Create the anti-tampering trigger function
  await query(`
    CREATE OR REPLACE FUNCTION prevent_audit_tampering()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'TAMPER_PREVENTION_VIOLATION: Audit logs and blockchain records are strictly WORM (Write Once, Read Many) immutable under Section 65B BSA 2023. UPDATE and DELETE operations are physically prohibited.';
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('✓ Created prevent_audit_tampering() trigger function.');

  // 2. Attach trigger to audit_events
  await query(`
    DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;
    CREATE TRIGGER trg_audit_events_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_tampering();
  `);
  console.log('✓ Attached WORM immutable trigger to audit_events.');

  // 3. Attach trigger to inter_org_access_logs
  await query(`
    DROP TRIGGER IF EXISTS trg_inter_org_access_logs_immutable ON inter_org_access_logs;
    CREATE TRIGGER trg_inter_org_access_logs_immutable
    BEFORE UPDATE OR DELETE ON inter_org_access_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_tampering();
  `);
  console.log('✓ Attached WORM immutable trigger to inter_org_access_logs.');

  // 4. Attach trigger to blockchain_records
  await query(`
    DROP TRIGGER IF EXISTS trg_blockchain_records_immutable ON blockchain_records;
    CREATE TRIGGER trg_blockchain_records_immutable
    BEFORE UPDATE OR DELETE ON blockchain_records
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_tampering();
  `);
  console.log('✓ Attached WORM immutable trigger to blockchain_records.');

  console.log('✅ PostgreSQL engine-level WORM immutability is now active on all audit and blockchain tables!');
  await pool.end();
}

enforceWORMImmutability().catch((err) => {
  console.error('Failed to enforce WORM triggers:', err);
  process.exit(1);
});
