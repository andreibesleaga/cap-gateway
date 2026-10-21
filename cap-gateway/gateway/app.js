/**
 * Express application: middleware, routes and error handling. No network side effects, so it can be
 * tested in-process with fake requesters; index.js creates the real cote requesters and listens.
 */
import express, { json } from 'express';
import compression from 'compression';
import morgan from 'morgan';
import helmet from 'helmet';
import logger from './logger.js';
import { registerAdminCalls } from './controllers/admin.js';
import { registerCapCalls } from './controllers/cap.js';
import { connectedResponders } from './mesh.js';
import { BODY_LIMIT, Endpoints, HTTP_CODE } from './constants.js';

const ACCESS_LOG_FORMAT =
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms - :total-time ms';

export function createApp({ capRequester, adminRequester, accessLogStream } = {}) {
  const app = express();
  app.use(helmet());
  app.use(compression());
  if (accessLogStream) app.use(morgan(ACCESS_LOG_FORMAT, { stream: accessLogStream }));
  app.use(json({ limit: BODY_LIMIT }));

  // 200 when at least one translation responder is connected, 503 otherwise
  app.get(Endpoints.health, (req, res) => {
    const responders = connectedResponders(capRequester);
    res.status(responders ? HTTP_CODE.OK : HTTP_CODE.ServiceUnavailable).json({
      status: responders ? 'ok' : 'unavailable',
      responders,
    });
  });

  registerAdminCalls(app, adminRequester);
  registerCapCalls(app, capRequester);

  app.use((req, res) => res.status(HTTP_CODE.NotFound).json({ error: 'Not found' }));

  // body-parser errors (invalid JSON, body too large) and anything unexpected, always as JSON
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status >= 400 && err.status < 500 ? err.status : HTTP_CODE.ServerError;
    if (status === HTTP_CODE.ServerError) logger.error('unhandled error: %s', err.stack ?? err);
    const error =
      status === HTTP_CODE.PayloadTooLarge
        ? `Request body larger than ${BODY_LIMIT}`
        : status === HTTP_CODE.ServerError
          ? 'Internal error'
          : 'Malformed Request';
    res.status(status).json({ error });
  });
  return app;
}
