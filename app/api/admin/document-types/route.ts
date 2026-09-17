import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const documentTypes = await query(
      `SELECT 
         dt.id,
         dt.name,
         dt.code,
         dt.description,
         dt.active,
         dt.created_at,
         COUNT(d.id) as document_count,
         COUNT(DISTINCT dtp.department_id) as assigned_departments_count
       FROM document_types dt
       LEFT JOIN documents d ON dt.id = d.document_type_id AND d.status != 'DELETED'
       LEFT JOIN document_type_policies dtp ON dt.id = dtp.document_type_id AND dtp.active = true
       WHERE dt.organization_id = $1
       GROUP BY dt.id
       ORDER BY dt.name ASC`,
      [session.organizationId]
    );

    return NextResponse.json({ documentTypes });
  } catch (err: any) {
    console.error('[ADMIN_GET_DOC_TYPES_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve document types.', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  try {
    const body = await req.json();
    const { name, code, description, active = true } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Document type name and unique classification code are required.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // Check duplicate code
    const existing = await query(
      `SELECT id FROM document_types WHERE code = $1 AND organization_id = $2`,
      [cleanCode, session.organizationId]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Document type code "${cleanCode}" already exists.` },
        { status: 409 }
      );
    }

    const newType = await query<{ id: string }>(
      `INSERT INTO document_types (organization_id, name, code, description, active, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id;`,
      [session.organizationId, name.trim(), cleanCode, description?.trim() || null, active]
    );

    const docTypeId = newType[0].id;

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_DOCUMENT_TYPE_CREATED',
      actorId: session.userId,
      resourceType: 'DOCUMENT_TYPE',
      resourceId: docTypeId,
      result: 'SUCCESS',
      metadata: {
        docTypeId,
        name,
        code: cleanCode,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Document classification type created.', docTypeId },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[ADMIN_CREATE_DOC_TYPE_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to create document type.', details: err.message },
      { status: 500 }
    );
  }
}
