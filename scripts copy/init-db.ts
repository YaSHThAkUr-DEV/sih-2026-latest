import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function initDatabase() {
  console.log('--- Step 1: Checking and creating dms_db ---');
  const rootClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  await rootClient.connect();
  const checkDb = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'dms_db'");
  if (checkDb.rowCount === 0) {
    console.log("Database 'dms_db' not found. Creating it now...");
    await rootClient.query('CREATE DATABASE dms_db');
    console.log("Database 'dms_db' created successfully.");
  } else {
    console.log("Database 'dms_db' already exists.");
  }
  await rootClient.end();

  console.log('\n--- Step 2: Applying SQL Schema to dms_db ---');
  const dmsClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'dms_db',
  });

  await dmsClient.connect();

  const schemaPath = path.resolve(__dirname, '../../proejct doucmentation/DMS_PostgreSQL_Final_Logical_Schema.sql');
  console.log(`Reading SQL schema from: ${schemaPath}`);
  const sqlContent = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await dmsClient.query(sqlContent);
    console.log('✅ All Schema tables, enums, triggers, and indexes created successfully!');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️ Schema elements already exist. Safe to continue.');
    } else {
      console.error('❌ Schema initialization error:', err);
      throw err;
    }
  } finally {
    await dmsClient.end();
  }
}

initDatabase().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
