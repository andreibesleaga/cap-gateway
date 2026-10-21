// Runtime configuration (environment variables with the original defaults)
export const ENV = process.env.NODE_ENV ?? 'development';
export const SERVICE_TIMEOUT = Number(process.env.SERVICE_TIMEOUT ?? 3000); // ms to wait for a responder

export const APP_URL = process.env.APP_URL ?? 'http://localhost';
export const APP_PORT = Number(process.env.APP_PORT ?? 5000);

// Directory for the Apache-style access log (empty string disables it)
export const ACCESS_LOGS_DIR = process.env.ACCESS_LOGS_DIR ?? './LOGS';

// API Gateway endpoints, routed in controllers to the corresponding microservice messages
export const Endpoints = Object.freeze({
  admin: {
    pubsub: '/app/admin/services/pubsub', // starts the demo pub/sub heartbeat on a responder
  },
  cap: {
    translate: '/app/cap/translate', // translates a CAP alert into English
  },
});

// HTTP status codes used by the gateway
export const HTTP_CODE = Object.freeze({
  OK: 200,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  ServerError: 500,
  NotImplemented: 501,
  ServiceUnavailable: 503,
});
