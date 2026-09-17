/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool, query } from '../lib/db';
import {
  ensureOrganizationFeaturesSchema,
  updateOrganizationFeatures,
  MINIMAL_RECEIPTS_FEATURES,
} from '../lib/service/service-config';
import { provisionOfficeInstance } from '../lib/service/provisioning';
import { logAuditEvent } from '../lib/auth/audit';

async function runModularServiceTest() {
  console.log('===========================================================');
  console.log('🧪 TESTING MODULAR DMS-AS-A-SERVICE & USER PROFILES');
  console.log('===========================================================');

  try {
    // 1. Schema migration idempotency
    console.log('\n[TEST 1] Ensuring features JSONB column exists on organizations...');
    await ensureOrganizationFeaturesSchema();
    console.log('✓ Schema check passed.');

    // 2. Provisioning an on-demand office instance with minimal receipts profile
    const testOfficeCode = `TEST_OFFICE_${Date.now().toString().slice(-4)}`;
    console.log(`\n[TEST 2] Provisioning on-demand office instance [${testOfficeCode}]...`);
    
    // Clean up if already exists
    await query('DELETE FROM organizations WHERE code = $1;', [testOfficeCode]);

    const provisionResult = await provisionOfficeInstance({
      officeName: 'Palghar District Traffic Division (Testing Instance)',
      officeCode: testOfficeCode,
      officeDescription: 'Branch handling citizen traffic penalties and challan receipts',
      features: MINIMAL_RECEIPTS_FEATURES,
      departments: [
        { name: 'Revenue & Challan Processing', code: 'CHALLAN' },
        { name: 'Public Grievances & Inquiries', code: 'GRIEVANCE' },
      ],
      documentTypes: [
        { name: 'Traffic E-Challan Receipt', code: 'E_CHALLAN', description: 'Digital payment slip for vehicle violations' },
        { name: 'Treasury Challan Deposit', code: 'TREASURY_CHALLAN', description: 'Bank deposit receipt' },
      ],
      adminUser: {
        fullName: 'Inspector Vijay Patil',
        email: `vijay.patil.${testOfficeCode.toLowerCase()}@police.gov.in`,
        employeeCode: `${testOfficeCode}-ADM-01`,
        password: 'SecurePassword123!',
        designation: 'Traffic Division Incharge',
      },
    });

    console.log('✓ Office provisioned successfully:');
    console.log('   Org ID:', provisionResult.organization.id);
    console.log('   Org Code:', provisionResult.organization.code);
    console.log('   Admin User:', provisionResult.adminUser.fullName, `(${provisionResult.adminUser.email})`);
    console.log('   Document Classes:', provisionResult.documentTypesCount);
    console.log('   Features:', JSON.stringify(provisionResult.organization.features));

    if (
      provisionResult.organization.features.feature_approvals !== false ||
      provisionResult.organization.features.feature_section_65b !== false ||
      provisionResult.organization.features.feature_deep_ocr !== true
    ) {
      throw new Error('Feature flags were not correctly applied during provisioning!');
    }

    // 3. Verify Database Persistence of Document Types
    console.log('\n[TEST 3] Verifying custom document types registered in database...');
    const docTypes = await query<any>(
      'SELECT name, code FROM document_types WHERE organization_id = $1;',
      [provisionResult.organization.id]
    );
    console.log(`✓ Found ${docTypes.length} custom document types:`, docTypes.map((d) => d.code).join(', '));
    if (!docTypes.some((d) => d.code === 'E_CHALLAN')) {
      throw new Error('Expected custom document type E_CHALLAN was not found in database!');
    }

    // 4. Test Dynamic Feature Toggling
    console.log('\n[TEST 4] Testing dynamic feature toggling (enabling feature_approvals)...');
    const updatedFeatures = await updateOrganizationFeatures(provisionResult.organization.id, {
      feature_approvals: true,
    });
    console.log('✓ Features updated dynamically:');
    console.log('   feature_approvals:', updatedFeatures.feature_approvals);
    if (!updatedFeatures.feature_approvals) {
      throw new Error('Failed to toggle feature_approvals to true!');
    }

    // 5. Test Auditor User Activity Profile Recording & Ledger
    console.log('\n[TEST 5] Testing Auditor User Activity Dossier & Cryptographic Audit Event...');
    const adminUserId = provisionResult.adminUser.id;
    const orgId = provisionResult.organization.id;

    // Simulate several user actions
    await logAuditEvent({
      organizationId: orgId,
      actorId: adminUserId,
      eventType: 'USER_LOGIN',
      resourceType: 'AUTH',
      result: 'SUCCESS',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      metadata: { sessionEpoch: '2026.1' },
    });

    await logAuditEvent({
      organizationId: orgId,
      actorId: adminUserId,
      eventType: 'FILE_UPLOAD',
      resourceType: 'DOCUMENT',
      result: 'SUCCESS',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      metadata: { fileName: 'challan_march_2026.pdf', fileSize: 1048576 },
    });

    await logAuditEvent({
      organizationId: orgId,
      actorId: adminUserId,
      eventType: 'UNAUTHORIZED_ACCESS_DENIED',
      resourceType: 'EVIDENCE',
      result: 'DENIED',
      failureReason: 'Officer does not hold Top Secret clearance tier',
      ipAddress: '192.168.1.105',
      metadata: { attemptedTier: 'T5' },
    });

    // Query audit events for this specific user
    const userEvents = await query<any>(
      `SELECT id, event_type, result, ip_address, event_hash, created_at
       FROM audit_events 
       WHERE actor_id = $1 AND organization_id = $2
       ORDER BY created_at DESC;`,
      [adminUserId, orgId]
    );

    console.log(`✓ Retrieved ${userEvents.length} recorded audit events for officer [${provisionResult.adminUser.fullName}]:`);
    userEvents.forEach((ev) => {
      console.log(`   - [${ev.result}] ${ev.event_type} (IP: ${ev.ip_address}, Hash: ${ev.event_hash?.substring(0, 16)}...)`);
    });

    if (userEvents.length < 3) {
      throw new Error(`Expected at least 3 audit events for user, but found ${userEvents.length}`);
    }

    // Clean up test organization and data
    console.log('\n[TEST 6] Cleaning up test organization...');
    await query('DELETE FROM audit_events WHERE organization_id = $1;', [orgId]);
    await query('DELETE FROM user_roles WHERE user_id = $1;', [adminUserId]);
    await query('DELETE FROM users WHERE organization_id = $1;', [orgId]);
    await query('DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE organization_id = $1);', [orgId]);
    await query('DELETE FROM roles WHERE organization_id = $1;', [orgId]);
    await query('DELETE FROM document_types WHERE organization_id = $1;', [orgId]);
    await query('DELETE FROM security_levels WHERE organization_id = $1;', [orgId]);
    await query('DELETE FROM departments WHERE organization_id = $1;', [orgId]);
    await query('DELETE FROM organizations WHERE id = $1;', [orgId]);
    console.log('✓ Cleaned up test instance.');

    console.log('\n===========================================================');
    console.log('🎉 ALL MODULAR DMS-AS-A-SERVICE TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runModularServiceTest();
