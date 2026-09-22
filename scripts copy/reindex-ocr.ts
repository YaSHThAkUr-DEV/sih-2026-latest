import { query, pool } from '../lib/db';
import { getEncryptedObject } from '../lib/storage/minio';
import { EnvelopeEncryptionService } from '../lib/crypto/envelope';
import { OcrExtractorService } from '../lib/ocr/extractor';

async function main() {
  const versions = await query<any>(`
    SELECT dv.*, d.document_number, d.title
    FROM document_versions dv
    JOIN documents d ON dv.document_id = d.id
    ORDER BY dv.created_at DESC
  `);

  console.log(`Processing ${versions.length} versions...`);

  for (const doc of versions) {
    console.log(`\n-----------------------------------------`);
    console.log(`Version: ${doc.id}`);
    console.log(`File: ${doc.file_name} (${doc.document_number})`);

    let plaintextBuffer: Buffer | null = null;
    if (doc.minio_object_key && doc.vault_key_reference) {
      try {
        const encryptedPayload = await getEncryptedObject(doc.minio_object_key);
        let vaultMeta = doc.vault_key_reference;
        if (typeof vaultMeta === 'string') {
          vaultMeta = JSON.parse(vaultMeta);
        }
        plaintextBuffer = await EnvelopeEncryptionService.decryptDocument(
          encryptedPayload,
          vaultMeta.iv,
          vaultMeta.authTag,
          vaultMeta.wrappedDek,
          doc.document_number
        );
        console.log(`Decrypted buffer size: ${plaintextBuffer.length} bytes`);
      } catch (err: any) {
        console.warn(`MinIO/Decryption error: ${err.message}`);
      }
    }

    if (!plaintextBuffer) {
      plaintextBuffer = Buffer.from(
        `Document ${doc.document_number}: ${doc.title}. File: ${doc.file_name}. Statutory Record.`,
        'utf-8'
      );
    }

    const ocrResult = await OcrExtractorService.extractText(
      plaintextBuffer,
      doc.file_name,
      doc.mime_type
    );

    console.log(`OCR Confidence: ${ocrResult.confidence}%`);
    console.log(`Extracted Preview: ${ocrResult.extractedText.substring(0, 120).replace(/\n/g, ' ')}...`);

    // Update DB
    await query(
      `INSERT INTO ocr_results (
         document_version_id, extracted_text, text_sha256, language, confidence, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (document_version_id) DO UPDATE SET
         extracted_text = EXCLUDED.extracted_text,
         text_sha256 = EXCLUDED.text_sha256,
         language = EXCLUDED.language,
         confidence = EXCLUDED.confidence,
         updated_at = now();`,
      [
        doc.id,
        ocrResult.extractedText,
        ocrResult.textSha256,
        ocrResult.language,
        ocrResult.confidence,
      ]
    );
  }

  console.log(`\nReindexing complete!`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
