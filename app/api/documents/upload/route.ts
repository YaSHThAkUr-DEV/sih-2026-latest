import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth/jwt';
import { EnvelopeEncryptionService } from '@/lib/crypto/envelope';
import { putEncryptedObject, BUCKET_NAME } from '@/lib/storage/minio';
import { logAuditEvent } from '@/lib/auth/audit';
import { invalidateCache } from '@/lib/cache/redis';
import { JobQueueManager } from '@/lib/jobs/queue';
import { AutoJobRunner } from '@/lib/jobs/autoRunner';
import { OcrPipelineService } from '@/lib/ocr/pipeline';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('dms_session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired session' }, { status: 401 });
    }

    // RBAC: Check Document Creation Permission (Super Admin bypasses)
    const isSuperAdminUser = (session.roles || []).includes('SUPER_ADMIN');
    const canCreateDoc = isSuperAdminUser || (session.permissions || []).includes('DOCUMENT_CREATE');
    if (!canCreateDoc) {
      return NextResponse.json(
        { error: 'Access Denied: Your assigned role lacks the DOCUMENT_CREATE permission.' },
        { status: 403 }
      );
    }

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || '';
    const docTypeCode = (formData.get('docTypeCode') as string)?.trim() || 'OM';
    const deptCode = (formData.get('deptCode') as string)?.trim() || 'ADMIN';
    const secCode = (formData.get('secCode') as string)?.trim() || 'T2';
    let docNumber = (formData.get('documentNumber') as string)?.trim();

    if (!file) {
      return NextResponse.json({ error: 'Missing document payload: file is required' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Document title is required' }, { status: 400 });
    }

    // 3. Auto-generate Document Number if not supplied
    if (!docNumber) {
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      docNumber = `DOC-${docTypeCode.substring(0, 4).toUpperCase()}-2026-${randomSeq}`;
    }

    // 4. Resolve Database Foreign Keys
    const orgId = session.organizationId;

    // Resolve doc type
    const docTypeRes = await query<{ id: string }>(
      'SELECT id FROM document_types WHERE (code = $1 OR code = $2) AND organization_id = $3 LIMIT 1',
      [docTypeCode, 'OM', orgId]
    );
    const docTypeId = docTypeRes[0]?.id;

    // Resolve department
    const deptRes = await query<{ id: string }>(
      'SELECT id FROM departments WHERE (code = $1 OR code = $2) AND organization_id = $3 LIMIT 1',
      [deptCode, 'ADMIN', orgId]
    );
    const deptId = deptRes[0]?.id;

    // Resolve security tier & rank fallback
    const secRes = await query<{ id: string; rank: number; code: string; name: string }>(
      'SELECT id, rank, code, name FROM security_levels WHERE (code = $1 OR code = $2) AND organization_id = $3 LIMIT 1',
      [secCode, 'T2', orgId]
    );
    const secRecord = secRes[0];
    const secId = secRecord?.id;

    if (!docTypeId || !deptId || !secId) {
      return NextResponse.json({ error: 'Failed to resolve organization taxonomies (Dept/Type/Security Tier)' }, { status: 400 });
    }

    // 4b. Query Active Institutional Governance Policy for (department, document_type)
    const policyRes = await query<{
      id: string;
      security_level_id: string;
      security_level_rank: number;
      security_level_code: string;
      security_level_name: string;
      retention_policy_id: string;
      retention_days: number | null;
      retention_permanent: boolean;
      approval_required: boolean;
      ocr_required: boolean;
      download_allowed: boolean;
    }>(
      `SELECT 
         dtp.id,
         dtp.security_level_id,
         sl.rank as security_level_rank,
         sl.code as security_level_code,
         sl.name as security_level_name,
         dtp.retention_policy_id,
         rp.retention_days,
         rp.permanent as retention_permanent,
         dtp.approval_required,
         dtp.ocr_required,
         dtp.download_allowed
       FROM document_type_policies dtp
       JOIN security_levels sl ON dtp.security_level_id = sl.id
       JOIN retention_policies rp ON dtp.retention_policy_id = rp.id
       WHERE dtp.organization_id = $1 
         AND dtp.department_id = $2 
         AND dtp.document_type_id = $3 
         AND dtp.active = true
       LIMIT 1`,
      [orgId, deptId, docTypeId]
    );

    const activePolicy = policyRes[0] || null;
    const finalSecId = activePolicy ? activePolicy.security_level_id : secId;
    const finalSecRank = activePolicy ? Number(activePolicy.security_level_rank) : Number(secRecord.rank || 1);
    const finalSecCode = activePolicy ? activePolicy.security_level_code : secRecord.code;
    const isApprovalRequired = activePolicy ? activePolicy.approval_required : false;
    const isOcrRequired = activePolicy ? (activePolicy.ocr_required !== false) : true;
    const initialStatus = isApprovalRequired ? 'PENDING_APPROVAL' : 'ACTIVE';

    // Security Level Clearance Enforcement:
    const userClearance = isSuperAdminUser ? 5 : (session.maxSecurityLevel ?? 3);

    if (userClearance < finalSecRank) {
      return NextResponse.json(
        {
          error: `Security Clearance Violation: Your clearance level (Level ${userClearance}) is insufficient to upload documents into ${finalSecCode} (Level ${finalSecRank}).`,
        },
        { status: 403 }
      );
    }

    // 5. Read File Buffer
    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    // Max 25MB check
    if (rawBuffer.length > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 25MB statutory maximum upload size' }, { status: 400 });
    }

    // 6. Cryptographic Envelope Encryption (AES-256-GCM + HashiCorp Vault DEK)
    const envelope = await EnvelopeEncryptionService.encryptDocument(rawBuffer, docNumber);

    // 7. Generate Object Key and Upload to MinIO S3
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `documents/${docNumber}/v1_${Date.now()}_${sanitizedFileName}.enc`;

    let minioSuccess = false;
    let minioError: string | null = null;
    try {
      await putEncryptedObject(objectKey, envelope.encryptedPayload, {
        'x-dms-doc-number': docNumber,
        'x-dms-sha256': envelope.sha256Checksum,
        'x-dms-kms-provider': envelope.kmsProvider,
        'x-dms-algo': envelope.cipherAlgorithm,
      });
      minioSuccess = true;
    } catch (err: any) {
      minioError = err.message;
      console.warn('[MINIO_WARN] Direct S3 store deferred:', err.message);
    }

    // 8. Insert Records into PostgreSQL (Documents & Document Versions)
    const docInsert = await query<{ id: string }>(
      `INSERT INTO documents (
         organization_id, document_number, title, description,
         document_type_id, department_id, security_level_id,
         owner_id, status, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id;`,
      [orgId, docNumber, title, description, docTypeId, deptId, finalSecId, session.userId, initialStatus, session.userId]
    );

    const docId = docInsert[0].id;

    // Vault key reference metadata json
    const vaultRef = JSON.stringify({
      iv: envelope.iv,
      authTag: envelope.authTag,
      wrappedDek: envelope.wrappedDek,
      kmsProvider: envelope.kmsProvider,
    });

    const verInsert = await query<{ id: string }>(
      `INSERT INTO document_versions (
         document_id, version_number, status, created_by,
         file_name, mime_type, file_size, sha256_hash,
         encryption_algorithm, key_wrap_algorithm, vault_key_reference,
         minio_bucket, minio_object_key, checksum_verified
       )
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
       RETURNING id;`,
      [
        docId,
        initialStatus,
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

    const verId = verInsert[0].id;

    // Set current version pointer
    await query('UPDATE documents SET current_version_id = $1 WHERE id = $2', [verId, docId]);

    // 9. Tamper-Evident Audit Event
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditEvent({
      organizationId: orgId,
      eventType: isApprovalRequired ? 'DOCUMENT_SUBMITTED_FOR_APPROVAL' : 'DOCUMENT_UPLOADED',
      actorId: session.userId,
      resourceType: 'DOCUMENT',
      documentId: docId,
      documentVersionId: verId,
      ipAddress,
      result: 'SUCCESS',
      metadata: {
        documentNumber: docNumber,
        title,
        tier: finalSecCode,
        status: initialStatus,
        policyApplied: !!activePolicy,
        policyId: activePolicy?.id,
        approvalRequired: isApprovalRequired,
        fileSize: rawBuffer.length,
        sha256: envelope.sha256Checksum,
        kmsProvider: envelope.kmsProvider,
        minioBucket: BUCKET_NAME,
        minioObjectKey: objectKey,
        minioSynced: minioSuccess,
      },
    });

    // 9b. Initialize Statutory Retention Record for the document
    try {
      if (activePolicy && activePolicy.retention_policy_id) {
        if (activePolicy.retention_permanent) {
          await query(
            `INSERT INTO retention_records 
             (document_id, retention_policy_id, retention_start_at, retention_end_at, legal_hold, status, created_at)
             VALUES ($1, $2, NOW(), NULL, false, 'ACTIVE', NOW())
             ON CONFLICT DO NOTHING`,
            [docId, activePolicy.retention_policy_id]
          );
        } else {
          const days = activePolicy.retention_days || 2555;
          await query(
            `INSERT INTO retention_records 
             (document_id, retention_policy_id, retention_start_at, retention_end_at, legal_hold, status, created_at)
             VALUES ($1, $2, NOW(), NOW() + ($3 || ' days')::INTERVAL, false, 'ACTIVE', NOW())
             ON CONFLICT DO NOTHING`,
            [docId, activePolicy.retention_policy_id, days]
          );
        }
      } else {
        const defaultPolicy = await query<{ id: string; retention_days: number }>(
          `SELECT id, retention_days FROM retention_policies WHERE organization_id = $1 ORDER BY retention_days ASC LIMIT 1`,
          [orgId]
        );
        if (defaultPolicy.length > 0) {
          const days = defaultPolicy[0].retention_days || 2555;
          await query(
            `INSERT INTO retention_records 
             (document_id, retention_policy_id, retention_start_at, retention_end_at, legal_hold, status, created_at)
             VALUES ($1, $2, NOW(), NOW() + ($3 || ' days')::INTERVAL, false, 'ACTIVE', NOW())
             ON CONFLICT DO NOTHING`,
            [docId, defaultPolicy[0].id, days]
          );
        }
      }
    } catch (retErr: any) {
      console.warn('[RETENTION_ATTACH_WARN]', retErr.message);
    }

    // 9c. Maker-Checker Notification: Notify Department Heads if approval is required
    if (isApprovalRequired) {
      try {
        const { sendRoleNotification } = await import('@/lib/notifications/service');
        await sendRoleNotification('DEPT_HEAD', {
          type: 'APPROVAL_REQUEST',
          title: 'Document Pending Verification',
          message: `Officer ${session.fullName || session.username} uploaded ${docNumber} ("${title}") requiring Maker-Checker sign-off.`,
          resourceType: 'DOCUMENT',
          resourceId: docId,
          severity: 'WARNING',
          metadata: {
            documentId: docId,
            documentNumber: docNumber,
            departmentId: deptId,
            policyId: activePolicy?.id,
          },
        });
      } catch (notifErr: any) {
        console.warn('[NOTIF_WARN] Approval notification deferred:', notifErr.message);
      }
    }

    // 10. Invalidate Redis Caches
    await invalidateCache('dms:dashboard:*');

    // 11. Enqueue & Execute OCR Processing in Background (if OCR enabled by policy)
    if (isOcrRequired) {
      await JobQueueManager.enqueue(
        'ocr-queue',
        'OCR_EXTRACTION',
        {
          documentVersionId: verId,
          actorId: session.userId,
          documentNumber: docNumber,
        },
        { documentVersionId: verId }
      );

      // Run direct background OCR extraction to immediately index text & GIN vector
      OcrPipelineService.processVersion(verId, session.userId).catch((err) => {
        console.warn(`[OCR] Direct background processing for version ${verId}:`, err.message);
      });
    }

    // 12. Enqueue Blockchain Hash Anchoring (Module 21 — Hyperledger Fabric Integrity)
    // Anchors immediate hash record for tamper-evident provenance
    try {
      // Fetch the audit event ID we just created
      const auditRows = await query<{ id: string }>(
        `SELECT id FROM audit_events
         WHERE document_id = $1
         ORDER BY created_at DESC LIMIT 1;`,
        [docId]
      );
      if (auditRows.length > 0) {
        await JobQueueManager.enqueue(
          'blockchain-queue',
          'BLOCKCHAIN_ANCHOR',
          {
            auditEventId: auditRows[0].id,
            payloadHash: envelope.sha256Checksum,
            documentId: docId,
            eventType: 'DOCUMENT_UPLOAD',
            actorId: session.userId,
            organizationId: orgId,
            metadata: { documentNumber: docNumber, title, tier: finalSecCode, status: initialStatus },
          }
        );
      }
    } catch (bcErr: any) {
      // Non-blocking — blockchain anchoring failure should not block upload
      console.warn('[BLOCKCHAIN_ENQUEUE_WARN] Upload anchor deferred:', bcErr.message);
    }

    // 13. Trigger instant background job runner across all queues
    try {
      AutoJobRunner.trigger();
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: 'Evidence document securely encrypted and registered in ledger.',
      document: {
        id: docId,
        documentNumber: docNumber,
        title,
        versionId: verId,
        versionNumber: 1,
        sha256Hash: envelope.sha256Checksum,
        kmsProvider: envelope.kmsProvider,
        encryptionAlgorithm: envelope.cipherAlgorithm,
        minioBucket: BUCKET_NAME,
        minioObjectKey: objectKey,
        minioSynced: minioSuccess,
        minioWarning: minioError ? `MinIO offline (${minioError}) - metadata preserved` : undefined,
        fileSize: rawBuffer.length,
        fileName: file.name,
      },
    });
  } catch (err: any) {
    console.error('[UPLOAD_ERROR]', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error during document encryption and upload' },
      { status: 500 }
    );
  }
}
