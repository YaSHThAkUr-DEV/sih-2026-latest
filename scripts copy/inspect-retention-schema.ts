import { query, pool } from '../lib/db';

async function main() {
  const cols = await query(
    `SELECT table_name, column_name, data_type, is_nullable 
     FROM information_schema.columns 
     WHERE table_name IN ('retention_policies', 'retention_records', 'deletion_requests') 
     ORDER BY table_name, ordinal_position`
  );
  
  const tables: Record<string, any[]> = {};
  for (const c of cols) {
    if (!tables[c.table_name]) tables[c.table_name] = [];
    tables[c.table_name].push(`${c.column_name} (${c.data_type}, ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
  }

  for (const [tbl, clist] of Object.entries(tables)) {
    console.log(`\n=== Table: ${tbl} ===`);
    console.log(clist.join('\n'));
  }

  const enums = await query(
    `SELECT t.typname, e.enumlabel 
     FROM pg_type t 
     JOIN pg_enum e ON t.oid = e.enumtypid 
     ORDER BY t.typname, e.enumsortorder`
  );
  console.log('\n=== Enums ===');
  for (const en of enums) {
    console.log(`${en.typname}: ${en.enumlabel}`);
  }

  await pool.end();
}

main().catch(console.error);
