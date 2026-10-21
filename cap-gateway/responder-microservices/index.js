import cote from 'cote';
import logger from './logger.js';
import { parseConfig, describeConfig } from './config.js';
import { createEngine } from './services/translator.js';
import { createCapService } from './services/cap.js';
import { createCapController } from './controllers/cap.js';
import AdminController from './controllers/admin.js';

let config;
try {
  config = parseConfig(process.env);
} catch (error) {
  logger.error('invalid configuration: %s', error.message);
  process.exit(1);
}
logger.info('responder starting: %s', describeConfig(config));

const engine = createEngine(config, { logger });
const capController = createCapController({ service: createCapService({ engine, logger }), logger });

// one responder per process; the gateway balances requests over all responders it discovers
const responder = new cote.Responder({ name: 'service_responder' });
responder.on('translate', (req, cb) => capController.translate(req).then(result => cb(null, result)));
responder.on('start', (req, cb) => AdminController.pubsub(req).then(result => cb(null, result)));

// demo subscriber for the pub/sub heartbeat started by POST /app/admin/services/pubsub
const randomSubscriber = new cote.Subscriber({ name: 'Random Subscriber', subscribesTo: ['randomUpdate'] });
randomSubscriber.on('randomUpdate', req => logger.info('notified of %j', req));
