// Validate required env vars before any connection is attempted
const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'OPENROUTER_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required env var: ${key}`);
    process.exit(1);
  }
}

if (process.argv.includes('--mcp')) {
  const { startMcpServer } = await import('./mcp/index.js');
  startMcpServer();
} else {
  // Dynamic imports so env validation runs first (static imports are hoisted in ESM)
  const { server } = await import('./api/server.js');
  const { createWorker } = await import('./queue/worker.js');
  const { getQueue } = await import('./queue/index.js');

  const worker = createWorker();
  worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
  worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));

  async function gracefulShutdown(signal: string) {
    console.log(`[shutdown] ${signal} received`);
    server.close(async () => {
      await worker.close();
      await getQueue().close();
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
}
