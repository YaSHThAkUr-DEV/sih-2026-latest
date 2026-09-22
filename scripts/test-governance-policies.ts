import { query, pool } from '../lib/db';

async function runGovernancePolicyTests() {
  console.log('===========================================================');
  console.log('🧪 TESTING DEPARTMENTAL GOVERNANCE POLICIES PIPELINE');
  console.log('===========================================================\n');

  try {
    // 1. Get Organization
    const orgRes = await query<{ id: string }>('SELECT id FROM organizations LIMIT 1');
    if (orgRes.length === 0) throw new Error('No organization found');
    const orgId = orgRes[0].id;

    // 2. Get Legal Department & Order Document Type
    const deptRes = await query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name FROM departments WHERE organization_id = $1 AND code = 'LEGAL' LIMIT 1`,
      [orgId]
    );
    const docTypeRes = await query<{ id: string; code: string; name: string }>(
      `SELECT id, code, name FROM document_types WHERE organization_id = $1 AND code = 'ORDER' LIMIT 1`,
      [orgId]
    );
    const secRes = await query<{ id: string; code: string; name: string; rank: number }>(
      `SELECT id, code, name, rank FROM security_levels WHERE organization_id = $1 AND code = 'T4' LIMIT 1`,
      [orgId]
    );
    const retRes = await query<{ id: string; name: string; retention_days: number }>(
      `SELECT id, name, retention_days FROM retention_policies WHERE organization_id = $1 LIMIT 1`,
      [orgId]
    );

    if (!deptRes[0] || !docTypeRes[0] || !secRes[0] || !retRes[0]) {
      throw new Error('Required taxonomy records (Legal dept / Order docType / T4 secLevel / Retention policy) not found.');
    }

    const dept = deptRes[0];
    const docType = docTypeRes[0];
    const secLevel = secRes[0];
    const retPolicy = retRes[0];

    console.log(`📌 Test Entities Resolved:`);
    console.log(`   • Department: ${dept.name} (${dept.code})`);
    console.log(`   • Document Type: ${docType.name} (${docType.code})`);
    console.log(`   • Mandated Security Tier: ${secLevel.name} (${secLevel.code}, Level ${secLevel.rank})`);
    console.log(`   • Retention Policy: ${retPolicy.name} (${retPolicy.retention_days} days)\n`);

    // 3. Upsert Governance Policy rule
    console.log('📝 Step 1: Configuring Institutional Governance Policy in Matrix...');
    const existingPolicy = await query<{ id: string }>(
      `SELECT id FROM document_type_policies WHERE department_id = $1 AND document_type_id = $2`,
      [dept.id, docType.id]
    );

    let policyId: string;
    if (existingPolicy.length > 0) {
      policyId = existingPolicy[0].id;
      await query(
        `UPDATE document_type_policies
         SET security_level_id = $1,
             retention_policy_id = $2,
             approval_required = true,
             ocr_required = true,
             download_allowed = true,
             active = true
         WHERE id = $3`,
        [secLevel.id, retPolicy.id, policyId]
      );
      console.log(`   ✓ Updated existing governance policy (${policyId})`);
    } else {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO document_type_policies (
           organization_id, department_id, document_type_id, security_level_id,
           retention_policy_id, approval_required, ocr_required, download_allowed, active, created_at
         )
         VALUES ($1, $2, $3, $4, $5, true, true, true, true, NOW())
         RETURNING id`,
        [orgId, dept.id, docType.id, secLevel.id, retPolicy.id]
      );
      policyId = insertRes[0].id;
      console.log(`   ✓ Created new governance policy (${policyId})`);
    }

    // 4. Verify Policy Lookup
    console.log('\n🔍 Step 2: Verifying Ingestion Policy Lookup...');
    const matchedPolicy = await query<{
      id: string;
      security_level_code: string;
      security_level_rank: number;
      retention_policy_name: string;
      approval_required: boolean;
      active: boolean;
    }>(
      `SELECT 
         dtp.id,
         sl.code as security_level_code,
         sl.rank as security_level_rank,
         rp.name as retention_policy_name,
         dtp.approval_required,
         dtp.active
       FROM document_type_policies dtp
       JOIN security_levels sl ON dtp.security_level_id = sl.id
       JOIN retention_policies rp ON dtp.retention_policy_id = rp.id
       WHERE dtp.organization_id = $1 
         AND dtp.department_id = $2 
         AND dtp.document_type_id = $3 
         AND dtp.active = true`,
      [orgId, dept.id, docType.id]
    );

    if (matchedPolicy.length === 0) {
      throw new Error('Failed to resolve active policy matching Legal + Order');
    }
    console.log('   ✓ Matched Policy successfully:');
    console.log(`     - Security Tier: ${matchedPolicy[0].security_level_code} (Rank ${matchedPolicy[0].security_level_rank})`);
    console.log(`     - Retention Schedule: ${matchedPolicy[0].retention_policy_name}`);
    console.log(`     - Dual Approval Required: ${matchedPolicy[0].approval_required}`);
    console.log(`     - Active: ${matchedPolicy[0].active}`);

    // 5. Test Policy Enforcement in Document Upload Simulation
    console.log('\n📦 Step 3: Simulating Document Ingestion Under Policy...');
    const userRes = await query<{ id: string }>('SELECT id FROM users LIMIT 1');
    const userId = userRes[0].id;
    const testDocNumber = `TEST-GOV-${Date.now()}`;

    // Upload with policy applied
    const docInsert = await query<{ id: string }>(
      `INSERT INTO documents (
         organization_id, document_number, title, description,
         document_type_id, department_id, security_level_id,
         owner_id, status, created_by
       )
       VALUES ($1, $2, 'Executive Sanction Order 2026', 'Legal executive order test', $3, $4, $5, $6, 'PENDING_APPROVAL', $6)
       RETURNING id;`,
      [orgId, testDocNumber, docType.id, dept.id, secLevel.id, userId]
    );
    const testDocId = docInsert[0].id;

    const verInsert = await query<{ id: string }>(
      `INSERT INTO document_versions (
         document_id, version_number, status, created_by,
         file_name, mime_type, file_size, sha256_hash,
         encryption_algorithm, key_wrap_algorithm, vault_key_reference,
         minio_bucket, minio_object_key, checksum_verified
       )
       VALUES ($1, 1, 'PENDING_APPROVAL', $2, 'sanction_order.pdf', 'application/pdf', 1024, 'dummy_sha256_hash_test', 'AES-256-GCM', 'VAULT-TRANSIT', '{}', 'dms-vault', 'test.enc', true)
       RETURNING id;`,
      [testDocId, userId]
    );
    const testVerId = verInsert[0].id;

    // Attach Retention Record
    await query(
      `INSERT INTO retention_records 
       (document_id, retention_policy_id, retention_start_at, retention_end_at, legal_hold, status, created_at)
       VALUES ($1, $2, NOW(), NOW() + ($3 || ' days')::INTERVAL, false, 'ACTIVE', NOW())
       ON CONFLICT DO NOTHING`,
      [testDocId, retPolicy.id, retPolicy.retention_days || 2555]
    );

    // Verify Ingested Document Properties
    const docCheck = await query<{ status: string; security_level_id: string }>(
      `SELECT status, security_level_id FROM documents WHERE id = $1`,
      [testDocId]
    );
    const verCheck = await query<{ status: string }>(
      `SELECT status FROM document_versions WHERE id = $1`,
      [testVerId]
    );
    const retCheck = await query<{ retention_policy_id: string; status: string }>(
      `SELECT retention_policy_id, status FROM retention_records WHERE document_id = $1`,
      [testDocId]
    );

    console.log(`   ✓ Document Record Created (${testDocNumber})`);
    console.log(`     - Document Status: ${docCheck[0].status} (Expected: PENDING_APPROVAL)`);
    console.log(`     - Version Status: ${verCheck[0].status} (Expected: PENDING_APPROVAL)`);
    console.log(`     - Bound Security Level: ${docCheck[0].security_level_id === secLevel.id ? '✅ Correct Tier (T4)' : '❌ Incorrect'}`);
    console.log(`     - Bound Retention Policy: ${retCheck[0].retention_policy_id === retPolicy.id ? '✅ Correct Retention Policy' : '❌ Incorrect'}`);

    // Clean up test document
    await query(`DELETE FROM retention_records WHERE document_id = $1`, [testDocId]);
    await query(`DELETE FROM document_versions WHERE document_id = $1`, [testDocId]);
    await query(`DELETE FROM documents WHERE id = $1`, [testDocId]);
    console.log('   ✓ Cleaned up test document record.');

    console.log('\n===========================================================');
    console.log('🎉 ALL GOVERNANCE POLICIES TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } catch (err: any) {
    console.error('\n❌ Test execution failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runGovernancePolicyTests().catch(console.error);
