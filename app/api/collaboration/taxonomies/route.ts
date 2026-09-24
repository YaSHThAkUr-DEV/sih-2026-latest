import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/jwt';
import { query } from '@/lib/db';
import { isSuperAdmin, isAdmin } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const orgId = session.organizationId;

    // 1. Organization Tiers
    const tiers = await query(
      `SELECT id, code, name, description, hierarchy_level, badge_color, is_active, display_order
       FROM taxonomy_organization_tiers
       WHERE is_active = true
       ORDER BY display_order ASC, hierarchy_level ASC, name ASC`
    );

    // 2. Domain Categories
    const categories = await query(
      `SELECT id, code, name, description, icon_name, badge_color, custom_fields_schema, is_active, display_order
       FROM taxonomy_domain_categories
       WHERE is_active = true
       ORDER BY display_order ASC, name ASC`
    );

    // 3. Administrative Regions
    const regions = await query(
      `SELECT id, parent_id, region_type, code, name, state_code, is_active, display_order
       FROM taxonomy_jurisdiction_regions
       WHERE is_active = true
       ORDER BY display_order ASC, name ASC`
    );

    // 4. Statutory Grounds Templates (Global + Org Specific)
    const statutoryTemplates = await query(
      `SELECT st.id, st.organization_id, st.code, st.title, st.legal_act_name,
              st.section_citation, st.default_purpose_text, st.applicable_domain_category_id,
              st.applicable_doc_type_code, dc.name as domain_category_name
       FROM taxonomy_statutory_templates st
       LEFT JOIN taxonomy_domain_categories dc ON st.applicable_domain_category_id = dc.id
       WHERE st.is_active = true AND (st.organization_id IS NULL OR st.organization_id = $1)
       ORDER BY st.title ASC`,
      [orgId]
    );

    // 5. Urgency & Priority Tiers
    const priorityTiers = await query(
      `SELECT id, code, name, description, sla_hours, badge_color, requires_justification, is_active, display_order
       FROM taxonomy_priority_tiers
       WHERE is_active = true
       ORDER BY display_order ASC, sla_hours ASC`
    );

    // 6. Access Modes & Watermark Profiles
    const accessModes = await query(
      `SELECT id, code, name, description, allow_raw_download, allow_watermarked_pdf, allow_browser_view, requires_redaction_approval, is_active
       FROM taxonomy_access_modes
       WHERE is_active = true
       ORDER BY name ASC`
    );

    return NextResponse.json({
      success: true,
      taxonomies: {
        tiers,
        categories,
        regions,
        statutoryTemplates,
        priorityTiers,
        accessModes,
      },
    });
  } catch (error: any) {
    console.error('[COLLABORATION_TAXONOMIES_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to fetch collaboration taxonomies', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden: Admin clearance required' }, { status: 403 });
    }

    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data payload' }, { status: 400 });
    }

    if (type === 'statutory_template') {
      const { code, title, legalActName, sectionCitation, defaultPurposeText, domainCategoryId } = data;
      if (!code || !title || !legalActName || !sectionCitation) {
        return NextResponse.json({ error: 'Code, title, legalActName, and sectionCitation are required' }, { status: 400 });
      }

      const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const targetOrgId = isSuperAdmin(session) ? null : session.organizationId;

      const res = await query(
        `INSERT INTO taxonomy_statutory_templates (
           organization_id, code, title, legal_act_name, section_citation,
           default_purpose_text, applicable_domain_category_id, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *;`,
        [targetOrgId, cleanCode, title.trim(), legalActName.trim(), sectionCitation.trim(), defaultPurposeText || '', domainCategoryId || null]
      );

      return NextResponse.json({ success: true, item: res[0], message: 'Statutory template created successfully' });
    }

    if (type === 'priority_tier' && isSuperAdmin(session)) {
      const { code, name, slaHours, badgeColor, description, requiresJustification } = data;
      const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

      const res = await query(
        `INSERT INTO taxonomy_priority_tiers (code, name, sla_hours, badge_color, description, requires_justification, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING *;`,
        [cleanCode, name.trim(), Number(slaHours) || 24, badgeColor || '#3b82f6', description || '', Boolean(requiresJustification)]
      );

      return NextResponse.json({ success: true, item: res[0], message: 'Priority tier created successfully' });
    }

    return NextResponse.json({ error: 'Unsupported taxonomy type or insufficient permissions' }, { status: 400 });
  } catch (error: any) {
    console.error('[COLLABORATION_TAXONOMIES_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create taxonomy item', details: error.message },
      { status: 500 }
    );
  }
}
