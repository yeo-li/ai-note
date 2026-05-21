import { getConfig } from './config.js';
import { createAppServer } from './server.js';

const config = getConfig();
const server = createAppServer(config);

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info(`Received ${signal}. Shutting down server...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 5_000);

  forceExitTimer.unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);

    if (error) {
      console.error('Failed to shut down cleanly.', error);
      process.exit(1);
    }

    process.exit(0);
  });
}

server.on('error', (error) => {
  console.error('Failed to start server.', error);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.info(`AI Note server listening on http://${config.host}:${config.port}`);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
