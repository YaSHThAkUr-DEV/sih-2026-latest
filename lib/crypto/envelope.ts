import crypto from 'crypto';
import { VaultService } from './vault';

export interface EncryptedEnvelope {
  encryptedPayload: Buffer;
  iv: string; // 12-byte hex
  authTag: string; // 16-byte hex
  wrappedDek: string;
  kmsProvider: string;
  cipherAlgorithm: string;
  sha256Checksum: string;
  originalSize: number;
}

export class EnvelopeEncryptionService {
  /**
   * Encrypt raw document data using envelope encryption:
   * 1. Generates/wraps a 256-bit DEK via HashiCorp Vault Transit
   * 2. Generates 96-bit random IV
   * 3. Encrypts payload with AES-256-GCM + AAD (binding to document number)
   * 4. Calculates raw SHA-256 for attestation
   */
  public static async encryptDocument(
    data: Buffer,
    documentNumber: string
  ): Promise<EncryptedEnvelope> {
    // 1. Raw integrity hash
    const sha256Checksum = crypto.createHash('sha256').update(data).digest('hex');

    // 2. Generate Data Encryption Key (DEK) via Vault
    const { plaintextKey, encryptedKey, kmsProvider } = await VaultService.generateDataKey();

    // 3. Generate 96-bit (12-byte) initialization vector
    const iv = crypto.randomBytes(12);

    // 4. Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', plaintextKey, iv);
    
    // Additional Authenticated Data (AAD) binds encryption to this specific document number
    cipher.setAAD(Buffer.from(documentNumber, 'utf8'));

    const encryptedPayload = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedPayload,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      wrappedDek: encryptedKey,
      kmsProvider,
      cipherAlgorithm: 'aes-256-gcm',
      sha256Checksum,
      originalSize: data.length,
    };
  }

  /**
   * Decrypts encrypted document blob back into plaintext
   */
  public static async decryptDocument(
    encryptedPayload: Buffer,
    ivHex: string,
    authTagHex: string,
    wrappedDek: string,
    documentNumber: string
  ): Promise<Buffer> {
    // 1. Un-wrap DEK via Vault Transit or Local KMS
    const dek = await VaultService.decryptDataKey(wrappedDek);

    // 2. Setup decipher
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
      if (documentNumber) {
        decipher.setAAD(Buffer.from(documentNumber, 'utf8'));
      }
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
    } catch (aadErr) {
      // Fallback: try deciphering without AAD binding
      const decipherNoAad = crypto.createDecipheriv('aes-256-gcm', dek, iv);
      decipherNoAad.setAuthTag(authTag);
      return Buffer.concat([decipherNoAad.update(encryptedPayload), decipherNoAad.final()]);
    }
  }
}
