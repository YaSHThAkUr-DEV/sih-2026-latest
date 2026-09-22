import { pool, query } from '../lib/db';

async function seedApproval() {
  const orgs = await query<any>('SELECT id FROM organizations LIMIT 1');
  const users = await query<any>('SELECT id, username FROM users');
  const officer = users.find((u) => u.username === 'officer') || users[0];
  const deptHead = users.find((u) => u.username === 'depthead') || users[1];
  const depts = await query<any>('SELECT id FROM departments LIMIT 1');
  const docTypes = await query<any>('SELECT id FROM document_types LIMIT 1');
  const t4 = await query<any>("SELECT id FROM security_levels WHERE code = 'T4'");

  const suffix = Date.now().toString().slice(-4);
  const docNumber = `CIB-EVID-2026-${suffix}`;

  const docRes = await query<any>(
    `INSERT INTO documents (
       organization_id, department_id, document_type_id, security_level_id,
       document_number, title, description, status, owner_id, created_by
     )
     VALUES ($1, $2, $3, $4, $5, 'Offshore Cold Storage Key Ledger', 
             'Seized primary cryptocurrency wallet ledger with multi-sig escrow evidence', 
             'ACTIVE', $6, $6)
     RETURNING id;`,
    [orgs[0].id, depts[0].id, docTypes[0].id, t4[0].id, docNumber, officer.id]
  );
  const docId = docRes[0].id;

  const v1Res = await query<any>(
    `INSERT INTO document_versions (
       document_id, version_number, status, created_by,
       file_name, mime_type, file_size, sha256_hash,
       encryption_algorithm, key_wrap_algorithm, vault_key_reference,
       minio_bucket, minio_object_key, checksum_verified
     )
     VALUES ($1, 1, 'ACTIVE', $2, 'wallet_ledger_v1.pdf', 'application/pdf', 24512,
             'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
             'AES-256-GCM', 'VAULT_TRANSIT', '{"kmsProvider":"VAULT_TRANSIT"}',
             'dms-documents', $3, true)
     RETURNING id;`,
    [docId, officer.id, `vault/${docNumber}/v1.pdf.enc`]
  );
  const v1Id = v1Res[0].id;

  await query('UPDATE documents SET current_version_id = $1 WHERE id = $2', [v1Id, docId]);

  const v2Res = await query<any>(
    `INSERT INTO document_versions (
       document_id, version_number, status, created_by,
       file_name, mime_type, file_size, sha256_hash,
       encryption_algorithm, key_wrap_algorithm, vault_key_reference,
       minio_bucket, minio_object_key, checksum_verified
     )
     VALUES ($1, 2, 'PENDING_APPROVAL', $2, 'wallet_ledger_v2_supplementary.pdf', 'application/pdf', 31200,
             'e5f6a1b2c3d40718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
             'AES-256-GCM', 'VAULT_TRANSIT', '{"kmsProvider":"VAULT_TRANSIT"}',
             'dms-documents', $3, true)
     RETURNING id;`,
    [docId, officer.id, `vault/${docNumber}/v2.pdf.enc`]
  );
  const v2Id = v2Res[0].id;

  await query(
    `INSERT INTO change_requests (
       document_id, original_version_id, proposed_version_id, requested_by, assigned_approver_id, reason, status
     )
     VALUES ($1, $2, $3, $4, $5, 
             'Supplementary forensic recovery of 12-word seed phrase and hardware device serial numbers.', 
             'PENDING');`,
    [docId, v1Id, v2Id, officer.id, deptHead.id]
  );

  console.log('✅ Successfully seeded live pending change request for CIB-EVID-2026-0089 in the Approval Queue!');
  await pool.end();
}

seedApproval().catch((err) => {
  console.error(err);
  process.exit(1);
});
