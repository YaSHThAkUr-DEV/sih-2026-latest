import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

async function verifyAndSimulateRestore() {
  console.log('========================================================================');
  console.log('  SECURE DMS DISASTER RECOVERY & BACKUP VERIFICATION UTILITY');
  console.log('========================================================================\n');

  const backupsBaseDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsBaseDir)) {
    throw new Error('No backups directory found.');
  }

  // Find latest backup directory
  const entries = fs.readdirSync(backupsBaseDir).filter((e) => e.startsWith('dms-backup-'));
  if (entries.length === 0) {
    throw new Error('No backup bundles found in backups directory.');
  }

  entries.sort().reverse();
  const latestBackupDir = path.join(backupsBaseDir, entries[0]);
  console.log(`[RESTORE_TARGET] Verifying latest archive: ${latestBackupDir}`);

  const manifestPath = path.join(latestBackupDir, 'backup-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Missing backup-manifest.json in backup bundle!');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`[MANIFEST] Identifier: ${manifest.backupIdentifier}`);
  console.log(`[MANIFEST] Node:       ${manifest.nodeIdentity}`);
  console.log(`[MANIFEST] Timestamp:  ${manifest.generatedAt}\n`);

  // 1. Verify Database Dump Checksum
  const dbFile = path.join(latestBackupDir, manifest.components.database.file);
  const dbHash = crypto.createHash('sha256').update(fs.readFileSync(dbFile)).digest('hex');
  if (dbHash !== manifest.components.database.sha256) {
    throw new Error(`Database dump checksum mismatch! Expected ${manifest.components.database.sha256}, got ${dbHash}`);
  }
  console.log(`  [PASS] Database Dump Checksum Verified: ${dbHash.slice(0, 16)}...`);

  // 2. Verify Evidentiary Documents Manifest Checksum
  const docFile = path.join(latestBackupDir, manifest.components.evidentiaryDocuments.file);
  const docHash = crypto.createHash('sha256').update(fs.readFileSync(docFile)).digest('hex');
  if (docHash !== manifest.components.evidentiaryDocuments.sha256) {
    throw new Error(`Documents manifest checksum mismatch!`);
  }
  console.log(`  [PASS] Evidentiary Manifest Checksum Verified: ${docHash.slice(0, 16)}...`);

  // 3. Verify Blockchain Ledger Checksum
  const bcFile = path.join(latestBackupDir, manifest.components.blockchainLedger.file);
  const bcHash = crypto.createHash('sha256').update(fs.readFileSync(bcFile)).digest('hex');
  if (bcHash !== manifest.components.blockchainLedger.sha256) {
    throw new Error(`Blockchain ledger checksum mismatch!`);
  }
  console.log(`  [PASS] Blockchain Ledger Checksum Verified: ${bcHash.slice(0, 16)}...`);

  // 4. Verify Master Integrity Hash
  const masterPayload = `${dbHash}:${docHash}:${bcHash}:${manifest.backupIdentifier.replace('CIB-BACKUP-', '')}`;
  const computedMaster = crypto.createHash('sha256').update(masterPayload).digest('hex');
  if (computedMaster !== manifest.masterIntegrityHash) {
    throw new Error('Master cryptographic integrity hash failed verification!');
  }
  console.log(`  [PASS] Master Section 65B Integrity Hash Verified: ${computedMaster.slice(0, 16)}...`);

  console.log('\n========================================================================');
  console.log('  BACKUP ARCHIVE INTEGRITY 100% VALIDATED & READY FOR INSTANT RESTORE');
  console.log('========================================================================\n');
}

verifyAndSimulateRestore().catch((err) => {
  console.error('[RESTORE_ERROR]', err);
  process.exit(1);
});
