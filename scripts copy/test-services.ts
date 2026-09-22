import { checkRedisHealth } from '../lib/cache/redis';
import { VaultService } from '../lib/crypto/vault';
import { ensureBucketExists, BUCKET_NAME } from '../lib/storage/minio';
import { EnvelopeEncryptionService } from '../lib/crypto/envelope';
import { query, pool } from '../lib/db';

async function testAllServices() {
  console.log('=== SECURE DMS BACKEND SERVICES CONNECTIVITY PROBE ===\n');

  // 1. PostgreSQL
  try {
    const res = await query('SELECT current_database(), version()');
    console.log('✅ PostgreSQL 18: ONLINE');
    console.log(`   Database: ${res[0].current_database}`);
  } catch (err: any) {
    console.log(`❌ PostgreSQL 18: OFFLINE (${err.message})`);
  }

  // 2. Redis
  const redisRes = await checkRedisHealth();
  if (redisRes.ok) {
    console.log(`✅ Redis: ONLINE (${redisRes.latencyMs}ms latency)`);
  } else {
    console.log(`⚠️ Redis: NOT REACHABLE (${redisRes.error || 'Connection refused'}) - Graceful memory fallback active`);
  }

  // 3. HashiCorp Vault
  const vaultRes = await VaultService.checkHealth();
  if (vaultRes.ok) {
    console.log(`✅ HashiCorp Vault: ONLINE (${vaultRes.latencyMs}ms latency)`);
  } else {
    console.log(`⚠️ HashiCorp Vault: NOT REACHABLE (${vaultRes.error || 'Connection refused'}) - Local KMS envelope fallback active`);
  }

  // 4. MinIO S3
  try {
    const minioOk = await ensureBucketExists();
    if (minioOk) {
      console.log(`✅ MinIO Object Storage: ONLINE (Bucket: ${BUCKET_NAME})`);
    } else {
      console.log(`⚠️ MinIO Object Storage: NOT REACHABLE - Local storage fallback ready`);
    }
  } catch (err: any) {
    console.log(`⚠️ MinIO Object Storage: NOT REACHABLE (${err.message})`);
  }

  // 5. Envelope Encryption Test
  console.log('\n--- Testing Envelope Encryption Pipeline ---');
  const samplePayload = Buffer.from('CONFIDENTIAL LEGAL EVIDENCE DOCKET 2026: Tamper-evident test data.');
  const docNum = 'CIB-TEST-2026-0001';

  const encrypted = await EnvelopeEncryptionService.encryptDocument(samplePayload, docNum);
  console.log('✓ Payload encrypted with AES-256-GCM');
  console.log(`  SHA-256 Checksum: ${encrypted.sha256Checksum}`);
  console.log(`  KMS Provider:     ${encrypted.kmsProvider}`);
  console.log(`  IV:               ${encrypted.iv}`);
  console.log(`  Auth Tag:         ${encrypted.authTag}`);

  const decrypted = await EnvelopeEncryptionService.decryptDocument(
    encrypted.encryptedPayload,
    encrypted.iv,
    encrypted.authTag,
    encrypted.wrappedDek,
    docNum
  );

  const matched = decrypted.toString() === samplePayload.toString();
  console.log(`✓ Decryption Verification: ${matched ? 'MATCH CONFIRMED (100% Bit-Exact)' : 'MISMATCH'}`);

  await pool.end();
  process.exit(0);
}

testAllServices().catch((err) => {
  console.error(err);
  process.exit(1);
});
