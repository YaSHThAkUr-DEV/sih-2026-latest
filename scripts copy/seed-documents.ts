import { Client } from 'pg';
import crypto from 'crypto';

async function seedDocuments() {
  console.log('--- Seeding Realistic Enterprise Documents into PostgreSQL ---');
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'dms_db',
  });

  await client.connect();

  try {
    // 1. Get organization
    const orgRes = await client.query('SELECT id FROM organizations LIMIT 1');
    if (orgRes.rows.length === 0) {
      throw new Error('No organization found. Please run base seed first.');
    }
    const orgId = orgRes.rows[0].id;

    // 2. Get departments
    const deptsRes = await client.query('SELECT id, code, name FROM departments WHERE organization_id = $1', [orgId]);
    const depts = deptsRes.rows;
    if (depts.length === 0) {
      throw new Error('No departments found.');
    }

    // 3. Get users
    const usersRes = await client.query('SELECT id, full_name, designation, department_id FROM users WHERE organization_id = $1', [orgId]);
    const users = usersRes.rows;

    // 4. Get doc types and security levels
    const typesRes = await client.query('SELECT id, code FROM document_types WHERE organization_id = $1', [orgId]);
    const docTypes = typesRes.rows;

    const secRes = await client.query('SELECT id, code FROM security_levels ORDER BY rank ASC');
    const secLevels = secRes.rows;

    // Clear existing demo documents to ensure clean seed
    await client.query('DELETE FROM document_versions');
    await client.query('DELETE FROM documents WHERE organization_id = $1', [orgId]);

    const sampleDocs = [
      {
        title: 'Q3 Consolidated Financial & Audit Statement',
        deptCode: 'FINANCE',
        fileName: 'Q3_Financial_Consolidated_Audit.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 48250000, // ~46 MB
        secCode: 'T4',
        typeCode: 'OM',
        description: 'Comprehensive quarterly corporate balance sheet, ledger attestations, and certified tax schedules.',
      },
      {
        title: 'Enterprise Master Cloud Service Level Agreement (SLA)',
        deptCode: 'LEGAL',
        fileName: 'Global_Master_Cloud_Agreement_v4.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSizeBytes: 12400000, // ~11.8 MB
        secCode: 'T3',
        typeCode: 'POLICY',
        description: 'Multi-jurisdictional vendor and customer service agreement with automated liability safeguards.',
      },
      {
        title: 'Global Information Security & Zero-Trust Governance Policy',
        deptCode: 'ADMIN',
        fileName: 'Global_InfoSec_ZeroTrust_2026.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 28900000, // ~27.5 MB
        secCode: 'T5',
        typeCode: 'POLICY',
        description: 'Organizational standard for AES-256-GCM hardware key storage, role hierarchy, and breach protocols.',
      },
      {
        title: 'Platform Infrastructure Architecture & Disaster Recovery Manual',
        deptCode: 'SERVICES',
        fileName: 'Platform_Architecture_Topology_2026.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 38400000, // ~36.6 MB
        secCode: 'T3',
        typeCode: 'CIRCULAR',
        description: 'Complete container topology, Kubernetes cluster scaling guidelines, and cold-standby failover instructions.',
      },
      {
        title: 'Annual Statutory Records Archival Schedule & Retention Directives',
        deptCode: 'RECORDS',
        fileName: 'Statutory_Records_Retention_Directives_2026.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 18700000, // ~17.8 MB
        secCode: 'T2',
        typeCode: 'OM',
        description: 'Cryptographic time-lock rules and legal hold protocols for statutory corporate documentation.',
      },
      {
        title: 'Fiscal Year 2026-2027 Capital Budget Allocation Matrix',
        deptCode: 'FINANCE',
        fileName: 'FY2026_Capital_Budget_Projections.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSizeBytes: 8200000, // ~7.8 MB
        secCode: 'T3',
        typeCode: 'OM',
        description: 'Departmental operational expenditure forecasts, hardware procurement reserves, and runway models.',
      },
      {
        title: 'Regulatory Data Protection & Privacy Impact Assessment (DPIA)',
        deptCode: 'LEGAL',
        fileName: 'Regulatory_Privacy_Assessment_DPIA.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 15300000, // ~14.5 MB
        secCode: 'T4',
        typeCode: 'POLICY',
        description: 'Cross-border telemetry data flow audit and consumer data encryption certification.',
      },
      {
        title: 'Public Redressal & Citizen Charter Service Guidelines',
        deptCode: 'SERVICES',
        fileName: 'Public_Grievance_Standard_Protocols.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 9400000, // ~8.9 MB
        secCode: 'T1',
        typeCode: 'CIRCULAR',
        description: 'Standard operating procedure for tier-1 customer inquiries, turnaround benchmarks, and escalations.',
      }
    ];

    for (let i = 0; i < sampleDocs.length; i++) {
      const docData = sampleDocs[i];
      const dept = depts.find(d => d.code === docData.deptCode) || depts[i % depts.length];
      const user = users.find(u => u.department_id === dept.id) || users[0];
      const docType = docTypes.find(t => t.code === docData.typeCode) || docTypes[0];
      const secLevel = secLevels.find(s => s.code === docData.secCode) || secLevels[0];

      const docNumber = `DMS-${dept.code}-2026-00${i + 1}`;
      const sha256 = crypto.createHash('sha256').update(docData.title + docNumber).digest('hex');

      // 1. Insert Document
      const docRes = await client.query(
        `INSERT INTO documents (
           organization_id, document_number, title, description,
           document_type_id, department_id, security_level_id,
           owner_id, status, created_by, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, NOW() - ($10 || ' hours')::INTERVAL, NOW())
         RETURNING id`,
        [
          orgId,
          docNumber,
          docData.title,
          docData.description,
          docType.id,
          dept.id,
          secLevel.id,
          user.id,
          user.id,
          (i * 12) + 2
        ]
      );
      const docId = docRes.rows[0].id;

      // 2. Insert Document Version
      const verRes = await client.query(
        `INSERT INTO document_versions (
           document_id, version_number, status, created_by,
           file_name, mime_type, file_size, sha256_hash,
           encryption_algorithm, key_wrap_algorithm, vault_key_reference,
           minio_bucket, minio_object_key, checksum_verified, created_at
         )
         VALUES (
           $1, 1, 'ACTIVE', $2,
           $3, $4, $5, $6,
           'AES-256-GCM', 'RSA-OAEP', '{"kmsProvider":"INTERNAL_VAULT"}',
           'enterprise-documents', $7, true, NOW() - ($8 || ' hours')::INTERVAL
         )
         RETURNING id`,
        [
          docId,
          user.id,
          docData.fileName,
          docData.mimeType,
          docData.fileSizeBytes,
          sha256,
          `vault/${docNumber}/${docData.fileName}`,
          (i * 12) + 2
        ]
      );
      const verId = verRes.rows[0].id;

      // 3. Link current version
      await client.query('UPDATE documents SET current_version_id = $1 WHERE id = $2', [verId, docId]);
    }

    console.log(`✅ Successfully seeded ${sampleDocs.length} enterprise documents with real byte sizes into PostgreSQL!`);
  } catch (err) {
    console.error('Seed documents failed:', err);
  } finally {
    await client.end();
  }
}

seedDocuments();
