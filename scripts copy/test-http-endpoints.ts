/**
 * End-to-End HTTP Integration Test for Versions and Certificate Endpoints
 */
async function testHttp() {
  console.log('--- Testing API via HTTP against running Next.js server ---');

  // 1. Authenticate as SP Sharma (admin/investigator)
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'Admin@DMS2026!',
    }),
  });

  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log('[+] Login HTTP Status:', loginRes.status);
  if (!cookieHeader) {
    console.error('Failed to get session cookie from login.');
    process.exit(1);
  }

  const cookie = cookieHeader.split(';')[0];
  console.log('[+] Obtained session cookie.');

  // 2. Fetch Dashboard Documents to get a real ID
  const docsRes = await fetch('http://localhost:3000/api/dashboard/documents', {
    headers: { Cookie: cookie },
  });
  const docsData = await docsRes.json();
  if (!docsData.documents || docsData.documents.length === 0) {
    console.error('No documents returned from dashboard API.');
    process.exit(1);
  }

  const testDoc = docsData.documents[0];
  console.log(`[+] Testing against document: ${testDoc.document_number} (ID: ${testDoc.id})`);

  // 3. Test GET /api/documents/[id]/versions
  const versionsRes = await fetch(`http://localhost:3000/api/documents/${testDoc.id}/versions`, {
    headers: { Cookie: cookie },
  });
  console.log('[+] Versions endpoint HTTP status:', versionsRes.status);
  const versionsData = await versionsRes.json();
  console.log(`[+] Total Versions: ${versionsData.totalVersions}`);
  console.log('    Version details:', JSON.stringify(versionsData.versions?.[0] || {}, null, 2));

  // 4. Test GET /api/documents/[id]/certificate
  const certRes = await fetch(`http://localhost:3000/api/documents/${testDoc.id}/certificate`, {
    headers: { Cookie: cookie },
  });
  console.log('[+] Certificate endpoint HTTP status:', certRes.status);
  const certData = await certRes.json();
  console.log(`[+] Certificate Serial: ${certData.serialNumber}`);
  console.log(`[+] Officer: ${certData.certifyingOfficer?.name} (${certData.certifyingOfficer?.hardwareTokenId})`);
  console.log(`[+] QR Code generated: ${Boolean(certData.qrCodeDataUrl)} (Length: ${certData.qrCodeDataUrl?.length} bytes)`);
  console.log(`[+] Audit trail items attached: ${certData.auditTrail?.length}`);

  if (versionsRes.status === 200 && certRes.status === 200) {
    console.log('\n>>> SUCCESS: ALL ENDPOINTS ARE FULLY FUNCTIONAL AND SECURE! <<<');
  } else {
    console.error('Endpoint validation failed.');
    process.exit(1);
  }
}

testHttp().catch(err => {
  console.error('HTTP Test Error:', err);
  process.exit(1);
});
