/**
 * RESTful API Gateway Express Microservice
 */
/* eslint-disable no-unused-vars */

// import required
import dotenv from 'dotenv';
import express, { json, urlencoded } from 'express';
import compression from 'compression';
import morgan from 'morgan';
import helmet from 'helmet';
import { createServer } from 'https';
import logger from './logger.js';

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as path from 'path';
import { createStream } from 'rotating-file-stream';

// import controllers for microservices
import { registerAdminCalls } from './controllers/admin.js';
import { registerCapCalls } from './controllers/cap.js';

// read config values
dotenv.config({ silent: process.env.NODE_ENV === 'production' });
const { APP_URL, APP_PORT, ACCESS_LOGS_DIR } = process.env;

// setup server
const app = express();

// HTTPS server settings (keys if in production and HTTPS mode)
let httpsServer = null;
if (process.env.NODE_ENV === 'production') {
  const key = readFileSync('../key.pem');
  const cert = readFileSync('../cert.pem');
  httpsServer = createServer({ key, cert }, app);
}

// All other server modules and options
app.use(helmet());
app.use(compression());
app.use(json());
app.use(urlencoded({ extended: true, parameterLimit: 10 }));

// web server access-logs - create logs in the log directory if config setting exists in .env
if (ACCESS_LOGS_DIR) {
  if (!existsSync(ACCESS_LOGS_DIR)) {
    mkdirSync(ACCESS_LOGS_DIR, { recursive: true });
  }
  const dirname = path.resolve();
  const accessLogStream = createStream('access.log', { path: join(dirname, ACCESS_LOGS_DIR)});
  app.use( 
    morgan(
      ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms - :total-time ms',
      { stream: accessLogStream }
    )
  );
}


// register microservices endpoints
registerAdminCalls(app);
registerCapCalls(app);

// redirect all unknown endpoints to /
function redirectUnmatched(req, res) {
  res.redirect(APP_URL);
}
app.use(redirectUnmatched);

// run HTTP(S) server local/production
if (process.env.NODE_ENV === 'production') {
  httpsServer.listen(APP_PORT, () => {
    logger.info(`API Gateway listening HTTPS at ${APP_URL}:${APP_PORT}`);
  });
} else {
  app.listen(APP_PORT, () => {
    logger.info(`API Gateway listening at ${APP_URL}:${APP_PORT}`);
  });
}
