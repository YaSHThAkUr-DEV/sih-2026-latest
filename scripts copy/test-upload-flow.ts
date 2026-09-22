import { query, pool } from '../lib/db';
import { EnvelopeEncryptionService } from '../lib/crypto/envelope';
import { putEncryptedObject, getEncryptedObject, BUCKET_NAME } from '../lib/storage/minio';
import { logAuditEvent } from '../lib/auth/audit';

async function testUploadFlow() {
  console.log('--- Testing Live File Upload & Cryptographic Storage Flow ---');

  // Get test officer and taxonomy IDs
  const users = await query<any>("SELECT id, organization_id FROM users WHERE username = 'officer' LIMIT 1");
  const officer = users[0];

  const types = await query<any>("SELECT id FROM document_types WHERE code = 'FORENSIC_REPORT' LIMIT 1");
  const depts = await query<any>("SELECT id FROM departments WHERE code = 'CCDF' LIMIT 1");
  const tiers = await query<any>("SELECT id FROM security_levels WHERE code = 'T4' LIMIT 1");

  const docNumber = `CIB-TEST-${Date.now().toString().slice(-4)}`;
  const title = 'Live Memory Dump Evidence Artifact';
  const testFileContent = Buffer.from('--- TOP SECRET DIGITAL FORENSIC EVIDENCE: MD5/SHA256 MATCH CONFIRMED ---');

  console.log(`1. Encrypting sample file (${testFileContent.length} bytes)...`);
  const envelope = await EnvelopeEncryptionService.encryptDocument(testFileContent, docNumber);
  console.log(`   ✓ Raw Checksum: ${envelope.sha256Checksum}`);
  console.log(`   ✓ KMS Provider: ${envelope.kmsProvider}`);

  console.log('2. Storing encrypted payload in MinIO...');
  const objectKey = `cib-documents/${docNumber}/v1_evidence.bin.enc`;
  await putEncryptedObject(objectKey, envelope.encryptedPayload, {
    'x-dms-doc': docNumber,
    'x-dms-sha256': envelope.sha256Checksum,
  });
  console.log(`   ✓ Uploaded to MinIO bucket '${BUCKET_NAME}', key: ${objectKey}`);

  console.log('3. Inserting metadata in PostgreSQL...');
  const docRes = await query<any>(
    `INSERT INTO documents (
       organization_id, document_number, title, description,
       document_type_id, department_id, security_level_id,
       owner_id, status, created_by
     )
     VALUES ($1, $2, $3, 'Live test upload', $4, $5, $6, $7, 'ACTIVE', $7)
     RETURNING id;`,
    [officer.organization_id, docNumber, title, types[0].id, depts[0].id, tiers[0].id, officer.id]
  );
  const docId = docRes[0].id;

  const vaultRef = JSON.stringify({
    iv: envelope.iv,
    authTag: envelope.authTag,
    wrappedDek: envelope.wrappedDek,
    kmsProvider: envelope.kmsProvider,
  });

  const verRes = await query<any>(
    `INSERT INTO document_versions (
       document_id, version_number, status, created_by,
       file_name, mime_type, file_size, sha256_hash,
       encryption_algorithm, key_wrap_algorithm, vault_key_reference,
       minio_bucket, minio_object_key, checksum_verified
     )
     VALUES ($1, 1, 'ACTIVE', $2, 'evidence.bin', 'application/octet-stream', $3, $4, $5, $6, $7, $8, $9, true)
     RETURNING id;`,
    [
      docId,
      officer.id,
      testFileContent.length,
      envelope.sha256Checksum,
      envelope.cipherAlgorithm.toUpperCase(),
      envelope.kmsProvider,
      vaultRef,
      BUCKET_NAME,
      objectKey,
    ]
  );
  const verId = verRes[0].id;

  await query('UPDATE documents SET current_version_id = $1 WHERE id = $2', [verId, docId]);
  console.log(`   ✓ Created document ${docId} with version ${verId}`);

  console.log('4. Logging audit event...');
  await logAuditEvent({
    organizationId: officer.organization_id,
    eventType: 'DOCUMENT_UPLOADED',
    actorId: officer.id,
    resourceType: 'DOCUMENT',
    documentId: docId,
    documentVersionId: verId,
    ipAddress: '127.0.0.1',
    result: 'SUCCESS',
    metadata: { documentNumber: docNumber, title, testRun: true },
  });
  console.log('   ✓ Audit event emitted with cryptographically chained SHA-256 hash');

  console.log('5. Fetching back from MinIO and Decrypting...');
  const retrievedBlob = await getEncryptedObject(objectKey);
  const decrypted = await EnvelopeEncryptionService.decryptDocument(
    retrievedBlob,
    envelope.iv,
    envelope.authTag,
    envelope.wrappedDek,
    docNumber
  );

  if (decrypted.toString() === testFileContent.toString()) {
    console.log('🎉 SUCCESS: Full Roundtrip Verified! File retrieved from MinIO & decrypted with 100% fidelity.');
  } else {
    console.error('❌ Decryption mismatch');
  }

  await pool.end();
  process.exit(0);
}

testUploadFlow().catch((err) => {
  console.error(err);
  process.exit(1);
});
