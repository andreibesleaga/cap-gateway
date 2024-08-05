// API Gateway Endpoints - app URLs routed in controllers to coresponding microservices
export const Endpoints = Object.freeze({
  admin: {
    pubsub: '/app/admin/services/pubsub', // start admin pubsub messager to be received by all microservices subscribed
  },
  cap: {
    translate: '/app/cap/translate', //  sends a message;
  },
});

// HTTP CODES contants used in the main app server
export const HTTP_CODE = Object.freeze({
  OK: 200,
  BadRequest: 400,
  Unauthorized: 401,
  ServerError: 500,
  NotImplemented: 501,
  ServiceUnavailable: 503,
});

// microservice call timeout value
export const SERVICE_TIMEOUT = 3000;
