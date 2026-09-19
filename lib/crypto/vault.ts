import crypto from 'crypto';

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN || 'dev-only-token';
const KEY_NAME = process.env.VAULT_KEY_NAME || 'dms-master-key';

// Local KMS Fallback key (32 bytes) for dev/offline resilience
const LOCAL_KEK = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'dms-master-kek-2026').digest();

export interface EnvelopeKeyResult {
  plaintextKey: Buffer;
  encryptedKey: string;
  kmsProvider: 'VAULT_TRANSIT' | 'LOCAL_KMS_DEV';
  keyVersion?: number;
}

export class VaultService {
  /**
   * Health check for HashiCorp Vault
   */
  public static async checkHealth(): Promise<{ ok: boolean; latencyMs: number; initialized?: boolean; sealed?: boolean; error?: string }> {
    const start = Date.now();
    try {
      const res = await fetch(`${VAULT_ADDR}/v1/sys/health`, {
        method: 'GET',
        headers: { 'X-Vault-Token': VAULT_TOKEN },
        signal: AbortSignal.timeout(3000),
      });

      const latency = Date.now() - start;
      const data = await res.json().catch(() => ({}));

      // Vault returns 200 for unsealed active, 429 for standby, 501 for uninitialized, 503 for sealed
      const ok = res.status === 200 || res.status === 429;
      return {
        ok,
        latencyMs: latency,
        initialized: data.initialized ?? true,
        sealed: data.sealed ?? false,
      };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Ensure Vault Transit secret engine and key exist
   */
  public static async ensureTransitKey(): Promise<boolean> {
    try {
      // 1. Check if transit key exists
      const checkRes = await fetch(`${VAULT_ADDR}/v1/transit/keys/${KEY_NAME}`, {
        headers: { 'X-Vault-Token': VAULT_TOKEN },
        signal: AbortSignal.timeout(3000),
      });

      if (checkRes.status === 200) {
        return true;
      }

      // If 404, maybe transit engine is mounted but key doesn't exist
      if (checkRes.status === 404) {
        // Attempt to create key
        const createKeyRes = await fetch(`${VAULT_ADDR}/v1/transit/keys/${KEY_NAME}`, {
          method: 'POST',
          headers: {
            'X-Vault-Token': VAULT_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'aes256-gcm96' }),
          signal: AbortSignal.timeout(3000),
        });

        if (createKeyRes.ok) {
          console.log(`[VAULT] Created transit key '${KEY_NAME}' successfully.`);
          return true;
        }

        // If that failed with 404, transit engine itself might not be mounted
        await fetch(`${VAULT_ADDR}/v1/sys/mounts/transit`, {
          method: 'POST',
          headers: {
            'X-Vault-Token': VAULT_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'transit' }),
          signal: AbortSignal.timeout(3000),
        });

        // Retry key creation
        const retryCreate = await fetch(`${VAULT_ADDR}/v1/transit/keys/${KEY_NAME}`, {
          method: 'POST',
          headers: {
            'X-Vault-Token': VAULT_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'aes256-gcm96' }),
          signal: AbortSignal.timeout(3000),
        });

        return retryCreate.ok;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generate a high-entropy Data Encryption Key (DEK) wrapped by KEK
   */
  public static async generateDataKey(): Promise<EnvelopeKeyResult> {
    try {
      const transitReady = await VaultService.ensureTransitKey();
      if (transitReady) {
        // Request 256-bit plaintext datakey from Vault Transit
        const res = await fetch(`${VAULT_ADDR}/v1/transit/datakey/plaintext/${KEY_NAME}`, {
          method: 'POST',
          headers: {
            'X-Vault-Token': VAULT_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bits: 256 }),
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const payload = await res.json();
          const plaintextBase64 = payload.data?.plaintext;
          const ciphertext = payload.data?.ciphertext;

          if (plaintextBase64 && ciphertext) {
            return {
              plaintextKey: Buffer.from(plaintextBase64, 'base64'),
              encryptedKey: ciphertext, // e.g. "vault:v1:..."
              kmsProvider: 'VAULT_TRANSIT',
            };
          }
        }
      }
    } catch (err: any) {
      console.warn('[VAULT_WARN] Transit datakey generation unavailable, falling back to local KMS:', err.message);
    }

    // Fallback: Local AES-256-GCM Key Wrap
    const randomDek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', LOCAL_KEK, iv);
    const encryptedDek = Buffer.concat([cipher.update(randomDek), cipher.final()]);
    const tag = cipher.getAuthTag();

    const packedKey = `local:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encryptedDek.toString('hex')}`;

    return {
      plaintextKey: randomDek,
      encryptedKey: packedKey,
      kmsProvider: 'LOCAL_KMS_DEV',
    };
  }

  /**
   * Decrypt wrapped DEK using Vault or local fallback
   */
  public static async decryptDataKey(encryptedKey: string): Promise<Buffer> {
    if (encryptedKey.startsWith('vault:')) {
      try {
        const res = await fetch(`${VAULT_ADDR}/v1/transit/decrypt/${KEY_NAME}`, {
          method: 'POST',
          headers: {
            'X-Vault-Token': VAULT_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ciphertext: encryptedKey }),
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const payload = await res.json();
          const plaintextBase64 = payload.data?.plaintext;
          if (plaintextBase64) {
            return Buffer.from(plaintextBase64, 'base64');
          }
        }
      } catch (err: any) {
        throw new Error(`HashiCorp Vault decrypt failed: ${err.message}`);
      }
    } else if (encryptedKey.startsWith('local:v1:')) {
      const parts = encryptedKey.split(':');
      if (parts.length === 5) {
        const iv = Buffer.from(parts[2], 'hex');
        const tag = Buffer.from(parts[3], 'hex');
        const ciphertext = Buffer.from(parts[4], 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', LOCAL_KEK, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      }
    }

    throw new Error('Unsupported key encryption format or corrupted wrapped key');
  }
}
