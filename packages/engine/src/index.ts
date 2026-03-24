import './api/server.js';
import { createWorker } from './queue/worker.js';

const worker = createWorker();
worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));

if (process.argv.includes('--mcp')) {
  import('./mcp/index.js').then(({ startMcpServer }) => startMcpServer());
}
