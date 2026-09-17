import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orgId = session.organizationId;

    // 1. Total Documents
    const totalDocsRes = await query<{ count: string }>(
      'SELECT count(*) as count FROM documents WHERE organization_id = $1 AND status != $2',
      [orgId, 'DELETED']
    );

    // 2. Encrypted Document Versions
    const encDocsRes = await query<{ count: string }>(
      `SELECT count(dv.id) as count 
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       WHERE d.organization_id = $1`,
      [orgId]
    );

    // 3. Pending Maker-Checker Approvals
    const pendingApprovalsRes = await query<{ count: string }>(
      `SELECT count(cr.id) as count
       FROM change_requests cr
       JOIN documents d ON cr.document_id = d.id
       WHERE d.organization_id = $1 AND cr.status = 'PENDING'`,
      [orgId]
    );

    // 4. Audit Events
    const auditCountRes = await query<{ count: string }>(
      'SELECT count(*) as count FROM audit_events WHERE organization_id = $1',
      [orgId]
    );

    // 5. Total Storage in Bytes (sum of active document version sizes from PostgreSQL)
    const storageRes = await query<{ total_bytes: string }>(
      `SELECT COALESCE(SUM(dv.file_size), 0) as total_bytes
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       WHERE d.organization_id = $1 AND d.status != 'DELETED'`,
      [orgId]
    );
    const totalStorageBytes = parseInt(storageRes[0]?.total_bytes || '0', 10);
    const totalStorageQuotaBytes = 1000 * 1024 * 1024 * 1024; // 1,000 GB Quota
    const storageUsedPercentage = Math.round((totalStorageBytes / totalStorageQuotaBytes) * 10000) / 100;

    // 6. Department Storage Breakdown from PostgreSQL
    const deptStorageRes = await query<{
      department_id: string;
      department_name: string;
      department_code: string;
      doc_count: string;
      storage_bytes: string;
    }>(
      `SELECT 
         dep.id as department_id,
         dep.name as department_name,
         dep.code as department_code,
         COUNT(DISTINCT d.id) as doc_count,
         COALESCE(SUM(dv.file_size), 0) as storage_bytes
       FROM departments dep
       LEFT JOIN documents d ON dep.id = d.department_id AND d.status != 'DELETED'
       LEFT JOIN document_versions dv ON d.current_version_id = dv.id
       WHERE dep.organization_id = $1
       GROUP BY dep.id, dep.name, dep.code
       ORDER BY storage_bytes DESC, dep.name ASC`,
      [orgId]
    );

    const departmentStorage = deptStorageRes.map((ds) => {
      const bytes = parseInt(ds.storage_bytes || '0', 10);
      const percent = totalStorageBytes > 0 
        ? Math.round((bytes / totalStorageBytes) * 100) 
        : 0;
      return {
        departmentId: ds.department_id,
        name: ds.department_name,
        code: ds.department_code,
        docCount: parseInt(ds.doc_count || '0', 10),
        storageBytes: bytes,
        percent,
      };
    });

    // 7. Department-specific count
    let deptCount = '0';
    if (session.departmentId) {
      const deptDocsRes = await query<{ count: string }>(
        'SELECT count(*) as count FROM documents WHERE department_id = $1 AND status != $2',
        [session.departmentId, 'DELETED']
      );
      deptCount = deptDocsRes[0]?.count || '0';
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalDocuments: parseInt(totalDocsRes[0]?.count || '0', 10),
        encryptedDocuments: parseInt(encDocsRes[0]?.count || '0', 10),
        pendingApprovals: parseInt(pendingApprovalsRes[0]?.count || '0', 10),
        auditEventsCount: parseInt(auditCountRes[0]?.count || '0', 10),
        departmentDocuments: parseInt(deptCount, 10),
        totalStorageBytes,
        totalStorageQuotaBytes,
        storageUsedPercentage,
        departmentStorage,
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
