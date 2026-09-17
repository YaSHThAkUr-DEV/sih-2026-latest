import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth/jwt';
import { EnvelopeEncryptionService } from '@/lib/crypto/envelope';
import { getEncryptedObject } from '@/lib/storage/minio';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: docId } = await params;

    // 1. Check Session
    const cookieStore = await cookies();
    const token = cookieStore.get('dms_session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired session' }, { status: 401 });
    }

    // 2. Fetch Document & Version with Security Clearance check
    const rows = await query<any>(
      `SELECT 
         d.id, d.document_number, d.title, d.organization_id,
         sl.rank as security_rank, sl.code as security_tier, sl.name as security_tier_name,
         dv.id as version_id, dv.version_number, dv.file_name, dv.mime_type,
         dv.file_size, dv.sha256_hash, dv.encryption_algorithm,
         dv.vault_key_reference, dv.minio_bucket, dv.minio_object_key
       FROM documents d
       JOIN document_versions dv ON d.current_version_id = dv.id
       JOIN security_levels sl ON d.security_level_id = sl.id
       WHERE (d.id::text = $1 OR d.document_number = $1) AND d.organization_id = $2
       LIMIT 1;`,
      [docId, session.organizationId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Document not found or unauthorized' }, { status: 404 });
    }

    const doc = rows[0];

    // Enforce Security Clearance
    const isSuperAdminUser = (session.roles || []).includes('SUPER_ADMIN');
    const userClearance = isSuperAdminUser ? 5 : (session.maxSecurityLevel ?? 3);
    const requiredRank = Number(doc.security_rank || 1);

    if (userClearance < requiredRank) {
      return NextResponse.json(
        {
          error: `Security Clearance Violation: Your clearance level (Level ${userClearance}) is insufficient to access ${doc.security_tier} (${doc.security_tier_name}, Level ${requiredRank}) documents.`,
        },
        { status: 403 }
      );
    }

    // 3. Fetch Encrypted Blob from MinIO S3
    let encryptedBlob: Buffer;
    try {
      encryptedBlob = await getEncryptedObject(doc.minio_object_key);
    } catch (s3Err: any) {
      return NextResponse.json(
        {
          error: `MinIO Storage Access Error: ${s3Err.message}. Ensure MinIO container is running and port 9000 is open.`,
        },
        { status: 503 }
      );
    }

    // 4. Parse Envelope Keys & Decrypt with Vault Transit
    let decryptedPayload: Buffer;
    try {
      const vaultMeta = JSON.parse(doc.vault_key_reference || '{}');
      decryptedPayload = await EnvelopeEncryptionService.decryptDocument(
        encryptedBlob,
        vaultMeta.iv,
        vaultMeta.authTag,
        vaultMeta.wrappedDek,
        doc.document_number
      );
    } catch (cryptoErr: any) {
      return NextResponse.json(
        { error: `Cryptographic Decryption Failure: ${cryptoErr.message}` },
        { status: 500 }
      );
    }

    // 5. Audit Logging
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditEvent({
      organizationId: doc.organization_id,
      eventType: 'DOCUMENT_VIEWED',
      actorId: session.userId,
      resourceType: 'DOCUMENT',
      documentId: doc.id,
      documentVersionId: doc.version_id,
      ipAddress,
      result: 'SUCCESS',
      metadata: {
        documentNumber: doc.document_number,
        version: doc.version_number,
        action: 'STREAM_DECRYPTED',
      },
    });

    // 6. Return Clean Stream
    const download = req.nextUrl.searchParams.get('download') === 'true';
    const disposition = download ? 'attachment' : 'inline';

    return new NextResponse(new Uint8Array(decryptedPayload), {
      status: 200,
      headers: {
        'Content-Type': doc.mime_type || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(doc.file_name)}"`,
        'Content-Length': decryptedPayload.length.toString(),
        'X-DMS-Document-Number': doc.document_number,
        'X-DMS-SHA256': doc.sha256_hash,
      },
    });
  } catch (err: any) {
    console.error('[DOWNLOAD_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
