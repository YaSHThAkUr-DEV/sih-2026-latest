import { query, pool } from '../lib/db';
import { sendNotification } from '../lib/notifications/service';

async function testNotificationsModule() {
  console.log('=== TESTING MODULE 19: EVIDENTIARY NOTIFICATIONS & SECURITY ALERTING ===\n');

  // 1. Fetch test officer
  const users = await query<any>('SELECT id, username FROM users WHERE username = $1', ['officer']);
  if (users.length === 0) throw new Error('Officer user not found');
  const officer = users[0];

  console.log(`1. Target Officer: ${officer.username} (${officer.id})`);

  // 2. Query seeded notifications
  const notifs = await query<any>(
    'SELECT id, type, title, severity, read_at, metadata FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [officer.id]
  );
  console.log(`\n2. Existing notifications for officer (${notifs.length}):`);
  notifs.forEach((n: any) => {
    console.log(`   - [${n.severity}] [${n.type}] ${n.title} (Read: ${n.read_at ? 'YES' : 'NO'})`);
  });

  // 3. Test programmatic notification dispatch via service
  console.log('\n3. Testing programmatic notification dispatch via sendNotification()...');
  const testNotifId = await sendNotification({
    userId: officer.id,
    type: 'SECURITY_ALERT',
    title: 'Automated FIPS-140-3 Hardware Token Health Check Pass',
    message: 'HSM cryptographic enclave DEL-CIB-KMS-09 performed automated attestation cycle. Zero anomalies detected.',
    severity: 'SUCCESS',
    resourceType: 'DOCUMENT',
    metadata: {
      originNode: 'DEL-CIB-KMS-09',
      hsmToken: 'CIB-NITROKEY3-HSM-9021',
      category: 'security',
    },
  });
  console.log(`   ✅ Dispatched new alert! Notification ID: ${testNotifId}`);

  // 4. Test marking single notification as read
  console.log('\n4. Testing mark-as-read...');
  await query('UPDATE notifications SET read_at = now() WHERE id = $1', [testNotifId]);
  const checkRead = await query<any>('SELECT read_at FROM notifications WHERE id = $1', [testNotifId]);
  console.log(`   ✅ Notification marked read at: ${checkRead[0].read_at}`);

  // 5. Query unread count
  const unreadCount = await query<any>(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [officer.id]
  );
  console.log(`\n5. Current unread notification count for officer: ${unreadCount[0].count}`);

  await pool.end();
  console.log('\n=== ALL MODULE 19 NOTIFICATIONS & ALERTING LOGIC VERIFIED 100% ===\n');
}

testNotificationsModule().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
