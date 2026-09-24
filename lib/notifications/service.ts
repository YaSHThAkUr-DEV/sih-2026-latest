import { query } from '@/lib/db';

export interface CreateNotificationParams {
  userId: string;
  type: 'APPROVAL_REQUEST' | 'APPROVAL_DECISION' | 'OCR_COMPLETE' | 'LEGAL_HOLD' | 'RETENTION_EXPIRY' | 'SECURITY_ALERT' | 'AUDIT_ATTESTATION' | 'BLOCKCHAIN_ANCHOR';
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'SUCCESS' | 'INFO';
  metadata?: Record<string, any>;
}

export async function sendNotification(params: CreateNotificationParams): Promise<string> {
  const {
    userId,
    type,
    title,
    message,
    resourceType = 'DOCUMENT',
    resourceId = null,
    severity = 'INFO',
    metadata = {},
  } = params;

  try {
    const res = await query<{ id: string }>(
      `INSERT INTO notifications 
       (user_id, type, title, message, resource_type, resource_id, severity, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING id`,
      [userId, type, title, message, resourceType, resourceId, severity, JSON.stringify(metadata)]
    );

    return res[0]?.id;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

export async function sendRoleNotification(
  roleCode: string,
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<number> {
  try {
    const users = await query<{ id: string }>(
      `SELECT u.id 
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.code = $1`,
      [roleCode]
    );

    for (const u of users) {
      await sendNotification({ ...params, userId: u.id });
    }
    return users.length;
  } catch (error) {
    console.error(`Failed to send notification to role ${roleCode}:`, error);
    return 0;
  }
}

export async function sendBroadcastNotification(
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<number> {
  try {
    const users = await query<{ id: string }>('SELECT id FROM users WHERE status = $1', ['ACTIVE']);
    for (const u of users) {
      await sendNotification({ ...params, userId: u.id });
    }
    return users.length;
  } catch (error) {
    console.error('Failed to broadcast notification:', error);
    return 0;
  }
}
