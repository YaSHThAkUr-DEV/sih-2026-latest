import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function seedCollaboration() {
  console.log('--- Seeding Dynamic Taxonomies & Multi-Organization Fleet ---');
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

    // =========================================================================
    // 1. DYNAMIC TAXONOMIES: GOVERNMENT TIERS
    // =========================================================================
    console.log('1. Seeding Dynamic Government Tiers...');
    const tiers = [
      { code: 'CENTRAL_GOV', name: 'Central Government Ministry / Apex Body', level: 1, color: '#3b82f6', desc: 'Federal ministries, departments, and apex statutory institutions' },
      { code: 'STATE_GOV', name: 'State Government Directorate / Secretariat', level: 2, color: '#6366f1', desc: 'State secretariats, directorates, and divisional commissionerates' },
      { code: 'UT_ADMIN', name: 'Union Territory Administration', level: 2, color: '#8b5cf6', desc: 'Administrations of Union Territories' },
      { code: 'LOCAL_BODY', name: 'Municipal Corporation / Civic Authority', level: 3, color: '#10b981', desc: 'Urban local bodies, municipal councils, and panchayati raj institutions' },
      { code: 'AUTONOMOUS_PSU', name: 'Autonomous Body / Public Sector Undertaking', level: 2, color: '#f59e0b', desc: 'Public sector corporations, statutory authorities, and research labs' },
    ];

    const tierMap: Record<string, string> = {};
    for (const t of tiers) {
      const res = await client.query(
        `INSERT INTO taxonomy_organization_tiers (code, name, description, hierarchy_level, badge_color)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, badge_color = EXCLUDED.badge_color
         RETURNING id, code;`,
        [t.code, t.name, t.desc, t.level, t.color]
      );
      tierMap[res.rows[0].code] = res.rows[0].id;
    }

    // =========================================================================
    // 2. DYNAMIC DOMAIN CATEGORIES
    // =========================================================================
    console.log('2. Seeding Dynamic Domain Categories...');
    const categories = [
      { code: 'JUDICIARY', name: 'Judiciary & Courts', icon: 'gavel', color: '#8b5cf6', desc: 'Supreme Court, High Courts, District & Sessions Courts, Tribunals' },
      { code: 'LAW_ENFORCEMENT', name: 'Law Enforcement & Police', icon: 'local_police', color: '#ef4444', desc: 'State Police, Special Investigation Cells, Anti-Terror Squads, CBI, ED' },
      { code: 'REVENUE_TAXATION', name: 'Revenue, Land & Taxation', icon: 'account_balance', color: '#10b981', desc: 'Land records, stamp & registration, income tax, GST directorates' },
      { code: 'CIVIL_ADMIN', name: 'Civil Administration & Governance', icon: 'corporate_fare', color: '#3b82f6', desc: 'District Collectorates, General Administration, Secretariats' },
      { code: 'HEALTHCARE', name: 'Public Health & Medical Directorates', icon: 'health_and_safety', color: '#ec4899', desc: 'AIIMS, State Health Directorates, Drug Control Administration' },
      { code: 'FORENSIC_LAB', name: 'Forensic Science Laboratories (FSL)', icon: 'biotech', color: '#06b6d4', desc: 'Central & State Forensic Laboratories, Cyber Forensics' },
      { code: 'REGULATORY', name: 'Regulatory & Vigilance Commissions', icon: 'policy', color: '#f59e0b', desc: 'Central Vigilance Commission, Lokayukta, Competition Commission' },
    ];

    const catMap: Record<string, string> = {};
    for (const c of categories) {
      const res = await client.query(
        `INSERT INTO taxonomy_domain_categories (code, name, icon_name, badge_color, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, icon_name = EXCLUDED.icon_name, badge_color = EXCLUDED.badge_color
         RETURNING id, code;`,
        [c.code, c.name, c.icon, c.color, c.desc]
      );
      catMap[res.rows[0].code] = res.rows[0].id;
    }

    // =========================================================================
    // 3. DYNAMIC JURISDICTION REGIONS
    // =========================================================================
    console.log('3. Seeding Dynamic Administrative Regions...');
    const regions = [
      { type: 'COUNTRY', code: 'IND', name: 'Republic of India', stateCode: null, parentCode: null },
      { type: 'STATE', code: 'IND_MH', name: 'Maharashtra', stateCode: 'MH', parentCode: 'IND' },
      { type: 'STATE', code: 'IND_DL', name: 'National Capital Territory of Delhi', stateCode: 'DL', parentCode: 'IND' },
      { type: 'STATE', code: 'IND_GJ', name: 'Gujarat', stateCode: 'GJ', parentCode: 'IND' },
      { type: 'STATE', code: 'IND_KA', name: 'Karnataka', stateCode: 'KA', parentCode: 'IND' },
      { type: 'DISTRICT', code: 'IND_MH_MUM', name: 'Mumbai City & Suburban', stateCode: 'MH', parentCode: 'IND_MH' },
      { type: 'DISTRICT', code: 'IND_DL_NZ', name: 'New Delhi / Central Delhi Range', stateCode: 'DL', parentCode: 'IND_DL' },
      { type: 'DISTRICT', code: 'IND_GJ_AMD', name: 'Ahmedabad District', stateCode: 'GJ', parentCode: 'IND_GJ' },
    ];

    const regionMap: Record<string, string> = {};
    for (const r of regions) {
      const parentId = r.parentCode ? regionMap[r.parentCode] || null : null;
      const res = await client.query(
        `INSERT INTO taxonomy_jurisdiction_regions (parent_id, region_type, code, name, state_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (region_type, code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id
         RETURNING id, code;`,
        [parentId, r.type, r.code, r.name, r.stateCode]
      );
      regionMap[res.rows[0].code] = res.rows[0].id;
    }

    // =========================================================================
    // 4. DYNAMIC STATUTORY GROUNDS & LEGAL PROVISIONS
    // =========================================================================
    console.log('4. Seeding Dynamic Statutory Grounds Templates...');
    const statutoryTemplates = [
      { code: 'CRPC_91', title: 'Requisition for Document Production', act: 'Code of Criminal Procedure (Cr.P.C.)', sec: 'Section 91', purpose: 'Summons to produce document or other thing necessary for inquiry/trial', catCode: 'JUDICIARY' },
      { code: 'BNSS_94', title: 'Summons to Produce Document / Digital Record', act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS)', sec: 'Section 94', purpose: 'Court or Officer in charge requisition of electronic or physical records', catCode: 'JUDICIARY' },
      { code: 'CPC_ORDER_11', title: 'Discovery & Inspection of Documents', act: 'Code of Civil Procedure (CPC)', sec: 'Order XI Rule 14', purpose: 'Court order for production of documents under custody of party or state', catCode: 'JUDICIARY' },
      { code: 'POLICE_ACT_EXTRADITION', title: 'Inter-State Investigation & Case Diary Requisition', act: 'Police Act / Standing Orders', sec: 'Inter-State Protocol', purpose: 'Requisition of FIR, Crime Diary, Seizure Memo across state boundaries', catCode: 'LAW_ENFORCEMENT' },
      { code: 'RTI_SEC_6', title: 'Inter-Departmental Record Disclosure', act: 'Right to Information Act', sec: 'Section 6(3)', purpose: 'Transfer of public records application to concerned public authority', catCode: 'CIVIL_ADMIN' },
      { code: 'CAG_AUDIT_SUBPOENA', title: 'Statutory Audit & Vigilance Requisition', act: 'Comptroller & Auditor General (CAG) Act', sec: 'Section 18', purpose: 'Statutory requisition of revenue registers, sanctions, and accounts', catCode: 'REGULATORY' },
    ];

    const statMap: Record<string, string> = {};
    for (const s of statutoryTemplates) {
      const catId = catMap[s.catCode] || null;
      const res = await client.query(
        `INSERT INTO taxonomy_statutory_templates (code, title, legal_act_name, section_citation, default_purpose_text, applicable_domain_category_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) WHERE organization_id IS NULL DO UPDATE SET title = EXCLUDED.title, default_purpose_text = EXCLUDED.default_purpose_text
         RETURNING id, code;`,
        [s.code, s.title, s.act, s.sec, s.purpose, catId]
      );
      statMap[res.rows[0].code] = res.rows[0].id;
    }

    // =========================================================================
    // 5. DYNAMIC URGENCY & SLA TIERS
    // =========================================================================
    console.log('5. Seeding Dynamic Urgency & SLA Tiers...');
    const priorityTiers = [
      { code: 'COURT_MANDATE', name: 'Critical Court Mandate / Habeas Corpus', sla: 2, color: '#ef4444', desc: 'Direct judicial order with strict immediate production timeline', reqJust: true },
      { code: 'URGENT_WARRANT', name: 'Urgent Investigation / Arrest Warrant', sla: 24, color: '#f97316', desc: 'Time-sensitive criminal case, apprehension, or bail hearing', reqJust: true },
      { code: 'HIGH_PRIORITY', name: 'High Priority Administrative Inquiry', sla: 48, color: '#eab308', desc: 'Vigilance inquiry, legislative question, or compliance deadline', reqJust: false },
      { code: 'ROUTINE', name: 'Standard Inter-Agency Request', sla: 168, color: '#3b82f6', desc: 'Regular inter-departmental verification and record sharing (7 Days)', reqJust: false },
    ];

    const priorityMap: Record<string, string> = {};
    for (const p of priorityTiers) {
      const res = await client.query(
        `INSERT INTO taxonomy_priority_tiers (code, name, sla_hours, badge_color, description, requires_justification)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sla_hours = EXCLUDED.sla_hours, badge_color = EXCLUDED.badge_color
         RETURNING id, code;`,
        [p.code, p.name, p.sla, p.color, p.desc, p.reqJust]
      );
      priorityMap[res.rows[0].code] = res.rows[0].id;
    }

    // =========================================================================
    // 6. DYNAMIC ACCESS MODES & WATERMARK PROFILES
    // =========================================================================
    console.log('6. Seeding Dynamic Access Modes...');
    const accessModes = [
      { code: 'VIEW_ONLY_WATERMARKED', name: 'Ephemeral Watermarked View Only', raw: false, watermarked: true, view: true, desc: 'Strict browser-only decrypted streaming with forensic dynamic watermark' },
      { code: 'REDACTED_EXTRACT', name: 'Sanitized Redacted Extract', raw: false, watermarked: true, view: true, desc: 'Redacted view with sensitive intelligence/PII blacked out' },
      { code: 'FULL_CERTIFIED_DOWNLOAD', name: 'Full Certified Binary Download', raw: true, watermarked: true, view: true, desc: 'Full unredacted file download with Section 65B hash certificate' },
    ];

    const accessModeMap: Record<string, string> = {};
    for (const a of accessModes) {
      const res = await client.query(
        `INSERT INTO taxonomy_access_modes (code, name, allow_raw_download, allow_watermarked_pdf, allow_browser_view, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, allow_raw_download = EXCLUDED.allow_raw_download
         RETURNING id, code;`,
        [a.code, a.name, a.raw, a.watermarked, a.view, a.desc]
      );
      accessModeMap[res.rows[0].code] = res.rows[0].id;
    }

    // =========================================================================
    // 7. SEEDING THE MULTI-ORGANIZATION FLEET (4 Real Sovereign Entities)
    // =========================================================================
    console.log('7. Seeding Multi-Organization Fleet...');

    const fleetOrganizations = [
      {
        code: 'MH-HC-BOM',
        name: 'High Court of Judicature at Bombay',
        agencyCode: 'MH-JUD-HC-001',
        tierCode: 'STATE_GOV',
        catCode: 'JUDICIARY',
        regionCode: 'IND_MH_MUM',
        nodalName: 'Registrar General (Judicial-I)',
        nodalEmail: 'registrar.general@bombayhighcourt.nic.in',
        nodalPhone: '+91-22-22676767',
        departments: [
          { name: 'Criminal Appellate & Writ Section', code: 'CRIM_WRIT' },
          { name: 'Original Side Registry', code: 'ORIG_SIDE' },
          { name: 'Judicial Records & Archive Wing', code: 'RECORDS' },
        ],
        docTypes: [
          { code: 'WRIT_PETITION', name: 'Criminal Writ Petition & Pleadings' },
          { code: 'BAIL_ORDER', name: 'Judicial Bail Sanction Order' },
          { code: 'CASE_ROSTER', name: 'Daily High Court Causelist & Roster' },
          { code: 'JUDGMENT', name: 'Certified Final High Court Judgment' },
        ],
        users: [
          { username: 'hc_admin', name: 'High Court Principal Systems Admin', email: 'hc_admin@mumbai.gov.in', role: 'SUPER_ADMIN', designation: 'Principal Systems Administrator', level: 5, dept: 'CRIM_WRIT' },
          { username: 'registrar', name: 'Hon. Registrar (Judicial Section)', email: 'registrar@mumbai.gov.in', role: 'DEPT_HEAD', designation: 'Registrar (Judicial-I)', level: 5, dept: 'CRIM_WRIT' },
          { username: 'bench_clerk', name: 'Senior Bench Dealing Clerk', email: 'bench_clerk@mumbai.gov.in', role: 'INVESTIGATING_OFFICER', designation: 'Senior Bench Officer', level: 3, dept: 'ORIG_SIDE' },
          { username: 'hc_auditor', name: 'High Court Vigilance Officer', email: 'hc_auditor@mumbai.gov.in', role: 'AUDITOR', designation: 'Chief Vigilance Registrar', level: 5, dept: 'RECORDS' },
        ],
      },
      {
        code: 'DL-POL-NZ',
        name: 'Delhi Police Special Cell & Cyber Crime Unit',
        agencyCode: 'DL-POL-CYBER-004',
        tierCode: 'STATE_GOV',
        catCode: 'LAW_ENFORCEMENT',
        regionCode: 'IND_DL_NZ',
        nodalName: 'Assistant Commissioner of Police (Cyber)',
        nodalEmail: 'acp-cyber.delhipolice@gov.in',
        nodalPhone: '+91-11-23469200',
        departments: [
          { name: 'Special Cyber Crime Cell', code: 'CYBER' },
          { name: 'Inter-State Investigation Wing', code: 'SPECIAL_OPS' },
          { name: 'Digital Forensics & Evidence Lab', code: 'FSL_EVIDENCE' },
        ],
        docTypes: [
          { code: 'FIR', name: 'First Information Report (FIR)' },
          { code: 'SEIZURE_MEMO', name: 'Digital Evidence Seizure Memo' },
          { code: 'CHARGESHEET', name: 'Final Police Chargesheet Dossier' },
          { code: 'FORENSIC_REPORT', name: 'Classified Cyber Forensics Telemetry' },
        ],
        users: [
          { username: 'delhi_admin', name: 'Delhi Police IT Operations Head', email: 'delhi_admin@delhipolice.gov.in', role: 'ORG_ADMIN', designation: 'Director (Police Telecom & IT)', level: 5, dept: 'CYBER' },
          { username: 'acp_cyber', name: 'ACP R. K. Saxena (Cyber Operations)', email: 'acp_cyber@delhipolice.gov.in', role: 'DEPT_HEAD', designation: 'Assistant Commissioner of Police', level: 5, dept: 'CYBER' },
          { username: 'io_sharma', name: 'Inspector Vikram Sharma (IO)', email: 'io_sharma@delhipolice.gov.in', role: 'INVESTIGATING_OFFICER', designation: 'Senior Investigating Officer', level: 3, dept: 'SPECIAL_OPS' },
          { username: 'vigilance_delhi', name: 'Additional DCP (Vigilance)', email: 'vigilance_delhi@delhipolice.gov.in', role: 'AUDITOR', designation: 'Vigilance & Compliance Officer', level: 5, dept: 'FSL_EVIDENCE' },
        ],
      },
      {
        code: 'GJ-REV-AMD',
        name: 'Directorate of Land Revenue & Settlement, Gujarat',
        agencyCode: 'GJ-REV-DIR-002',
        tierCode: 'STATE_GOV',
        catCode: 'REVENUE_TAXATION',
        regionCode: 'IND_GJ_AMD',
        nodalName: 'Resident Additional Collector (Revenue)',
        nodalEmail: 'collector-rev.gujarat@nic.in',
        nodalPhone: '+91-79-27551000',
        departments: [
          { name: 'Land Title & Records Wing', code: 'LAND_RECORDS' },
          { name: 'Cadastral Survey & Demarcation', code: 'SURVEY' },
          { name: 'Revenue Sanctions & Mutations', code: 'SANCTIONS' },
        ],
        docTypes: [
          { code: 'EXTRACT_712', name: 'Certified 7/12 Land Title Extract' },
          { code: 'CADASTRAL_MAP', name: 'Cadastral Survey Demarcation Map' },
          { code: 'SANCTION_ORDER', name: 'Land Conversion Sanction Order' },
          { code: 'MUTATION_ENTRY', name: 'Verified Mutation & Heirship Ledger' },
        ],
        users: [
          { username: 'gujarat_admin', name: 'Revenue Informatics Officer', email: 'gujarat_admin@revenue.gov.in', role: 'ORG_ADMIN', designation: 'System Administrator (Revenue)', level: 4, dept: 'LAND_RECORDS' },
          { username: 'collector', name: 'District Collector & Settlement Officer', email: 'collector@revenue.gov.in', role: 'DEPT_HEAD', designation: 'District Collector', level: 4, dept: 'SANCTIONS' },
          { username: 'talati_officer', name: 'Senior Talati / Revenue Inspector', email: 'talati_officer@revenue.gov.in', role: 'INVESTIGATING_OFFICER', designation: 'Revenue Inspector', level: 2, dept: 'LAND_RECORDS' },
          { username: 'gujarat_auditor', name: 'Vigilance Inspector (Revenue Inspection)', email: 'gujarat_auditor@revenue.gov.in', role: 'AUDITOR', designation: 'Divisional Vigilance Officer', level: 4, dept: 'SURVEY' },
        ],
      },
      {
        code: 'CBI-HQ-DEL',
        name: 'Central Bureau of Investigation (CBI) - Special Crimes',
        agencyCode: 'CBI-HQ-SCB-001',
        tierCode: 'CENTRAL_GOV',
        catCode: 'LAW_ENFORCEMENT',
        regionCode: 'IND_DL_NZ',
        nodalName: 'Superintendent of Police (Inter-State Coord)',
        nodalEmail: 'sp-coordination@cbi.gov.in',
        nodalPhone: '+91-11-24362755',
        departments: [
          { name: 'Special Crimes Branch', code: 'SCB' },
          { name: 'Anti-Corruption Directorate', code: 'ACD' },
          { name: 'International Police Cooperation (Interpol)', code: 'INTERPOL' },
        ],
        docTypes: [
          { code: 'EXTRADITION_WARRANT', name: 'Inter-State Extradition & Production Warrant' },
          { code: 'CLASSIFIED_INTEL', name: 'Classified Cryptographic Interception Dossier' },
          { code: 'FINANCIAL_FORENSIC', name: 'Cross-Border Hawala Forensic Ledger' },
        ],
        users: [
          { username: 'cbi_admin', name: 'CBI Principal Cyber Administrator', email: 'cbi_admin@cbi.gov.in', role: 'SUPER_ADMIN', designation: 'Director (CBI Systems)', level: 5, dept: 'SCB' },
          { username: 'sp_investigation', name: 'Superintendent of Police (CBI-SCB)', email: 'sp_investigation@cbi.gov.in', role: 'DEPT_HEAD', designation: 'Superintendent of Police', level: 5, dept: 'SCB' },
          { username: 'dsp_officer', name: 'Deputy SP (Chief Investigating Officer)', email: 'dsp_officer@cbi.gov.in', role: 'INVESTIGATING_OFFICER', designation: 'Deputy Superintendent of Police', level: 4, dept: 'ACD' },
          { username: 'cbi_vigilance', name: 'Chief Vigilance Officer (CBI)', email: 'cbi_vigilance@cbi.gov.in', role: 'AUDITOR', designation: 'Chief Vigilance Officer', level: 5, dept: 'INTERPOL' },
        ],
      },
    ];

    const defaultPassword = 'Password@DMS2026!';
    const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

    const seededOrgIds: Record<string, string> = {};
    const seededDocIds: Record<string, { docId: string; verId: string; orgId: string }> = {};

    for (const orgData of fleetOrganizations) {
      console.log(`\n--- Provisioning Organization: ${orgData.name} (${orgData.code}) ---`);

      // 1. Insert/Update Organization
      const orgRes = await client.query(
        `INSERT INTO organizations (
           name, code, agency_code, tier_id, domain_category_id, jurisdiction_region_id,
           nodal_officer_name, nodal_officer_email, nodal_officer_phone, status, is_verified_federation_node, features
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', true, $10)
         ON CONFLICT (code) DO UPDATE SET 
           name = EXCLUDED.name, agency_code = EXCLUDED.agency_code,
           tier_id = EXCLUDED.tier_id, domain_category_id = EXCLUDED.domain_category_id,
           jurisdiction_region_id = EXCLUDED.jurisdiction_region_id,
           nodal_officer_name = EXCLUDED.nodal_officer_name, nodal_officer_email = EXCLUDED.nodal_officer_email,
           is_verified_federation_node = true
         RETURNING id;`,
        [
          orgData.name,
          orgData.code,
          orgData.agencyCode,
          tierMap[orgData.tierCode],
          catMap[orgData.catCode],
          regionMap[orgData.regionCode],
          orgData.nodalName,
          orgData.nodalEmail,
          orgData.nodalPhone,
          JSON.stringify({
            feature_approvals: true,
            feature_section_65b: true,
            feature_retention_holds: true,
            feature_blockchain: true,
            feature_deep_ocr: true,
            feature_inter_org_collaboration: true,
          }),
        ]
      );
      const orgId = orgRes.rows[0].id;
      seededOrgIds[orgData.code] = orgId;

      // 2. Insert Security Levels (T1 to T5)
      const secLevels = [
        { code: 'T1', name: 'Public / Low', rank: 1, approval_required: false, encryption_required: false, audit_level: 1 },
        { code: 'T2', name: 'Internal', rank: 2, approval_required: false, encryption_required: true, audit_level: 2 },
        { code: 'T3', name: 'Confidential', rank: 3, approval_required: false, encryption_required: true, audit_level: 3 },
        { code: 'T4', name: 'Sensitive', rank: 4, approval_required: true, encryption_required: true, audit_level: 4 },
        { code: 'T5', name: 'Highly Sensitive', rank: 5, approval_required: true, encryption_required: true, audit_level: 5 },
      ];

      const secLevelMap: Record<string, string> = {};
      for (const s of secLevels) {
        const slRes = await client.query(
          `INSERT INTO security_levels (organization_id, code, name, rank, approval_required, encryption_required, audit_level)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, code;`,
          [orgId, s.code, s.name, s.rank, s.approval_required, s.encryption_required, s.audit_level]
        );
        secLevelMap[slRes.rows[0].code] = slRes.rows[0].id;
      }

      // 3. Insert Departments
      const deptMap: Record<string, string> = {};
      for (const d of orgData.departments) {
        const dRes = await client.query(
          `INSERT INTO departments (organization_id, name, code, status)
           VALUES ($1, $2, $3, 'ACTIVE')
           ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, code;`,
          [orgId, d.name, d.code]
        );
        deptMap[dRes.rows[0].code] = dRes.rows[0].id;
      }

      // 4. Insert Document Types
      const docTypeMap: Record<string, string> = {};
      for (const dt of orgData.docTypes) {
        const dtRes = await client.query(
          `INSERT INTO document_types (organization_id, code, name, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, code;`,
          [orgId, dt.code, dt.name, `Official Record: ${dt.name}`]
        );
        docTypeMap[dtRes.rows[0].code] = dtRes.rows[0].id;
      }

      // 5. Insert Roles
      const roles = [
        { code: 'SUPER_ADMIN', name: 'System Super Administrator', desc: 'Full root access and cross-agency federation governance', is_system: true },
        { code: 'ORG_ADMIN', name: 'Organization Administrator', desc: 'Internal institutional policy and department control', is_system: true },
        { code: 'DEPT_HEAD', name: 'Department Head / Approver', desc: 'Can review, approve, and verify sensitive records & cross-org transfers', is_system: true },
        { code: 'INVESTIGATING_OFFICER', name: 'Executive Dealing Officer', desc: 'Can upload, view, edit, and requisition official case records', is_system: false },
        { code: 'AUDITOR', name: 'Compliance & Vigilance Auditor', desc: 'Read-only access to audit trails, chain of custody, and compliance logs', is_system: true },
      ];

      const roleMap: Record<string, string> = {};
      for (const r of roles) {
        const rRes = await client.query(
          `INSERT INTO roles (organization_id, code, name, description, is_system_role)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, code;`,
          [orgId, r.code, r.name, r.desc, r.is_system]
        );
        roleMap[rRes.rows[0].code] = rRes.rows[0].id;
      }

      // 6. Map Permissions to Roles
      const allPerms = await client.query('SELECT id, code FROM permissions');
      for (const p of allPerms.rows) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [roleMap['SUPER_ADMIN'], p.id]
        );
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [roleMap['ORG_ADMIN'], p.id]
        );
      }

      // 7. Insert Users
      const userMap: Record<string, string> = {};
      for (const u of orgData.users) {
        const deptId = deptMap[u.dept] || Object.values(deptMap)[0];
        const uRes = await client.query(
          `INSERT INTO users (
             organization_id, department_id, employee_code, username, full_name,
             email, designation, password_hash, max_security_level, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
           ON CONFLICT (organization_id, email) DO UPDATE SET
             full_name = EXCLUDED.full_name, designation = EXCLUDED.designation,
             password_hash = EXCLUDED.password_hash, max_security_level = EXCLUDED.max_security_level,
             status = 'ACTIVE'
           RETURNING id, username;`,
          [orgId, deptId, `EMP-${orgData.code}-${u.username.toUpperCase()}`, u.username, u.name, u.email, u.designation, defaultPasswordHash, u.level]
        );
        const userId = uRes.rows[0].id;
        userMap[u.username] = userId;

        // Assign User Role
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [userId, roleMap[u.role]]
        );
      }

    }

    await client.query('COMMIT');
    console.log('\n========================================================================');
    console.log('✅ MULTI-ORGANIZATION FLEET & DYNAMIC TAXONOMIES SEEDED SUCCESSFULLY!');
    console.log('========================================================================');
    console.log('\n--- PRE-SEEDED TEST CREDENTIALS ---');
    console.log('Password for all accounts: Password@DMS2026!\n');
    fleetOrganizations.forEach((org) => {
      console.log(`🏛️ [${org.code}] ${org.name}`);
      org.users.forEach((u) => {
        console.log(`   • ${u.role.padEnd(22)} | Email: ${u.email.padEnd(35)} | Clearance: T${u.level}`);
      });
      console.log('');
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

seedCollaboration().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
