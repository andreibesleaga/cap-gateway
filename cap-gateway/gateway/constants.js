// Runtime configuration (environment variables with defaults)
const positiveInt = (value, fallback, name) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
};

export const ENV = process.env.NODE_ENV ?? 'development';
// ms to wait for a responder; must exceed the responder's worst case (TRANSLATOR_TIMEOUT x 2 for the llm engine)
export const SERVICE_TIMEOUT = positiveInt(process.env.SERVICE_TIMEOUT, 20000, 'SERVICE_TIMEOUT');
export const APP_URL = process.env.APP_URL ?? 'http://localhost';
export const APP_PORT = positiveInt(process.env.APP_PORT, 5000, 'APP_PORT');
// maximum JSON request body (express/body-parser size syntax); larger bodies get 413
export const BODY_LIMIT = process.env.BODY_LIMIT || '100kb';
// Directory for the Apache-style access log (empty string disables it)
export const ACCESS_LOGS_DIR = process.env.ACCESS_LOGS_DIR ?? './LOGS';

export const Endpoints = Object.freeze({
  health: '/health',
  admin: { pubsub: '/app/admin/services/pubsub' }, // starts the demo pub/sub heartbeat on a responder
  cap: { translate: '/app/cap/translate' }, // appends an English translation to a CAP alert
});

export const HTTP_CODE = Object.freeze({
  OK: 200,
  BadRequest: 400,
  NotFound: 404,
  PayloadTooLarge: 413,
  ServerError: 500,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
});
