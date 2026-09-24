import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';
import { getEncryptedObject, BUCKET_NAME } from '@/lib/storage/minio';
import { EnvelopeEncryptionService } from '@/lib/crypto/envelope';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const { id: shareId } = await params;
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'stream'; // 'stream' | 'info' | 'download'
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // 1. Fetch Share details with joined Document, Version, and Security Tier
    const shareQuery = `
      SELECT 
        shr.id,
        shr.share_number as "shareNumber",
        shr.source_org_id as "sourceOrgId",
        shr.target_org_id as "targetOrgId",
        shr.authorized_user_id as "authorizedUserId",
        shr.is_watermarked as "isWatermarked",
        shr.custom_watermark_template as "watermarkTemplate",
        shr.starts_at as "startsAt",
        shr.expires_at as "expiresAt",
        shr.is_revoked as "isRevoked",
        shr.revoked_reason as "revokedReason",
        shr.blockchain_tx_hash as "blockchainTx",
        
        -- Access Mode
        am.code as "accessModeCode",
        am.name as "accessModeName",
        am.allow_raw_download as "allowRawDownload",

        -- Document Metadata
        d.id as "documentId",
        d.document_number as "documentNumber",
        d.title as "documentTitle",
        d.description as "documentDescription",
        sl.code as "securityTierCode",
        sl.rank as "securityTierRank",
        sl.name as "securityTierName",

        -- Version & Storage Info
        dv.id as "versionId",
        dv.file_name as "fileName",
        dv.mime_type as "mimeType",
        dv.file_size as "fileSize",
        dv.sha256_hash as "sha256Hash",
        dv.encryption_algorithm as "encryptionAlgorithm",
        dv.vault_key_reference as "vaultKeyReference",
        dv.minio_bucket as "minioBucket",
        dv.minio_object_key as "minioObjectKey",

        -- Source Organization Info
        src_org.name as "sourceOrgName",
        src_org.code as "sourceOrgCode",
        src_org.agency_code as "sourceAgencyCode"

      FROM inter_org_shares shr
      JOIN taxonomy_access_modes am ON shr.access_mode_id = am.id
      JOIN documents d ON shr.document_id = d.id
      JOIN document_versions dv ON shr.document_version_id = dv.id
      JOIN security_levels sl ON d.security_level_id = sl.id
      JOIN organizations src_org ON shr.source_org_id = src_org.id
      WHERE shr.id = $1
    `;

    const shareResults = await query(shareQuery, [shareId]);

    if (shareResults.length === 0) {
      return NextResponse.json({ error: 'Shared document record not found or expired' }, { status: 404 });
    }

    const share = shareResults[0];

    // 2. ZERO-TRUST AUTHORIZATION & EXPIRATION VALIDATION
    const isSourceOrg = session.organizationId === share.sourceOrgId;
    const isTargetOrg = session.organizationId === share.targetOrgId;

    if (!isSourceOrg && !isTargetOrg) {
      return NextResponse.json(
        { error: 'Access Denied: Your organization is not authorized to inspect this shared record' },
        { status: 403 }
      );
    }

    if (share.isRevoked) {
      return NextResponse.json(
        { error: `Access Revoked: This share was revoked by the originating authority (${share.revokedReason || 'Security policy'})` },
        { status: 403 }
      );
    }

    const now = new Date();
    if (new Date(share.expiresAt) < now) {
      return NextResponse.json(
        { error: 'Access Expired: The authorized time window for this inter-agency document has elapsed' },
        { status: 403 }
      );
    }

    // Security Clearance Check on Caller
    const userClearance = session.maxSecurityLevel || 3;
    if (userClearance < Number(share.securityTierRank)) {
      return NextResponse.json(
        {
          error: `Clearance Violation: Document requires Level ${share.securityTierRank} (${share.securityTierCode}) clearance. Your account holds Level ${userClearance}.`,
        },
        { status: 403 }
      );
    }

    // If info mode requested, return metadata
    if (mode === 'info') {
      return NextResponse.json({
        success: true,
        share: {
          id: share.id,
          shareNumber: share.shareNumber,
          documentTitle: share.documentTitle,
          documentNumber: share.documentNumber,
          fileName: share.fileName,
          fileSize: share.fileSize,
          mimeType: share.mimeType,
          securityTier: share.securityTierCode,
          sourceOrgName: share.sourceOrgName,
          sourceOrgCode: share.sourceOrgCode,
          isWatermarked: share.isWatermarked,
          expiresAt: share.expiresAt,
          blockchainTx: share.blockchainTx,
          allowRawDownload: share.allowRawDownload,
        },
      });
    }

    // Raw download permission check
    if (mode === 'download' && !share.allowRawDownload && !isSourceOrg) {
      return NextResponse.json(
        { error: 'Download Restricted: This document is authorized for in-browser watermarked preview only' },
        { status: 403 }
      );
    }

    // 3. RETRIEVE & DECRYPT DOCUMENT BUFFER
    let rawBuffer: Buffer;
    try {
      const encryptedBuffer = await getEncryptedObject(share.minioObjectKey);
      const vaultMeta = JSON.parse(share.vaultKeyReference || '{}');
      
      rawBuffer = await EnvelopeEncryptionService.decryptDocument(
        encryptedBuffer,
        vaultMeta.iv || '',
        vaultMeta.authTag || '',
        vaultMeta.wrappedDek || '',
        share.documentNumber
      );
    } catch (decryptErr: any) {
      console.error('[COLLABORATION_DECRYPT_ERROR]', decryptErr);
      return NextResponse.json(
        { error: `Vault Decryption Failed: ${decryptErr.message || 'Unable to retrieve cryptographic payload'}` },
        { status: 500 }
      );
    }

    // 4. WATERMARK TEXT INTERPOLATION
    const timestampStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const watermarkText = `CONFIDENTIAL | ACCESSED BY: ${session.fullName} (${session.username.toUpperCase()}) | ${session.organizationName} | IP: ${ipAddress} | ${timestampStr} | TX: ${share.blockchainTx ? share.blockchainTx.substring(0, 16) + '...' : 'VERIFIED'}`;

    // 5. LOG ACCESS TO INTER-ORG ACCESS LOGS WITH SHA-256 EVENT HASH
    const accessEventHash = crypto
      .createHash('sha256')
      .update(`${share.id}:${session.userId}:${session.organizationId}:${ipAddress}:${Date.now()}`)
      .digest('hex');

    await query(
      `INSERT INTO inter_org_access_logs (
         share_id, document_id, requesting_org_id, accessing_user_id,
         action, ip_address, user_agent, watermark_payload_snapshot, event_hash
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [
        share.id,
        share.documentId,
        session.organizationId,
        session.userId,
        mode === 'download' ? 'DOWNLOAD_WATERMARKED' : 'VIEW_PREVIEW',
        ipAddress,
        userAgent,
        JSON.stringify({
          officerName: session.fullName,
          officerEmail: session.email,
          orgCode: session.organizationCode,
          watermarkText,
          timestamp: timestampStr,
        }),
        accessEventHash,
      ]
    );

    // Increment Access Counters
    if (mode === 'download') {
      await query(`UPDATE inter_org_shares SET download_count = download_count + 1, last_accessed_at = NOW() WHERE id = $1`, [share.id]);
    } else {
      await query(`UPDATE inter_org_shares SET view_count = view_count + 1, last_accessed_at = NOW() WHERE id = $1`, [share.id]);
    }

    // 6. LOG GENERAL TAMPER-EVIDENT AUDIT EVENT
    await logAuditEvent({
      organizationId: share.sourceOrgId,
      eventType: 'INTER_ORG_DOCUMENT_ACCESSED',
      actorId: session.userId,
      resourceType: 'FEDERATION_SHARE',
      resourceId: share.id,
      documentId: share.documentId,
      documentVersionId: share.versionId,
      ipAddress,
      userAgent,
      result: 'SUCCESS',
      metadata: {
        shareNumber: share.shareNumber,
        documentNumber: share.documentNumber,
        accessingOrgId: session.organizationId,
        accessingOrgName: session.organizationName,
        accessingUser: session.fullName,
        mode,
        accessEventHash,
      },
    });

    // 7. RETURN STREAM WITH STRICT SECURITY HEADERS
    const headers = new Headers();
    headers.set('Content-Type', share.mimeType || 'application/pdf');
    headers.set('Content-Length', String(rawBuffer.length));
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('X-DMS-Watermark-Text', encodeURIComponent(watermarkText));
    headers.set('X-DMS-Blockchain-Tx', share.blockchainTx || '0x0');
    headers.set('X-DMS-Access-Hash', accessEventHash);

    if (mode === 'download') {
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(share.fileName)}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(share.fileName)}"`);
    }

    return new NextResponse(new Uint8Array(rawBuffer), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('[COLLABORATION_STREAM_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to stream shared document', details: error.message },
      { status: 500 }
    );
  }
}
