import cote from 'cote';
import { Endpoints, SERVICE_TIMEOUT } from '../constants.js';
import { sanitizeParams } from '../middlewares/sanitize.js';
import { schemaValidator } from '../middlewares/schemaValidator.js';
import { sendFailure, sendServiceReply } from '../errors.js';

const Endpoint = Endpoints.cap;

export function registerCapCalls(app) {
  // one requester per route; cote balances its requests over the discovered responders
  const requester = new cote.Requester({ name: 'cap_requester_translate', timeout: SERVICE_TIMEOUT });

  app.post(Endpoint.translate, sanitizeParams, schemaValidator, async (req, res) => {
    try {
      const request = { type: 'translate', message: req.body.message, exportJson: req.body.exportJson ?? false };
      const reply = await requester.send(request);
      return sendServiceReply(res, reply);
    } catch (error) {
      return sendFailure(res, error);
    }
  });
}
