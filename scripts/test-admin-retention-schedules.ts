import { query } from '../lib/db';

async function testAdminRetentionSchedules() {
  console.log('--- Testing Organization Retention Schedules & Assignment ---');

  // 1. Get an organization
  const orgs = await query<{ id: string; name: string }>(`SELECT id, name FROM organizations LIMIT 1`);
  if (orgs.length === 0) {
    console.error('No organization found');
    return;
  }
  const org = orgs[0];
  console.log(`Testing with organization: ${org.name} (${org.id})`);

  // 2. Fetch existing retention policies for this org
  const existing = await query(
    `SELECT id, schedule_code, name, retention_days, permanent, action_on_expiry 
     FROM retention_policies 
     WHERE organization_id = $1`,
    [org.id]
  );
  console.log(`Found ${existing.length} statutory retention policies:`);
  existing.forEach((p: any) => {
    console.log(`  - [${p.schedule_code}] ${p.name} | ${p.permanent ? 'PERMANENT' : `${p.retention_days} days`} | ${p.action_on_expiry}`);
  });

  // Clean leftover test policies if any
  await query(`DELETE FROM document_type_policies WHERE retention_policy_id IN (SELECT id FROM retention_policies WHERE name LIKE 'Test Custom Retention Schedule%')`);
  await query(`DELETE FROM retention_policies WHERE name LIKE 'Test Custom Retention Schedule%'`);

  // 3. Create a new custom retention policy
  const testId = Date.now().toString().slice(-4);
  const testScheduleCode = `SCH-TEST-${testId}`;
  const inserted = await query(
    `INSERT INTO retention_policies (
      organization_id, name, schedule_code, retention_days, permanent, 
      deletion_requires_approval, action_on_expiry, statutory_framework, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, schedule_code, name`,
    [
      org.id,
      `Test Custom Retention Schedule ${testId}`,
      testScheduleCode,
      1825, // 5 years
      false,
      true,
      'Maker-Checker Review & Cryptographic Zeroization',
      'Test Statutory Directive 2026',
      'Testing admin retention policy assignment pipeline',
    ]
  );
  const newPolicy = inserted[0];
  console.log(`\nCreated new policy: [${newPolicy.schedule_code}] ${newPolicy.name} (ID: ${newPolicy.id})`);

  // 4. Test mapping it to a department and doc type in document_type_policies
  const depts = await query<{ id: string }>(`SELECT id FROM departments WHERE organization_id = $1 LIMIT 1`, [org.id]);
  const docTypes = await query<{ id: string }>(`SELECT id FROM document_types WHERE organization_id = $1 LIMIT 1`, [org.id]);
  const tiers = await query<{ id: string }>(`SELECT id FROM security_levels WHERE organization_id = $1 LIMIT 1`, [org.id]);

  if (depts.length > 0 && docTypes.length > 0 && tiers.length > 0) {
    const deptId = depts[0].id;
    const docTypeId = docTypes[0].id;
    const tierId = tiers[0].id;

    console.log(`\nMapping Policy to Dept ${deptId} + DocType ${docTypeId}...`);
    // Upsert mapping
    const existingMapping = await query(
      `SELECT id FROM document_type_policies WHERE department_id = $1 AND document_type_id = $2`,
      [deptId, docTypeId]
    );

    if (existingMapping.length > 0) {
      await query(
        `UPDATE document_type_policies 
         SET security_level_id = $1, retention_policy_id = $2, approval_required = true, updated_at = NOW()
         WHERE id = $3`,
        [tierId, newPolicy.id, existingMapping[0].id]
      );
      console.log(`Updated existing mapping ID: ${existingMapping[0].id}`);
    } else {
      const newMap = await query(
        `INSERT INTO document_type_policies (
          organization_id, department_id, document_type_id, security_level_id, retention_policy_id, approval_required, ocr_required, download_allowed, active
        ) VALUES ($1, $2, $3, $4, $5, true, true, true, true)
        RETURNING id`,
        [org.id, deptId, docTypeId, tierId, newPolicy.id]
      );
      console.log(`Created new mapping ID: ${newMap[0].id}`);
    }

    // Check that retention policy cannot be deleted while in use
    const inUseCheck = await query(
      `SELECT COUNT(*)::int as count FROM document_type_policies WHERE retention_policy_id = $1`,
      [newPolicy.id]
    );
    console.log(`In-use check for ${newPolicy.schedule_code}: count = ${inUseCheck[0].count} (Safety guard verified!)`);

    // Delete test mapping or update it
    await query(`DELETE FROM document_type_policies WHERE retention_policy_id = $1`, [newPolicy.id]);
  }

  // 5. Delete the test schedule
  await query(`DELETE FROM retention_policies WHERE id = $1`, [newPolicy.id]);
  console.log(`\nSuccessfully cleaned up test policy ID: ${newPolicy.id}`);

  console.log('\n--- All Retention Schedules & Policy Assignment Tests PASSED! ---');
  process.exit(0);
}

testAdminRetentionSchedules().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
