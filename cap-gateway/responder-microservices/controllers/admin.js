import cote from 'cote';
import logger from '../logger.js';

const HEARTBEAT_INTERVAL_MS = 30000;

// Demo of inter-service pub/sub: a single publisher that, once started, broadcasts a
// random value every 30 s to every responder subscribed to 'randomUpdate'.
class AdminController {
  constructor() {
    this.publisher = null;
  }

  async pubsub() {
    if (this.publisher) {
      return { status: 'random heartbeat already running' };
    }
    this.publisher = new cote.Publisher({ name: 'Random Publisher', broadcasts: ['randomUpdate'] });
    setInterval(() => {
      const val = { val: Math.floor(Math.random() * 1000) };
      logger.info('emitting heartbeat', val);
      this.publisher.publish('randomUpdate', val);
    }, HEARTBEAT_INTERVAL_MS);
    return { status: 'random heartbeat started' };
  }
}

export default new AdminController();
