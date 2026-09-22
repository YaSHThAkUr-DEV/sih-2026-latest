import { VaultService } from '../lib/crypto/vault';

async function testVault() {
  console.log('--- 1. Testing HashiCorp Vault Health ---');
  const health = await VaultService.checkHealth();
  console.log('Vault Health Result:', JSON.stringify(health, null, 2));

  console.log('\n--- 2. Testing Live Envelope Encryption (Generate & Wrap DEK) ---');
  const dek = await VaultService.generateDataKey();
  console.log('Generated DEK plaintext length:', dek.plaintextKey.length, 'bytes (AES-256)');
  console.log('KMS Provider:', dek.kmsProvider);
  console.log('Encrypted wrapped DEK token:', dek.encryptedKey.substring(0, 40) + '...');

  console.log('\n--- 3. Testing Live Envelope Decryption (Unwrap DEK) ---');
  const unwrapped = await VaultService.decryptDataKey(dek.encryptedKey);
  console.log('Unwrapped Key length:', unwrapped.length, 'bytes');
  console.log('Matches original plaintext DEK?:', dek.plaintextKey.equals(unwrapped) ? '✅ YES (100% MATCH)' : '❌ NO');

  process.exit(0);
}

testVault();
