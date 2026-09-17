import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import {
  OrganizationFeatureConfig,
  DEFAULT_FULL_FEATURES,
  ensureOrganizationFeaturesSchema,
  normalizeFeatures,
} from './service-config';

export interface ProvisionOfficeRequest {
  officeName: string;
  officeCode: string;
  officeDescription?: string;
  features?: Partial<OrganizationFeatureConfig>;
  departments?: Array<{ name: string; code: string }>;
  documentTypes?: Array<{ name: string; code: string; description?: string }>;
  adminUser: {
    fullName: string;
    email: string;
    employeeCode: string;
    password: string;
    designation?: string;
    username?: string;
  };
}

export interface ProvisionOfficeResult {
  success: boolean;
  organization: {
    id: string;
    name: string;
    code: string;
    features: OrganizationFeatureConfig;
  };
  adminUser: {
    id: string;
    fullName: string;
    email: string;
    employeeCode: string;
    role: string;
  };
  departmentsCount: number;
  documentTypesCount: number;
  message: string;
}

const DEFAULT_SECURITY_LEVELS = [
  { code: 'T1', name: 'Public / Low', rank: 1, approval_required: false, encryption_required: false, audit_level: 1 },
  { code: 'T2', name: 'Internal', rank: 2, approval_required: false, encryption_required: true, audit_level: 2 },
  { code: 'T3', name: 'Confidential', rank: 3, approval_required: false, encryption_required: true, audit_level: 3 },
  { code: 'T4', name: 'Sensitive', rank: 4, approval_required: true, encryption_required: true, audit_level: 4 },
  { code: 'T5', name: 'Highly Sensitive', rank: 5, approval_required: true, encryption_required: true, audit_level: 5 },
];

const DEFAULT_ROLES = [
  { code: 'ORG_ADMIN', name: 'Office Administrator', description: 'Institutional policy and user administration', is_system: true },
  { code: 'DEPT_HEAD', name: 'Department Head / Approver', description: 'Review, approve, and verify sensitive records', is_system: true },
  { code: 'INVESTIGATING_OFFICER', name: 'Dealing Officer / Case Operator', description: 'Upload, manage, and process official case documents', is_system: false },
  { code: 'AUDITOR', name: 'Compliance & Vigilance Auditor', description: 'Independent inspection of activity trails and cryptographic records', is_system: true },
];

