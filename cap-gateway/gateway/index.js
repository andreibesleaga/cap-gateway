/**
 * API Gateway process: cote requesters + the Express app over HTTP (HTTPS when NODE_ENV=production)
 */
import { createServer } from 'https';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createStream } from 'rotating-file-stream';
import logger from './logger.js';
import { createApp } from './app.js';
import { createRequester } from './mesh.js';
import { ENV, APP_URL, APP_PORT, ACCESS_LOGS_DIR } from './constants.js';

let accessLogStream;
if (ACCESS_LOGS_DIR) {
  const logDir = resolve(ACCESS_LOGS_DIR);
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  accessLogStream = createStream('access.log', { path: logDir });
}

// one requester per route; cote balances its requests round-robin over the connected responders
const app = createApp({
  capRequester: createRequester('cap_requester_translate'),
  adminRequester: createRequester('admin_requester_pubsub'),
  accessLogStream,
});

if (ENV === 'production') {
  const certDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const key = readFileSync(join(certDir, 'key.pem'));
  const cert = readFileSync(join(certDir, 'cert.pem'));
  createServer({ key, cert }, app).listen(APP_PORT, () =>
    logger.info(`API Gateway listening HTTPS at ${APP_URL}:${APP_PORT}`)
  );
} else {
  app.listen(APP_PORT, () => logger.info(`API Gateway listening at ${APP_URL}:${APP_PORT}`));
}
