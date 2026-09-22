import { query, pool } from '../lib/db';

async function seedRetentionPolicies() {
  console.log('--- Seeding Generic Institutional Retention Policies ---');

  // 1. Get organization
  const orgs = await query<{ id: string }>('SELECT id FROM organizations LIMIT 1');
  if (orgs.length === 0) {
    throw new Error('No organization found.');
  }
  const orgId = orgs[0].id;

  const policies = [
    {
      name: '3-Year Routine Administrative Directives & Notices',
      schedule_code: 'SCHEDULE_I',
      retention_days: 1095,
      permanent: false,
      deletion_requires_approval: false,
      action_on_expiry: 'Automatic Archive / Optional Disposal',
      statutory_framework: 'Administrative Records Guidelines 2026',
      description: 'Routine circulars, office notices, internal communications, and low-priority records.',
    },
    {
      name: '7-Year Financial Statements & Audit Schedules',
      schedule_code: 'SCHEDULE_II',
      retention_days: 2555,
      permanent: false,
      deletion_requires_approval: true,
      action_on_expiry: 'Maker-Checker Review & Cryptographic Zeroization',
      statutory_framework: 'Statutory Finance & Tax Retention Directive',
      description: 'Quarterly balance sheets, ledger attestations, procurement invoices, and budget allocations.',
    },
    {
      name: '10-Year Executive Sanctions & Contracts',
      schedule_code: 'SCHEDULE_III',
      retention_days: 3650,
      permanent: false,
      deletion_requires_approval: true,
      action_on_expiry: 'Department Head Review & Purge Approval',
      statutory_framework: 'Institutional Governance Code',
      description: 'Service level agreements, legal contracts, vendor partnerships, and executive authorisations.',
    },
    {
      name: '30-Year Statutory Compliance & Inspection Reports',
      schedule_code: 'SCHEDULE_IV',
      retention_days: 10950,
      permanent: false,
      deletion_requires_approval: true,
      action_on_expiry: 'Comprehensive Archival Review',
      statutory_framework: 'Public Records & Archives Act',
      description: 'Regulatory compliance assessments, privacy audits, and environmental or statutory certifications.',
    },
    {
      name: 'Permanent Deeds, Titles & Sovereign Records',
      schedule_code: 'SCHEDULE_PERM',
      retention_days: null,
      permanent: true,
      deletion_requires_approval: true,
      action_on_expiry: 'Permanent Custody Sealed (Zero Deletion Allowed)',
      statutory_framework: 'Permanent National Archives & Title Registry',
      description: 'Land mutation titles, foundational institutional policies, constitution charters, and permanent gazettes.',
    },
  ];

  for (const p of policies) {
    await query(
      `INSERT INTO retention_policies 
       (organization_id, name, schedule_code, retention_days, permanent, deletion_requires_approval, action_on_expiry, statutory_framework, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        orgId,
        p.name,
        p.schedule_code,
        p.retention_days,
        p.permanent,
        p.deletion_requires_approval,
        p.action_on_expiry,
        p.statutory_framework,
        p.description,
      ]
    );
  }

  const count = await query<{ count: string }>('SELECT COUNT(*) as count FROM retention_policies WHERE organization_id = $1', [orgId]);
  console.log(`✅ Successfully seeded ${count[0].count} statutory retention policies!`);

  await pool.end();
  process.exit(0);
}

seedRetentionPolicies().catch((err) => {
  console.error('Failed to seed retention policies:', err);
  process.exit(1);
});
