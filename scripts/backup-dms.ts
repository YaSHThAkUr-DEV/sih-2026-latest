import { query, pool } from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

async function performAirgappedBackup() {
  console.log('========================================================================');
  console.log('  SECURE DMS AIRGAPPED DISASTER RECOVERY & BACKUP UTILITY');
  console.log('========================================================================\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', `dms-backup-${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`[BACKUP_INIT] Destination Directory: ${backupDir}`);

  // 1. Capture Critical Table Counts & Data Dumps
  const tablesToBackup = [
    'organizations',
    'departments',
    'teams',
    'users',
    'roles',
    'permissions',
    'user_roles',
    'role_permissions',
    'document_types',
    'security_levels',
    'document_type_policies',
    'retention_policies',
    'system_settings',
    'documents',
    'document_versions',
    'audit_events',
    'blockchain_records',
  ];

  const tableDumps: Record<string, any[]> = {};
  const tableStats: Record<string, number> = {};

  for (const table of tablesToBackup) {
    try {
      const rows = await query(`SELECT * FROM ${table}`);
      tableDumps[table] = rows;
      tableStats[table] = rows.length;
      console.log(`  [DUMP] Table "${table}": ${rows.length} records exported`);
    } catch (err: any) {
      console.warn(`  [DUMP_WARN] Could not dump table "${table}":`, err.message);
    }
  }

  // Write relational database dump
  const dbDumpFile = path.join(backupDir, 'database-dump.json');
  fs.writeFileSync(dbDumpFile, JSON.stringify(tableDumps, null, 2), 'utf-8');

  // Compute database dump SHA-256
  const dbDumpHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(dbDumpFile))
    .digest('hex');

  console.log(`✓ Relational database dump written. SHA-256: ${dbDumpHash}`);

  // 2. Capture MinIO Evidentiary Documents Manifest
  const documents = await query<{
    id: string;
    document_number: string;
    title: string;
    file_name: string;
    sha256_hash: string;
    minio_bucket: string;
    minio_object_key: string;
    encryption_algorithm: string;
    vault_key_reference: string;
  }>(`
    SELECT 
      d.id, d.document_number, d.title,
      dv.file_name, dv.sha256_hash, dv.minio_bucket,
      dv.minio_object_key, dv.encryption_algorithm, dv.vault_key_reference
    FROM documents d
    JOIN document_versions dv ON d.id = dv.document_id
    WHERE d.status != 'DELETED'
  `);

  const docManifestFile = path.join(backupDir, 'evidentiary-manifest.json');
  fs.writeFileSync(docManifestFile, JSON.stringify(documents, null, 2), 'utf-8');

  const docManifestHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(docManifestFile))
    .digest('hex');

  console.log(`✓ Evidentiary document manifest written (${documents.length} files). SHA-256: ${docManifestHash}`);

  // 3. Capture Blockchain Ledger State
  const blockchainBlocks = await query(`SELECT * FROM blockchain_records ORDER BY submitted_at ASC`);
  const blockchainFile = path.join(backupDir, 'blockchain-ledger.json');
  fs.writeFileSync(blockchainFile, JSON.stringify(blockchainBlocks, null, 2), 'utf-8');

  const blockchainHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(blockchainFile))
    .digest('hex');

  console.log(`✓ Blockchain ledger state written (${blockchainBlocks.length} blocks). SHA-256: ${blockchainHash}`);

  // 4. Generate Master Cryptographic Section 65B Attestation Manifest
  const masterPayload = `${dbDumpHash}:${docManifestHash}:${blockchainHash}:${timestamp}`;
  const masterIntegrityHash = crypto.createHash('sha256').update(masterPayload).digest('hex');

  const manifest = {
    backupIdentifier: `CIB-BACKUP-${timestamp}`,
    generatedAt: new Date().toISOString(),
    nodeIdentity: 'CIB-DELHI-HQ-SEC-NODE-01',
    statutoryFramework: 'Section 65B Indian Evidence Act / BNSS §173',
    components: {
      database: {
        file: 'database-dump.json',
        sha256: dbDumpHash,
        tableStats,
      },
      evidentiaryDocuments: {
        file: 'evidentiary-manifest.json',
        sha256: docManifestHash,
        totalActiveFiles: documents.length,
      },
      blockchainLedger: {
        file: 'blockchain-ledger.json',
        sha256: blockchainHash,
        totalBlocks: blockchainBlocks.length,
      },
    },
    masterIntegrityHash,
  };

  const masterManifestFile = path.join(backupDir, 'backup-manifest.json');
  fs.writeFileSync(masterManifestFile, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n========================================================================');
  console.log('  AIRGAPPED BACKUP COMPLETED SUCCESSFULLY');
  console.log(`  Master Manifest: ${masterManifestFile}`);
  console.log(`  Master SHA-256:  ${masterIntegrityHash}`);
  console.log('========================================================================\n');
}

performAirgappedBackup()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[BACKUP_FATAL_ERROR]', err);
    pool.end();
    process.exit(1);
  });
