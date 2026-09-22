import fs from 'fs';
if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main() {
  const { query } = await import('../lib/db');
  const { JobQueueManager } = await import('../lib/jobs/queue');

  console.log('Querying DB jobs...');
  const jobs = await query<any>('SELECT * FROM processing_jobs ORDER BY created_at DESC LIMIT 20');
  console.log('DB JOBS COUNT:', jobs.length);
  for (const j of jobs) {
    console.log(`[JOB] ID: ${j.id} | Type: ${j.job_type} | Status: ${j.status} | Attempts: ${j.attempts} | Created: ${j.created_at} | Error: ${j.error_message || 'None'}`);
  }

  console.log('\nQuerying Redis Queue Stats...');
  const stats = await JobQueueManager.getQueueStats();
  console.log('STATS:', JSON.stringify(stats, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error('Error running check-jobs:', err);
  process.exit(1);
});
