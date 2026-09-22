import fs from 'fs';
if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main() {
  const { JobQueueManager } = await import('../lib/jobs/queue');
  const { query } = await import('../lib/db');

  console.log('===========================================================');
  console.log('🚀 TESTING ASYNCHRONOUS JOB QUEUE AUTO-DISPATCH & WORKERS');
  console.log('===========================================================');

  // 1. Enqueue test jobs across all 5 queues
  console.log('\n[1] Enqueuing test jobs across all 5 queues:');
  const q1 = await JobQueueManager.enqueue('ocr-queue', 'TEST_JOB', { benchmark: 'OCR Test' });
  console.log('  ✓ Enqueued OCR test job:', q1.id);

  const q2 = await JobQueueManager.enqueue('blockchain-queue', 'TEST_JOB', { benchmark: 'Fabric Anchor' });
  console.log('  ✓ Enqueued Blockchain test job:', q2.id);

  const q3 = await JobQueueManager.enqueue('notification-queue', 'TEST_JOB', { benchmark: 'Notification' });
  console.log('  ✓ Enqueued Notification test job:', q3.id);

  const q4 = await JobQueueManager.enqueue('retention-queue', 'RETENTION_AUDIT', { auditScope: 'SCHEDULE_ALL' });
  console.log('  ✓ Enqueued Retention Audit job:', q4.id);

  const q5 = await JobQueueManager.enqueue('cleanup-queue', 'TEST_JOB', { benchmark: 'Crypto Shred' });
  console.log('  ✓ Enqueued Cleanup test job:', q5.id);

  // 2. Wait 1.5 seconds for AutoJobRunner to asynchronously process
  console.log('\n[2] Waiting for AutoJobRunner to process all queues asynchronously...');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 3. Inspect PostgreSQL processing_jobs
  console.log('\n[3] Verifying PostgreSQL job states:');
  const jobIds = [q1.id, q2.id, q3.id, q4.id, q5.id];
  const dbRows = await query<any>(
    `SELECT id, job_type, status, attempts, error_message FROM processing_jobs WHERE id = ANY($1);`,
    [jobIds]
  );

  let allCompleted = true;
  for (const row of dbRows) {
    console.log(`  ✓ Job [${row.id.substring(0, 8)}...] Type: ${row.job_type.padEnd(22)} Status: ${row.status} (Attempts: ${row.attempts})`);
    if (row.status !== 'COMPLETED') {
      allCompleted = false;
    }
  }

  // 4. Inspect Redis queue stats
  console.log('\n[4] Redis Queue Stats:');
  const stats = await JobQueueManager.getQueueStats();
  console.log(JSON.stringify(stats, null, 2));

  if (allCompleted && stats.totals.waiting === 0) {
    console.log('\n🎉 ALL 5 QUEUES LINKED & FUNCTIONING AT 100% AUTOMATIC DISPATCH!');
  } else {
    console.error('\n⚠️ Some jobs did not finish. Waiting:', stats.totals.waiting);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
