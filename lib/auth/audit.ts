import { query } from '@/lib/db';
import crypto from 'crypto';

export interface AuditLogParams {
  organizationId: string;
  eventType: string;
  actorId?: string | null;
  resourceType?: string;
  resourceId?: string;
  documentId?: string;
  documentVersionId?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  failureReason?: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent(params: AuditLogParams): Promise<string> {
  const metadataJson = JSON.stringify(params.metadata || {});

  // Compute a SHA-256 event hash for tamper-evidence
  const hashPayload = `${params.organizationId}:${params.eventType}:${params.actorId || 'anon'}:${params.result}:${Date.now()}:${metadataJson}`;
  const eventHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  // Parse IP address to ensure valid INET or null
  const validIp = params.ipAddress && params.ipAddress !== 'unknown' && params.ipAddress !== '::1' ? params.ipAddress : '127.0.0.1';

  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO audit_events (
         organization_id, event_type, actor_id, resource_type, resource_id,
         document_id, document_version_id, request_id, session_id,
         ip_address, user_agent, result, failure_reason, event_metadata, event_hash
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id;`,
      [
        params.organizationId,
        params.eventType,
        params.actorId || null,
        params.resourceType || 'AUTH',
        params.resourceId || null,
        params.documentId || null,
        params.documentVersionId || null,
        params.requestId || null,
        params.sessionId || null,
        validIp,
        params.userAgent || null,
        params.result,
        params.failureReason || null,
        metadataJson,
        eventHash,
      ]
    );

    return rows[0]?.id;
  } catch (err) {
    console.error('[AUDIT_LOG_ERROR] Failed to write audit event:', err);
    // Return empty string but don't break main business flow
    return '';
  }
}
