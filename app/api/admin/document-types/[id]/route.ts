import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-guard';
import { query } from '@/lib/db';
import { logAuditEvent } from '@/lib/auth/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: docTypeId } = await params;

  try {
    const docType = await query(
      `SELECT dt.*, COUNT(d.id) as document_count
       FROM document_types dt
       LEFT JOIN documents d ON dt.id = d.document_type_id
       WHERE dt.id = $1 AND dt.organization_id = $2
       GROUP BY dt.id`,
      [docTypeId, session.organizationId]
    );

    if (docType.length === 0) {
      return NextResponse.json({ error: 'Document type not found.' }, { status: 404 });
    }

    return NextResponse.json({ documentType: docType[0] });
  } catch (err: any) {
    console.error('[ADMIN_GET_DOC_TYPE_BY_ID_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to retrieve document type.', details: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: docTypeId } = await params;

  try {
    const body = await req.json();
    const { name, code, description, active } = body;

    const existing = await query(
      `SELECT id, name, code FROM document_types WHERE id = $1 AND organization_id = $2`,
      [docTypeId, session.organizationId]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Document type not found.' }, { status: 404 });
    }

    const setClauses: string[] = [];
    const queryParams: any[] = [docTypeId, session.organizationId];

    if (name !== undefined) {
      queryParams.push(name.trim());
      setClauses.push(`name = $${queryParams.length}`);
    }
    if (code !== undefined) {
      const cleanCode = code.trim().toUpperCase();
      const dup = await query(
        `SELECT id FROM document_types WHERE code = $1 AND organization_id = $2 AND id != $3`,
        [cleanCode, session.organizationId, docTypeId]
      );
      if (dup.length > 0) {
        return NextResponse.json(
          { error: `Document type code "${cleanCode}" is already in use.` },
          { status: 409 }
        );
      }
      queryParams.push(cleanCode);
      setClauses.push(`code = $${queryParams.length}`);
    }
    if (description !== undefined) {
      queryParams.push(description?.trim() || null);
      setClauses.push(`description = $${queryParams.length}`);
    }
    if (active !== undefined) {
      queryParams.push(active);
      setClauses.push(`active = $${queryParams.length}`);
    }

    if (setClauses.length > 0) {
      await query(
        `UPDATE document_types SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2`,
        queryParams
      );
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_DOCUMENT_TYPE_UPDATED',
      actorId: session.userId,
      resourceType: 'DOCUMENT_TYPE',
      resourceId: docTypeId,
      result: 'SUCCESS',
      metadata: {
        docTypeId,
        changes: { name, code, description, active },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Document classification type updated successfully.',
    });
  } catch (err: any) {
    console.error('[ADMIN_UPDATE_DOC_TYPE_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to update document type.', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;
  const { id: docTypeId } = await params;

  try {
    // Check if any documents are actively classified under this type
    const activeDocs = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM documents WHERE document_type_id = $1 AND status != 'DELETED'`,
      [docTypeId]
    );

    if (parseInt(activeDocs[0]?.count || '0', 10) > 0) {
      return NextResponse.json(
        { error: `Cannot delete document type: ${activeDocs[0].count} documents are currently assigned to this classification.` },
        { status: 409 }
      );
    }

    // Delete mappings in department policies first
    await query(`DELETE FROM document_type_policies WHERE document_type_id = $1 AND organization_id = $2`, [
      docTypeId,
      session.organizationId,
    ]);

    await query(`DELETE FROM document_types WHERE id = $1 AND organization_id = $2`, [
      docTypeId,
      session.organizationId,
    ]);

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ADMIN_DOCUMENT_TYPE_DELETED',
      actorId: session.userId,
      resourceType: 'DOCUMENT_TYPE',
      resourceId: docTypeId,
      result: 'SUCCESS',
      metadata: { docTypeId },
    });

    return NextResponse.json({
      success: true,
      message: 'Document classification type deleted successfully.',
    });
  } catch (err: any) {
    console.error('[ADMIN_DELETE_DOC_TYPE_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to delete document type.', details: err.message },
      { status: 500 }
    );
  }
}

