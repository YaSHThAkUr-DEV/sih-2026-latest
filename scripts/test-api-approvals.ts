import { createSessionToken } from '../lib/auth/jwt';
import { query, pool } from '../lib/db';

async function testApiPending() {
  const users = await query<any>("SELECT id, username, email, organization_id FROM users WHERE username = 'depthead'");
  const deptHead = users[0];

  const token = await createSessionToken({
    userId: deptHead.id,
    username: deptHead.username,
    email: deptHead.email,
    fullName: 'Dr. Ananya Roy',
    organizationId: deptHead.organization_id,
    organizationCode: 'CIB',
    organizationName: 'Central Investigation Bureau',
    departmentId: null,
    roles: ['DEPT_HEAD'],
    permissions: ['DOCUMENT_APPROVE_CHANGE', 'DOCUMENT_VIEW'],
  });

  const res = await fetch('http://localhost:3000/api/approvals/pending', {
    headers: {
      Cookie: `dms_session=${token}`,
    },
  });

  if (res.ok) {
    const data = await res.json();
    console.log('✅ GET /api/approvals/pending HTTP 200 OK');
    console.log(`Pending Requests: ${data.count}`);
    console.log('First request sample:', JSON.stringify(data.requests[0], null, 2));
  } else {
    console.log(`API response status: ${res.status}`);
  }

  await pool.end();
  process.exit(0);
}

testApiPending().catch((err) => {
  console.log('API call test note:', err.message);
  process.exit(0);
});
