import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { isSuperAdmin, isAdmin } from '@/lib/auth/rbac';
import { normalizeFeatures } from '@/lib/service/service-config-shared';
import { logAuditEvent } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Admin clearance required' }, { status: 403 });
    }

    const { id: orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // 1. Organization Details with Taxonomies
    const orgRes = await query(
      `
      SELECT 
        o.id,
        o.name,
        o.code,
        o.agency_code as "agencyCode",
        o.status,
        o.is_verified_federation_node as "isVerified",
        o.nodal_officer_name as "nodalOfficerName",
        o.nodal_officer_email as "nodalOfficerEmail",
        o.nodal_officer_phone as "nodalOfficerPhone",
        o.features,
        o.custom_metadata as "customMetadata",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        t.id as "tierId",
        t.name as "tierName",
        t.code as "tierCode",
        t.badge_color as "tierColor",
        c.id as "domainCategoryId",
        c.name as "categoryName",
        c.code as "categoryCode",
        c.icon_name as "categoryIcon",
        r.id as "jurisdictionRegionId",
        r.name as "regionName",
        r.code as "regionCode",
        r.state_code as "stateCode"
      FROM organizations o
      LEFT JOIN taxonomy_organization_tiers t ON o.tier_id = t.id
      LEFT JOIN taxonomy_domain_categories c ON o.domain_category_id = c.id
      LEFT JOIN taxonomy_jurisdiction_regions r ON o.jurisdiction_region_id = r.id
      WHERE o.id = $1
      `,
      [orgId]
    );

    if (orgRes.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const organization = orgRes[0];

    // 2. Departments under this Org
    const departments = await query(
      `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.status,
        d.created_at as "createdAt",
        p.name as "parentDepartmentName",
        (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.status = 'ACTIVE') as "memberCount",
        (SELECT COUNT(*)::int FROM documents doc WHERE doc.department_id = d.id AND doc.status = 'ACTIVE') as "documentCount"
      FROM departments d
      LEFT JOIN departments p ON d.parent_department_id = p.id
      WHERE d.organization_id = $1
      ORDER BY d.name ASC
      `,
      [orgId]
    );

    // 3. Users under this Org
    const users = await query(
      `
      SELECT 
        u.id,
        u.username,
        u.full_name as "fullName",
        u.email,
        u.employee_code as "employeeCode",
        u.designation,
        u.status,
        u.max_security_level as "maxSecurityLevel",
        u.last_login_at as "lastLoginAt",
        u.created_at as "createdAt",
        d.name as "departmentName",
        d.code as "departmentCode",
        COALESCE(
          json_agg(
            json_build_object(
              'id', r.id,
              'name', r.name,
              'code', r.code
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as roles
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.organization_id = $1
      GROUP BY u.id, d.name, d.code
      ORDER BY u.created_at ASC
      `,
      [orgId]
    );

    // 4. Documents in Org Vault
    const documents = await query(
      `
      SELECT 
        doc.id,
        doc.document_number as "documentNumber",
        doc.title,
        doc.description,
        doc.status,
        COALESCE(sl.code, 'T1') as "securityTier",
        COALESCE(dv.file_name, 'file.pdf') as "fileName",
        COALESCE(dv.file_size, 0) as "fileSize",
        COALESCE(dv.sha256_hash, '') as "sha256Hash",
        doc.created_at as "createdAt",
        dt.name as "documentTypeName",
        dt.code as "documentTypeCode",
        d.name as "departmentName",
        u.full_name as "ownerName"
      FROM documents doc
      LEFT JOIN document_types dt ON doc.document_type_id = dt.id
      LEFT JOIN security_levels sl ON doc.security_level_id = sl.id
      LEFT JOIN departments d ON doc.department_id = d.id
      LEFT JOIN users u ON (doc.owner_id = u.id OR doc.created_by = u.id)
      LEFT JOIN document_versions dv ON doc.current_version_id = dv.id
      WHERE doc.organization_id = $1
      ORDER BY doc.created_at DESC
      LIMIT 50
      `,
      [orgId]
    );

    // 5. Inbound and Outbound Requisitions
    const inboundRequests = await query(
      `
      SELECT 
        req.id,
        req.request_number as "requestNumber",
        req.subject_title as "purpose",
        req.status,
        COALESCE(pt.name, 'Standard') as "urgency",
        req.created_at as "createdAt",
        req.expires_at as "expiresAt",
        doc.document_number as "targetDocumentNumber",
        doc.title as "targetDocumentTitle",
        ro.name as "requestingOrgName",
        ro.code as "requestingOrgCode",
        u.full_name as "requesterOfficerName"
      FROM inter_org_requests req
      JOIN organizations ro ON req.requesting_org_id = ro.id
      LEFT JOIN users u ON req.requesting_user_id = u.id
      LEFT JOIN documents doc ON req.target_document_id = doc.id
      LEFT JOIN taxonomy_priority_tiers pt ON req.priority_tier_id = pt.id
      WHERE req.target_org_id = $1
      ORDER BY req.created_at DESC
      LIMIT 25
      `,
      [orgId]
    );

    const outboundRequests = await query(
      `
      SELECT 
        req.id,
        req.request_number as "requestNumber",
        req.subject_title as "purpose",
        req.status,
        COALESCE(pt.name, 'Standard') as "urgency",
        req.created_at as "createdAt",
        req.expires_at as "expiresAt",
        doc.document_number as "targetDocumentNumber",
        doc.title as "targetDocumentTitle",
        t_org.name as "targetOrgName",
        t_org.code as "targetOrgCode",
        u.full_name as "requesterOfficerName"
      FROM inter_org_requests req
      JOIN organizations t_org ON req.target_org_id = t_org.id
      LEFT JOIN users u ON req.requesting_user_id = u.id
      LEFT JOIN documents doc ON req.target_document_id = doc.id
      LEFT JOIN taxonomy_priority_tiers pt ON req.priority_tier_id = pt.id
      WHERE req.requesting_org_id = $1
      ORDER BY req.created_at DESC
      LIMIT 25
      `,
      [orgId]
    );

    // 6. Active Shares involving this Org
    const activeShares = await query(
      `
      SELECT 
        s.id,
        s.share_number as "shareToken",
        COALESCE(am.name, 'Watermarked Access') as "accessMode",
        s.is_revoked as "isRevoked",
        s.created_at as "createdAt",
        s.expires_at as "expiresAt",
        doc.document_number as "documentNumber",
        doc.title as "documentTitle",
        req_org.name as "grantedToOrgName",
        req_org.code as "grantedToOrgCode"
      FROM inter_org_shares s
      JOIN documents doc ON s.document_id = doc.id
      JOIN organizations req_org ON s.target_org_id = req_org.id
      LEFT JOIN taxonomy_access_modes am ON s.access_mode_id = am.id
      WHERE s.source_org_id = $1
      ORDER BY s.created_at DESC
      LIMIT 25
      `,
      [orgId]
    );

    // 7. Recent Audit Logs for this Org
    const auditLogs = await query(
      `
      SELECT 
        a.id,
        a.event_type as "eventType",
        a.result,
        a.created_at as "createdAt",
        a.ip_address as "ipAddress",
        a.resource_type as "resourceType",
        u.full_name as "actorName",
        u.designation as "actorDesignation"
      FROM audit_events a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE a.organization_id = $1
      ORDER BY a.created_at DESC
      LIMIT 25
      `,
      [orgId]
    );

    return NextResponse.json({
      success: true,
      organization,
      departments,
      users,
      documents,
      inboundRequests,
      outboundRequests,
      activeShares,
      auditLogs,
      counts: {
        departments: departments.length,
        users: users.length,
        documents: documents.length,
        inboundRequests: inboundRequests.length,
        outboundRequests: outboundRequests.length,
        activeShares: activeShares.length,
      },
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ADMIN_ORG_DETAILS_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve organization details', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Admin clearance required' }, { status: 403 });
    }

    const { id: orgId } = await params;
    const body = await req.json();

    const {
      name,
      code,
      agencyCode,
      status,
      isVerified,
      tierId,
      domainCategoryId,
      jurisdictionRegionId,
      nodalOfficerName,
      nodalOfficerEmail,
      nodalOfficerPhone,
      features,
      totalStorageQuotaBytes,
    } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name.trim());
    }
    if (code !== undefined) {
      updates.push(`code = $${paramIdx++}`);
      values.push(code.trim().toUpperCase());
    }
    if (agencyCode !== undefined) {
      updates.push(`agency_code = $${paramIdx++}`);
      values.push(agencyCode.trim().toUpperCase());
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(status);
    }
    if (isVerified !== undefined) {
      updates.push(`is_verified_federation_node = $${paramIdx++}`);
      values.push(Boolean(isVerified));
    }
    if (tierId !== undefined) {
      updates.push(`tier_id = $${paramIdx++}`);
      values.push(tierId || null);
    }
    if (domainCategoryId !== undefined) {
      updates.push(`domain_category_id = $${paramIdx++}`);
      values.push(domainCategoryId || null);
    }
    if (jurisdictionRegionId !== undefined) {
      updates.push(`jurisdiction_region_id = $${paramIdx++}`);
      values.push(jurisdictionRegionId || null);
    }
    if (nodalOfficerName !== undefined) {
      updates.push(`nodal_officer_name = $${paramIdx++}`);
      values.push(nodalOfficerName.trim());
    }
    if (nodalOfficerEmail !== undefined) {
      updates.push(`nodal_officer_email = $${paramIdx++}`);
      values.push(nodalOfficerEmail.trim().toLowerCase());
    }
    if (nodalOfficerPhone !== undefined) {
      updates.push(`nodal_officer_phone = $${paramIdx++}`);
      values.push(nodalOfficerPhone.trim());
    }
    if (totalStorageQuotaBytes !== undefined) {
      updates.push(`custom_metadata = jsonb_set(COALESCE(custom_metadata, '{}'::jsonb), '{total_storage_quota_bytes}', $${paramIdx++}::jsonb)`);
      values.push(JSON.stringify(Number(totalStorageQuotaBytes)));
    }
    if (features !== undefined) {
      const normalized = normalizeFeatures(features);
      updates.push(`features = $${paramIdx++}`);
      values.push(JSON.stringify(normalized));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(orgId);
    const updateSql = `
      UPDATE organizations
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIdx}
      RETURNING id, name, code, agency_code, status, is_verified_federation_node, features;
    `;

    const result = await query(updateSql, values);
    if (result.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      eventType: 'ORGANIZATION_UPDATED',
      actorId: session.userId,
      resourceType: 'ORGANIZATION',
      resourceId: orgId,
      result: 'SUCCESS',
      metadata: { targetOrgId: orgId, updatedFields: Object.keys(body) },
    });

    return NextResponse.json({
      success: true,
      message: `Organization "${result[0].name}" updated successfully`,
      organization: result[0],
    });
  } catch (error: any) {
    console.error('[COLLABORATION_ADMIN_ORG_UPDATE_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to update organization', details: error.message },
      { status: 500 }
    );
  }
}
