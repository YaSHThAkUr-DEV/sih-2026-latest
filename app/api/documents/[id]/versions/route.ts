import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { EnvelopeEncryptionService } from '@/lib/crypto/envelope';
import { putEncryptedObject, BUCKET_NAME } from '@/lib/storage/minio';
import { logAuditEvent } from '@/lib/auth/audit';
import { invalidateCache } from '@/lib/cache/redis';
import { OcrPipelineService } from '@/lib/ocr/pipeline';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const versions = await query<any>(
      `SELECT 
         dv.id as version_id,
         dv.document_id,
         dv.version_number,
         dv.status as version_status,
         (dv.id = d.current_version_id) as is_current,
         dv.file_name,
         dv.mime_type,
         dv.file_size,
         dv.sha256_hash,
         dv.encryption_algorithm,
         dv.checksum_verified,
         dv.created_at,
         u.full_name as creator_name,
         u.designation as creator_designation,
         cr.reason as change_reason,
         cr.status as approval_status,
         ocr.confidence as ocr_confidence,
         length(coalesce(ocr.extracted_text, '')) as ocr_char_count
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       JOIN users u ON dv.created_by = u.id
       LEFT JOIN change_requests cr ON dv.id = cr.proposed_version_id
       LEFT JOIN ocr_results ocr ON dv.id = ocr.document_version_id
       WHERE dv.document_id::text = $1 OR d.document_number = $1
       ORDER BY dv.version_number DESC;`,
      [id]
    );

    return NextResponse.json({
      success: true,
      documentId: id,
      totalVersions: versions.length,
      versions: versions.map((v) => ({
        versionId: v.version_id,
        versionNumber: v.version_number,
        versionStatus: v.version_status,
        isCurrent: v.is_current,
        fileName: v.file_name,
        mimeType: v.mime_type,
        fileSize: Number(v.file_size || 0),
        sha256Hash: v.sha256_hash,
        encryptionAlgorithm: v.encryption_algorithm,
        checksumVerified: v.checksum_verified,
        createdAt: v.created_at,
        creatorName: v.creator_name,
        creatorDesignation: v.creator_designation,
        changeReason: v.change_reason || null,
        approvalStatus: v.approval_status || null,
        ocrConfidence: v.ocr_confidence ? parseFloat(v.ocr_confidence) : null,
        ocrCharCount: Number(v.ocr_char_count || 0),
      })),
    });
  } catch (err: any) {
    console.error('[GET_VERSIONS_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch version history' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch document and security classification
    const docRows = await query<any>(
      `SELECT 
         d.id,
         d.document_number,
         d.title,
         d.organization_id,
         d.current_version_id,
         sl.code as security_tier,
         sl.name as security_tier_name
       FROM documents d
       JOIN security_levels sl ON d.security_level_id = sl.id
       WHERE d.id::text = $1 OR d.document_number = $1;`,
      [id]
    );

    if (!docRows || docRows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = docRows[0];

    // 2. Parse Multipart Form
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const reason = (formData.get('reason') as string | null) || 'Evidentiary revision update';

    if (!file) {
      return NextResponse.json({ error: 'Replacement file is required' }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    if (rawBuffer.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // 3. Envelope Encrypt with AES-256-GCM + Vault KMS
    const envelope = await EnvelopeEncryptionService.encryptDocument(
      rawBuffer,
      doc.document_number
    );

    // 4. Determine next version number
    const verNumRes = await query<{ next_ver: number }>(
      `SELECT coalesce(MAX(version_number), 0) + 1 as next_ver 
       FROM document_versions 
       WHERE document_id = $1;`,
      [id]
    );
    const nextVersionNumber = verNumRes[0].next_ver;

    // 5. Store Encrypted Object into MinIO S3
    const objectKey = `${doc.organization_id}/${doc.id}/v${nextVersionNumber}_${Date.now()}_${file.name}`;
    await putEncryptedObject(objectKey, envelope.encryptedPayload, {
      documentNumber: doc.document_number,
      version: nextVersionNumber.toString(),
      sha256: envelope.sha256Checksum,
    });

    const vaultRef = JSON.stringify({
      iv: envelope.iv,
      authTag: envelope.authTag,
      wrappedDek: envelope.wrappedDek,
      kmsProvider: envelope.kmsProvider,
    });

    const isSensitive = doc.security_tier === 'T4' || doc.security_tier === 'T5';

    if (isSensitive) {
      // 6A. High Classification (T4/T5): Quarantine as PENDING & Route to Maker-Checker
      const verInsert = await query<{ id: string }>(
        `INSERT INTO document_versions (
           document_id, version_number, status, is_current, created_by,
           file_name, mime_type, file_size, sha256_hash,
           encryption_algorithm, key_wrap_algorithm, vault_key_reference,
           minio_bucket, minio_object_key, checksum_verified
         )
         VALUES ($1, $2, 'PENDING', false, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
         RETURNING id;`,
        [
          id,
          nextVersionNumber,
          session.userId,
          file.name,
          file.type || 'application/octet-stream',
          rawBuffer.length,
          envelope.sha256Checksum,
          envelope.cipherAlgorithm.toUpperCase(),
          envelope.kmsProvider,
          vaultRef,
          BUCKET_NAME,
          objectKey,
        ]
      );
      const newVersionId = verInsert[0].id;

      // Create Maker-Checker change request
      await query(
        `INSERT INTO change_requests (
           document_id, original_version_id, proposed_version_id, requested_by, reason, status
         )
         VALUES ($1, $2, $3, $4, $5, 'PENDING');`,
        [id, doc.current_version_id, newVersionId, session.userId, reason]
      );

      // Audit Log
      await logAuditEvent({
        organizationId: doc.organization_id,
        eventType: 'CHANGE_REQUEST_CREATED',
        actorId: session.userId,
        resourceType: 'DOCUMENT',
        documentId: id,
        documentVersionId: newVersionId,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        result: 'SUCCESS',
        metadata: {
          documentNumber: doc.document_number,
          securityTier: doc.security_tier,
          proposedVersion: nextVersionNumber,
          reason,
          sha256: envelope.sha256Checksum,
        },
      });

      await invalidateCache('dms:dashboard:*');

      return NextResponse.json({
        success: true,
        requiresApproval: true,
        versionNumber: nextVersionNumber,
        versionId: newVersionId,
        message: `Version v${nextVersionNumber}.0 quarantined as PENDING. Requires Department Head Maker-Checker authorization under Section 65B rules.`,
      });
    } else {
      // 6B. Lower Classification (T1-T3): Direct Promotion
      // Archive previous version
      await query(
        `UPDATE document_versions 
         SET is_current = false, status = 'ARCHIVED' 
         WHERE document_id = $1 AND is_current = true;`,
        [id]
      );

      // Insert new version as ACTIVE
      const verInsert = await query<{ id: string }>(
        `INSERT INTO document_versions (
           document_id, version_number, status, is_current, created_by,
           file_name, mime_type, file_size, sha256_hash,
           encryption_algorithm, key_wrap_algorithm, vault_key_reference,
           minio_bucket, minio_object_key, checksum_verified
         )
         VALUES ($1, $2, 'ACTIVE', true, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
         RETURNING id;`,
        [
          id,
          nextVersionNumber,
          session.userId,
          file.name,
          file.type || 'application/octet-stream',
          rawBuffer.length,
          envelope.sha256Checksum,
          envelope.cipherAlgorithm.toUpperCase(),
          envelope.kmsProvider,
          vaultRef,
          BUCKET_NAME,
          objectKey,
        ]
      );
      const newVersionId = verInsert[0].id;

      // Update document's current version pointer
      await query(`UPDATE documents SET current_version_id = $1 WHERE id = $2;`, [newVersionId, id]);

      // Trigger background OCR extraction
      OcrPipelineService.processVersion(newVersionId, session.userId).catch((err) => {
        console.error(`[BACKGROUND_OCR_VERSION_ERR] v${nextVersionNumber}:`, err);
      });

      // Audit Log
      await logAuditEvent({
        organizationId: doc.organization_id,
        eventType: 'VERSION_CREATED',
        actorId: session.userId,
        resourceType: 'DOCUMENT',
        documentId: id,
        documentVersionId: newVersionId,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        result: 'SUCCESS',
        metadata: {
          documentNumber: doc.document_number,
          versionNumber: nextVersionNumber,
          reason,
          sha256: envelope.sha256Checksum,
        },
      });

      await invalidateCache('dms:dashboard:*');

      return NextResponse.json({
        success: true,
        requiresApproval: false,
        versionNumber: nextVersionNumber,
        versionId: newVersionId,
        message: `Version v${nextVersionNumber}.0 promoted to active court docket.`,
      });
    }
  } catch (err: any) {
    console.error('[POST_VERSION_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Failed to upload new revision' }, { status: 500 });
  }
}
