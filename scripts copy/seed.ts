import { Client } from 'pg';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('--- Seeding Generic Institutional DMS Database ---');
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

    // 1. Organization
    console.log('1. Seeding Organizations...');
    const orgRes = await client.query(
      `INSERT INTO organizations (name, code, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      ['General Administration Department', 'DEMO', 'ACTIVE']
    );
    const orgId = orgRes.rows[0].id;

    // 2. Departments
    console.log('2. Seeding Departments...');
    const depts = [
      { name: 'General Administration & Governance', code: 'ADMIN' },
      { name: 'Records & Archives Management', code: 'RECORDS' },
      { name: 'Legal Affairs & Compliance Cell', code: 'LEGAL' },
      { name: 'Finance, Budget & Accounts Wing', code: 'FINANCE' },
      { name: 'Citizen Services & Public Grievance', code: 'SERVICES' },
    ];

    const deptMap: Record<string, string> = {};
    for (const d of depts) {
      const dRes = await client.query(
        `INSERT INTO departments (organization_id, name, code, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code;`,
        [orgId, d.name, d.code]
      );
      deptMap[dRes.rows[0].code] = dRes.rows[0].id;
    }

    // 3. Security Levels (T1 to T5)
    console.log('3. Seeding Security Levels (T1 to T5)...');
    const secLevels = [
      { code: 'T1', name: 'Public / Low', rank: 1, approval_required: false, encryption_required: false, audit_level: 1 },
      { code: 'T2', name: 'Internal', rank: 2, approval_required: false, encryption_required: true, audit_level: 2 },
      { code: 'T3', name: 'Confidential', rank: 3, approval_required: false, encryption_required: true, audit_level: 3 },
      { code: 'T4', name: 'Sensitive', rank: 4, approval_required: true, encryption_required: true, audit_level: 4 },
      { code: 'T5', name: 'Highly Sensitive', rank: 5, approval_required: true, encryption_required: true, audit_level: 5 },
    ];

    for (const s of secLevels) {
      await client.query(
        `INSERT INTO security_levels (organization_id, code, name, rank, approval_required, encryption_required, audit_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (organization_id, code) DO NOTHING;`,
        [orgId, s.code, s.name, s.rank, s.approval_required, s.encryption_required, s.audit_level]
      );
    }

    // 4. Document Types
    console.log('4. Seeding Generic Document Types...');
    const docTypes = [
      { code: 'OM', name: 'Office Memorandum' },
      { code: 'LETTER', name: 'Official Correspondence / Letter' },
      { code: 'REPORT', name: 'Official Inspection / Audit Report' },
      { code: 'NOTICE', name: 'Public Notice & Circular' },
      { code: 'ORDER', name: 'Executive Order & Sanction' },
      { code: 'ANNEXURE', name: 'Verified Annexure & Dossier' },
    ];

    for (const dt of docTypes) {
      await client.query(
        `INSERT INTO document_types (organization_id, code, name, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, code) DO NOTHING;`,
        [orgId, dt.code, dt.name, `Official Document: ${dt.name}`]
      );
    }

    // 5. Roles
    console.log('5. Seeding Roles...');
    const roles = [
      { code: 'SUPER_ADMIN', name: 'System Super Administrator', description: 'Full system control & user management', is_system: true },
      { code: 'ORG_ADMIN', name: 'Organization Administrator', description: 'Organization policy and department control', is_system: true },
      { code: 'DEPT_HEAD', name: 'Department Head / Approver', description: 'Can review, approve, and reject sensitive document changes', is_system: true },
      { code: 'INVESTIGATING_OFFICER', name: 'Executive Dealing Officer', description: 'Can upload, view, edit, and request changes to official records', is_system: false },
      { code: 'AUDITOR', name: 'Compliance & Vigilance Auditor', description: 'Read-only access to audit trails, user profiles, and compliance logs', is_system: true },
    ];

    const roleMap: Record<string, string> = {};
    for (const r of roles) {
      const rRes = await client.query(
        `INSERT INTO roles (organization_id, code, name, description, is_system_role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code;`,
        [orgId, r.code, r.name, r.description, r.is_system]
      );
      roleMap[rRes.rows[0].code] = rRes.rows[0].id;
    }

    // 6. Assign Permissions to Roles
    console.log('6. Mapping Permissions to Roles...');
    const allPerms = await client.query('SELECT id, code FROM permissions');
    const permMap = Object.fromEntries(allPerms.rows.map((p) => [p.code, p.id]));

    // Super Admin & Org Admin get everything
    for (const p of allPerms.rows) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [roleMap['SUPER_ADMIN'], p.id]
      );
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [roleMap['ORG_ADMIN'], p.id]
      );
    }

    // Approver / Dept Head
    const deptHeadPerms = [
      'DOCUMENT_CREATE', 'DOCUMENT_VIEW', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_EDIT',
      'DOCUMENT_APPROVE_CHANGE', 'DOCUMENT_REJECT_CHANGE', 'DOCUMENT_REQUEST_CHANGE',
      'AUDIT_VIEW'
    ];
    for (const pCode of deptHeadPerms) {
      if (permMap[pCode]) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [roleMap['DEPT_HEAD'], permMap[pCode]]
        );
      }
    }

    // Executive Dealing Officer
    const officerPerms = [
      'DOCUMENT_CREATE', 'DOCUMENT_VIEW', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_EDIT',
      'DOCUMENT_REQUEST_CHANGE'
    ];
    for (const pCode of officerPerms) {
      if (permMap[pCode]) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [roleMap['INVESTIGATING_OFFICER'], permMap[pCode]]
        );
      }
    }

    // Auditor
    const auditorPerms = ['AUDIT_VIEW', 'USER_PROFILE_AUDIT_VIEW', 'DOCUMENT_VIEW'];
    for (const pCode of auditorPerms) {
      if (permMap[pCode]) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [roleMap['AUDITOR'], permMap[pCode]]
        );
      }
    }

    // 7. Seed Clean Generic Users
    console.log('7. Seeding Users with bcrypt hashed passwords & clearance levels...');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_security_level INTEGER DEFAULT 3;`);

    const defaultPassword = 'Password@DMS2026!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const usersToCreate = [
      {
        username: 'admin',
        full_name: 'Principal Systems Administrator',
        email: 'admin@dms.gov.in',
        employee_code: 'GOV-ADM-001',
        designation: 'Principal Systems Administrator',
        department_id: deptMap['ADMIN'],
        role_code: 'SUPER_ADMIN',
        max_security_level: 5,
        custom_password: 'Admin@DMS2026!',
      },
      {
        username: 'depthead',
        full_name: 'Joint Secretary / Section Head',
        email: 'depthead@dms.gov.in',
        employee_code: 'GOV-SEC-001',
        designation: 'Section Head & Designated Approver',
        department_id: deptMap['RECORDS'],
        role_code: 'DEPT_HEAD',
        max_security_level: 4,
        custom_password: 'Head@DMS2026!',
      },
      {
        username: 'officer',
        full_name: 'Senior Dealing Officer',
        email: 'officer@dms.gov.in',
        employee_code: 'GOV-OFF-042',
        designation: 'Senior Executive Officer',
        department_id: deptMap['LEGAL'],
        role_code: 'INVESTIGATING_OFFICER',
        max_security_level: 3,
        custom_password: 'Officer@DMS2026!',
      },
      {
        username: 'auditor',
        full_name: 'Vigilance & Compliance Auditor',
        email: 'auditor@dms.gov.in',
        employee_code: 'GOV-AUD-009',
        designation: 'Chief Vigilance & Compliance Auditor',
        department_id: deptMap['ADMIN'],
        role_code: 'AUDITOR',
        max_security_level: 5,
        custom_password: 'Auditor@DMS2026!',
      },
    ];

    for (const u of usersToCreate) {
      const userHash = u.custom_password ? await bcrypt.hash(u.custom_password, 10) : passwordHash;

      const userRes = await client.query(
        `INSERT INTO users (
           organization_id, department_id, employee_code, username, full_name,
           email, designation, password_hash, max_security_level, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
         ON CONFLICT (organization_id, email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             full_name = EXCLUDED.full_name,
             designation = EXCLUDED.designation,
             employee_code = EXCLUDED.employee_code,
             max_security_level = EXCLUDED.max_security_level,
             status = 'ACTIVE'
         RETURNING id;`,
        [orgId, u.department_id, u.employee_code, u.username, u.full_name, u.email, u.designation, userHash, u.max_security_level]
      );
      const userId = userRes.rows[0].id;

      // Assign user role
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING;`,
        [userId, roleMap[u.role_code]]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed completed successfully with generic institutional role accounts!');
    console.log('\n--- Pre-seeded Demo Accounts ---');
    usersToCreate.forEach((u) => {
      console.log(`• [${u.role_code}] Email: ${u.email} | Password: ${u.custom_password || defaultPassword}`);
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
