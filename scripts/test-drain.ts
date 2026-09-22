import fs from 'fs';
if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main() {
  const { JobRunner } = await import('../lib/jobs/jobRunner');
  const { JobQueueManager } = await import('../lib/jobs/queue');

  console.log('Running JobRunner.drainQueues()...');
  const result = await JobRunner.drainQueues(10);
  console.log('DRAIN RESULT:', JSON.stringify(result, null, 2));

  console.log('\nUpdated Queue Stats:');
  const stats = await JobQueueManager.getQueueStats();
  console.log('STATS:', JSON.stringify(stats, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error('Error in drain-test:', err);
  process.exit(1);
});
