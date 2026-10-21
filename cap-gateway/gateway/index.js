/**
 * RESTful API Gateway - Express HTTP(S) server that routes requests to the cote responders
 */
import express, { json, urlencoded } from 'express';
import compression from 'compression';
import morgan from 'morgan';
import helmet from 'helmet';
import { createServer } from 'https';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createStream } from 'rotating-file-stream';
import logger from './logger.js';

import { registerAdminCalls } from './controllers/admin.js';
import { registerCapCalls } from './controllers/cap.js';
import { ENV, APP_URL, APP_PORT, ACCESS_LOGS_DIR, HTTP_CODE } from './constants.js';

const app = express();

app.use(helmet());
app.use(compression());
app.use(json());
app.use(urlencoded({ extended: true, parameterLimit: 10 }));

// access log (rotating file) when a log directory is configured
if (ACCESS_LOGS_DIR) {
  const logDir = resolve(ACCESS_LOGS_DIR);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  const accessLogStream = createStream('access.log', { path: logDir });
  app.use(
    morgan(
      ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms - :total-time ms',
      { stream: accessLogStream }
    )
  );
}

// routes
registerAdminCalls(app);
registerCapCalls(app);

// anything else
app.use((req, res) => res.status(HTTP_CODE.NotFound).json({ error: 'Not found' }));

// HTTPS in production (cap-gateway/key.pem and cap-gateway/cert.pem), plain HTTP otherwise
if (ENV === 'production') {
  const certDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const key = readFileSync(join(certDir, 'key.pem'));
  const cert = readFileSync(join(certDir, 'cert.pem'));
  createServer({ key, cert }, app).listen(APP_PORT, () => {
    logger.info(`API Gateway listening HTTPS at ${APP_URL}:${APP_PORT}`);
  });
} else {
  app.listen(APP_PORT, () => {
    logger.info(`API Gateway listening at ${APP_URL}:${APP_PORT}`);
  });
}
