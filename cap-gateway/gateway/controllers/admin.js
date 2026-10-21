import cote from 'cote';
import { Endpoints, SERVICE_TIMEOUT } from '../constants.js';
import { sanitizeParams } from '../middlewares/sanitize.js';
import { sendFailure, sendServiceReply } from '../errors.js';

const Endpoint = Endpoints.admin;

export function registerAdminCalls(app) {
  // one requester per route; cote balances its requests over the discovered responders
  const requester = new cote.Requester({ name: 'admin_requester_pubsub', timeout: SERVICE_TIMEOUT });

  app.post(Endpoint.pubsub, sanitizeParams, async (req, res) => {
    try {
      const reply = await requester.send({ type: 'start' });
      return sendServiceReply(res, reply);
    } catch (error) {
      return sendFailure(res, error);
    }
  });
}
