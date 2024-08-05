import cote from 'cote';
import logger from '../logger.js';

class AdminController {

  // eslint-disable-next-line no-unused-vars
  async pubsub(_req) {
    try {
        // Instantiate a new Publisher component.
        const randomPublisher = new cote.Publisher({
            name: 'Random Publisher',
            // namespace: 'rnd',
            // key: 'a certain key',
            broadcasts: ['randomUpdate'],
        });

        // Wait for the publisher to find an open port and listen on it.
        setInterval(function() {
            const val = {
                val: Math.floor(Math.random() * 1000),
            };
            logger.info('emitting heartbeat', val);
            // publish an event with arbitrary data at any time
            randomPublisher.publish('randomUpdate', val);
        }, 30000);
        return {"status":'random heartbeat started'};
    } catch (err) {
      return err;
    }
  }

}

export default new AdminController();
