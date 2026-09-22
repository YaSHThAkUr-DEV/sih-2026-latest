// =============================================================================
// Blockchain RBAC Permissions Migration
// =============================================================================
// Adds BLOCKCHAIN_VIEW, BLOCKCHAIN_ANCHOR, and BLOCKCHAIN_VERIFY permissions
// to the permissions table and assigns them to roles.
// =============================================================================

import { query, pool } from '../lib/db';

async function migrateBlockchainPermissions() {
  console.log('--- Migrating Blockchain RBAC Permissions ---');

  const blockchainPerms = [
    {
      code: 'BLOCKCHAIN_VIEW',
      description: 'View immutable blockchain ledger, transaction receipts, and node topology',
    },
    {
      code: 'BLOCKCHAIN_ANCHOR',
      description: 'Anchor document hashes and forensic attestations to blockchain ledger',
    },
    {
      code: 'BLOCKCHAIN_VERIFY',
      description: 'Perform cryptographic Merkle proof and ledger verifications',
    },
  ];

  try {
    for (const p of blockchainPerms) {
      const res = await query<{ id: string }>(
        `INSERT INTO permissions (code, description)
         VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description
         RETURNING id;`,
        [p.code, p.description]
      );
      console.log(`✓ Permission registered: ${p.code} (ID: ${res[0].id})`);
    }

    // Fetch all roles
    const roles = await query<{ id: string; code: string }>('SELECT id, code FROM roles;');
    const perms = await query<{ id: string; code: string }>(
      `SELECT id, code FROM permissions WHERE code IN ('BLOCKCHAIN_VIEW', 'BLOCKCHAIN_ANCHOR', 'BLOCKCHAIN_VERIFY');`
    );

    const permMap = Object.fromEntries(perms.map((p) => [p.code, p.id]));

    for (const role of roles) {
      if (role.code === 'SUPER_ADMIN' || role.code === 'ORG_ADMIN') {
        // Full blockchain access
        for (const pCode of ['BLOCKCHAIN_VIEW', 'BLOCKCHAIN_ANCHOR', 'BLOCKCHAIN_VERIFY']) {
          await query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [role.id, permMap[pCode]]
          );
        }
        console.log(`✓ Assigned all Blockchain permissions to [${role.code}]`);
      } else if (role.code === 'AUDITOR') {
        // Auditor gets View & Verify
        for (const pCode of ['BLOCKCHAIN_VIEW', 'BLOCKCHAIN_VERIFY']) {
          await query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [role.id, permMap[pCode]]
          );
        }
        console.log(`✓ Assigned BLOCKCHAIN_VIEW & BLOCKCHAIN_VERIFY to [AUDITOR]`);
      } else if (role.code === 'DEPT_HEAD' || role.code === 'INVESTIGATING_OFFICER') {
        // Department Head & Officer get View & Verify
        for (const pCode of ['BLOCKCHAIN_VIEW', 'BLOCKCHAIN_VERIFY']) {
          await query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [role.id, permMap[pCode]]
          );
        }
        console.log(`✓ Assigned BLOCKCHAIN_VIEW & BLOCKCHAIN_VERIFY to [${role.code}]`);
      }
    }

    console.log('✅ Blockchain RBAC migration successfully completed!');
  } catch (err: any) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrateBlockchainPermissions().catch(console.error);
