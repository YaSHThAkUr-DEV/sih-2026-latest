import { Client } from 'pg';

async function migrateCollaboration() {
  console.log('--- Starting Additive Collaboration Schema Migration ---');
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'dms_db',
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. DYNAMIC TAXONOMIES: GOVERNMENT TIERS & DOMAIN CATEGORIES
    console.log('1. Creating Dynamic Taxonomy Tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS taxonomy_organization_tiers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        hierarchy_level INTEGER NOT NULL DEFAULT 1,
        badge_color VARCHAR(30) DEFAULT '#3b82f6',
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS taxonomy_domain_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        icon_name VARCHAR(60) DEFAULT 'corporate_fare',
        badge_color VARCHAR(30) DEFAULT '#6366f1',
        custom_fields_schema JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS taxonomy_jurisdiction_regions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID REFERENCES taxonomy_jurisdiction_regions(id) ON DELETE CASCADE,
        region_type VARCHAR(50) NOT NULL,
        code VARCHAR(60) NOT NULL,
        name VARCHAR(150) NOT NULL,
        state_code VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(region_type, code)
      );

      CREATE INDEX IF NOT EXISTS idx_jurisdiction_parent ON taxonomy_jurisdiction_regions(parent_id);
      CREATE INDEX IF NOT EXISTS idx_jurisdiction_state ON taxonomy_jurisdiction_regions(state_code);

      CREATE TABLE IF NOT EXISTS taxonomy_statutory_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        code VARCHAR(60) NOT NULL,
        title VARCHAR(200) NOT NULL,
        legal_act_name VARCHAR(200) NOT NULL,
        section_citation VARCHAR(100) NOT NULL,
        default_purpose_text TEXT,
        applicable_domain_category_id UUID REFERENCES taxonomy_domain_categories(id),
        applicable_doc_type_code VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_stat_templates_global_code 
        ON taxonomy_statutory_templates (code) WHERE organization_id IS NULL;

      CREATE TABLE IF NOT EXISTS taxonomy_priority_tiers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        sla_hours INTEGER NOT NULL DEFAULT 168,
        badge_color VARCHAR(30) DEFAULT '#eab308',
        requires_justification BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS taxonomy_access_modes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        allow_raw_download BOOLEAN DEFAULT false,
        allow_watermarked_pdf BOOLEAN DEFAULT true,
        allow_browser_view BOOLEAN DEFAULT true,
        requires_redaction_approval BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. SAFE EXTENSION OF ORGANIZATIONS & DOCUMENTS TABLES
    console.log('2. Safely Extending organizations & documents tables...');
    await client.query(`
      ALTER TABLE organizations 
        ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES taxonomy_organization_tiers(id),
        ADD COLUMN IF NOT EXISTS domain_category_id UUID REFERENCES taxonomy_domain_categories(id),
        ADD COLUMN IF NOT EXISTS jurisdiction_region_id UUID REFERENCES taxonomy_jurisdiction_regions(id),
        ADD COLUMN IF NOT EXISTS agency_code VARCHAR(60),
        ADD COLUMN IF NOT EXISTS nodal_officer_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS nodal_officer_email VARCHAR(200),
        ADD COLUMN IF NOT EXISTS nodal_officer_phone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS is_verified_federation_node BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS custom_metadata JSONB DEFAULT '{}';

      CREATE INDEX IF NOT EXISTS idx_org_taxonomies 
        ON organizations (tier_id, domain_category_id, jurisdiction_region_id);

      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'documents_org_doc_num_key'
        ) THEN
          ALTER TABLE documents ADD CONSTRAINT documents_org_doc_num_key UNIQUE (organization_id, document_number);
        END IF;
      END $$;
    `);

    // 3. INTER-ORGANIZATION REQUESTS & ACTIVE SHARES
    console.log('3. Creating Inter-Organization Exchange Tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS inter_org_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_number VARCHAR(64) UNIQUE NOT NULL,
        requesting_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        requesting_dept_id UUID REFERENCES departments(id),
        requesting_user_id UUID NOT NULL REFERENCES users(id),
        target_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        target_dept_id UUID REFERENCES departments(id),
        document_type_id UUID REFERENCES document_types(id),
        target_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
        statutory_template_id UUID REFERENCES taxonomy_statutory_templates(id),
        priority_tier_id UUID REFERENCES taxonomy_priority_tiers(id),
        reference_case_number VARCHAR(120),
        subject_title VARCHAR(255) NOT NULL,
        custom_statutory_purpose TEXT,
        custom_legal_provisions VARCHAR(255),
        requested_access_days INTEGER DEFAULT 7,
        sla_deadline TIMESTAMPTZ,
        status VARCHAR(40) DEFAULT 'PENDING',
        response_note TEXT,
        responded_by_user_id UUID REFERENCES users(id),
        responded_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE inter_org_requests ADD COLUMN IF NOT EXISTS target_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_inter_org_req_inbound ON inter_org_requests (target_org_id, status);
      CREATE INDEX IF NOT EXISTS idx_inter_org_req_outbound ON inter_org_requests (requesting_org_id, status);

      CREATE TABLE IF NOT EXISTS inter_org_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        share_number VARCHAR(64) UNIQUE NOT NULL,
        request_id UUID REFERENCES inter_org_requests(id) ON DELETE SET NULL,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
        document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE RESTRICT,
        source_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        target_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        authorized_user_id UUID REFERENCES users(id),
        access_mode_id UUID REFERENCES taxonomy_access_modes(id),
        is_watermarked BOOLEAN DEFAULT true,
        custom_watermark_template TEXT,
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        ephemeral_key_id VARCHAR(128),
        view_count INTEGER DEFAULT 0,
        download_count INTEGER DEFAULT 0,
        last_accessed_at TIMESTAMPTZ,
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        is_revoked BOOLEAN DEFAULT false,
        revoked_reason TEXT,
        revoked_by_user_id UUID REFERENCES users(id),
        revoked_at TIMESTAMPTZ,
        blockchain_tx_hash VARCHAR(128),
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inter_org_shares_target ON inter_org_shares (target_org_id, is_revoked, expires_at);
      CREATE INDEX IF NOT EXISTS idx_inter_org_shares_doc ON inter_org_shares (document_id);

      CREATE TABLE IF NOT EXISTS inter_org_workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_code VARCHAR(64) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        lead_org_id UUID NOT NULL REFERENCES organizations(id),
        lead_user_id UUID NOT NULL REFERENCES users(id),
        classification_level VARCHAR(20) DEFAULT 'CONFIDENTIAL',
        status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SEALED', 'ARCHIVED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inter_org_workspace_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES inter_org_workspaces(id) ON DELETE CASCADE,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        department_id UUID REFERENCES departments(id),
        user_id UUID REFERENCES users(id),
        role VARCHAR(30) DEFAULT 'COLLABORATOR' CHECK (role IN ('LEAD_OWNER', 'CONTRIBUTOR', 'VIEWER_AUDITOR')),
        invited_by UUID NOT NULL REFERENCES users(id),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id, org_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS inter_org_workspace_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES inter_org_workspaces(id) ON DELETE CASCADE,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
        document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE RESTRICT,
        contributed_by_org_id UUID NOT NULL REFERENCES organizations(id),
        contributed_by_user_id UUID NOT NULL REFERENCES users(id),
        notes TEXT,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(workspace_id, document_id)
      );

      CREATE TABLE IF NOT EXISTS inter_org_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        share_id UUID REFERENCES inter_org_shares(id) ON DELETE SET NULL,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        requesting_org_id UUID NOT NULL REFERENCES organizations(id),
        accessing_user_id UUID NOT NULL REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        watermark_payload_snapshot JSONB,
        event_hash VARCHAR(128) NOT NULL,
        blockchain_anchored BOOLEAN DEFAULT false,
        blockchain_tx_hash VARCHAR(128),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inter_org_logs_doc ON inter_org_access_logs (document_id, created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('✅ Additive Collaboration Schema Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

migrateCollaboration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