export async function provisionOfficeInstance(req: ProvisionOfficeRequest): Promise<ProvisionOfficeResult> {
  await ensureOrganizationFeaturesSchema();

  if (!req.officeName || !req.officeCode || !req.adminUser?.email || !req.adminUser?.password) {
    throw new Error('Missing required fields: officeName, officeCode, adminUser.email, and adminUser.password are required.');
  }

  const cleanCode = req.officeCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  const activeFeatures = normalizeFeatures(req.features || DEFAULT_FULL_FEATURES);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if organization code already exists
    const existingOrg = await client.query('SELECT id FROM organizations WHERE code = $1;', [cleanCode]);
    if (existingOrg.rows.length > 0) {
      throw new Error(`An office with code "${cleanCode}" already exists.`);
    }

    // 2. Insert Organization with configured features JSONB
    const orgRes = await client.query(
      `INSERT INTO organizations (name, code, status, features)
       VALUES ($1, $2, 'ACTIVE', $3)
       RETURNING id, name, code, features;`,
      [req.officeName.trim(), cleanCode, JSON.stringify(activeFeatures)]
    );
    const orgId = orgRes.rows[0].id;

    // 3. Insert Departments
    const deptsToCreate = req.departments && req.departments.length > 0
      ? req.departments
      : [
          { name: 'General Administration', code: 'ADMIN' },
          { name: 'Operations & Records', code: 'OPERATIONS' },
          { name: 'Accounts & Public Grievance', code: 'ACCOUNTS' },
        ];

    const deptMap: Record<string, string> = {};
    for (const d of deptsToCreate) {
      const dCode = d.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
      const dRes = await client.query(
        `INSERT INTO departments (organization_id, name, code, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code;`,
        [orgId, d.name.trim(), dCode]
      );
      deptMap[dRes.rows[0].code] = dRes.rows[0].id;
    }

    const primaryDeptId = deptMap['ADMIN'] || Object.values(deptMap)[0];

    // 4. Insert Security Levels
    for (const sl of DEFAULT_SECURITY_LEVELS) {
      await client.query(
        `INSERT INTO security_levels (organization_id, code, name, rank, approval_required, encryption_required, audit_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (organization_id, code) DO NOTHING;`,
        [orgId, sl.code, sl.name, sl.rank, sl.approval_required, sl.encryption_required, sl.audit_level]
      );
    }

    // 5. Insert Document Types (Custom or Standard)
    const docTypesToCreate = req.documentTypes && req.documentTypes.length > 0
      ? req.documentTypes
      : [
          { name: 'Payment Receipt / Challan', code: 'RECEIPT', description: 'Official revenue and payment receipt records' },
          { name: 'Office Memorandum', code: 'OM', description: 'Internal directives, notices, and communications' },
          { name: 'Public Grievance Application', code: 'APPLICATION', description: 'Citizen requests, petitions, and representations' },
          { name: 'Official Inspection Report', code: 'REPORT', description: 'Field reports, verifications, and compliance audits' },
        ];

    let docTypesCount = 0;
    for (const dt of docTypesToCreate) {
      const dtCode = dt.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
      await client.query(
        `INSERT INTO document_types (organization_id, code, name, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, code) DO NOTHING;`,
        [orgId, dtCode, dt.name.trim(), dt.description || `Official ${dt.name}`]
      );
      docTypesCount++;
    }

    // 6. Insert Roles
    const roleMap: Record<string, string> = {};
    for (const r of DEFAULT_ROLES) {
      const rRes = await client.query(
        `INSERT INTO roles (organization_id, code, name, description, is_system_role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code;`,
        [orgId, r.code, r.name, r.description, r.is_system]
      );
      roleMap[rRes.rows[0].code] = rRes.rows[0].id;
    }

    // 7. Map Permissions to ORG_ADMIN Role
    const allPerms = await client.query('SELECT id FROM permissions;');
    const adminRoleId = roleMap['ORG_ADMIN'];
    for (const perm of allPerms.rows) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING;`,
        [adminRoleId, perm.id]
      );
    }

    // 8. Create Administrator User
    const passwordHash = await bcrypt.hash(req.adminUser.password, 10);
    const username = (req.adminUser.username || req.adminUser.email.split('@')[0] || `${cleanCode}_admin`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');

    const userRes = await client.query(
      `INSERT INTO users (
        organization_id, department_id, username, email, password_hash,
        full_name, employee_code, designation, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
       RETURNING id, full_name, email, employee_code;`,
      [
        orgId,
        primaryDeptId,
        username,
        req.adminUser.email.trim().toLowerCase(),
        passwordHash,
        req.adminUser.fullName.trim(),
        req.adminUser.employeeCode?.trim() || `${cleanCode}-ADM-01`,
        req.adminUser.designation?.trim() || 'Institutional Administrator',
      ]
    );

    const adminUser = userRes.rows[0];

    // Assign ORG_ADMIN role to the admin user
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [adminUser.id, adminRoleId]
    );

    // 9. Emit Initial Audit Event
    await client.query(
      `INSERT INTO audit_events (
        organization_id, actor_id, event_type, resource_type, result, ip_address, user_agent, event_metadata
       )
       VALUES ($1, $2, 'OFFICE_INSTANCE_PROVISIONED', 'ORGANIZATION', 'SUCCESS', '127.0.0.1', 'DMS-Service-Provisioner/2.0', $3);`,
      [
        orgId,
        adminUser.id,
        JSON.stringify({
          officeName: req.officeName,
          officeCode: cleanCode,
          activeFeatures,
          departmentsInitialized: Object.keys(deptMap).length,
          documentTypesCount: docTypesCount,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      organization: {
        id: orgId,
        name: req.officeName,
        code: cleanCode,
        features: activeFeatures,
      },
      adminUser: {
        id: adminUser.id,
        fullName: adminUser.full_name,
        email: adminUser.email,
        employeeCode: adminUser.employee_code,
        role: 'ORG_ADMIN',
      },
      departmentsCount: Object.keys(deptMap).length,
      documentTypesCount: docTypesCount,
      message: `Office instance "${req.officeName}" [${cleanCode}] successfully provisioned with customized modular features.`,
    };
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('[provisionOfficeInstance] Error:', err);
    throw err;
  } finally {
    client.release();
  }
}
