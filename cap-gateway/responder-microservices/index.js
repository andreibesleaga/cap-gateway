import dotenv from 'dotenv';
import cote from 'cote';
import logger from './logger.js';

import AdminController from './controllers/admin.js';
import CapController from './controllers/cap.js';

dotenv.config({ silent: process.env.NODE_ENV === 'production' });

// Setup microservice responders
const service_responder = new cote.Responder({ name: 'service_responder' });

// Messages
service_responder.on('translate', async (req, cb) => {
    cb(null, await CapController.translate(req) );
});

// Admin 
service_responder.on('start', async (req, cb) => {
    cb(null, await AdminController.pubsub(req) );
});

// subscribe for microservice events
const randomSubscriber = new cote.Subscriber({
  name: 'Random Subscriber',
  // namespace: 'rnd',
  // key: 'a certain key',
  subscribesTo: ['randomUpdate'],
});
randomSubscriber.on('randomUpdate', (req) => {
  logger.info('notified of ', req);
});
