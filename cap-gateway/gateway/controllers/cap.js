import { HTTP_CODE, Endpoints, SERVICE_TIMEOUT } from '../constants.js';
import { sanitizeParams } from '../middlewares/sanitize.js';
import { schemaValidator } from '../middlewares/schemaValidator.js';
import cote from 'cote';

const Endpoint = Endpoints.cap;
const getError = error => ({
  error: error?.response?.data ?? error?.response?.message ?? error?.message ?? error?.response,
});

export function registerCapCalls(app) {
  const requester = new cote.Requester({ name: 'cap_requester_translate', timeout: SERVICE_TIMEOUT });

  app.post(Endpoint.translate, sanitizeParams, schemaValidator, async (req, res, next) => {
    try {
      const request = {
        type: 'translate',
        message: req.body.message,
        exportJson: req.body.exportJson ?? false,
        translator: req.body.translator
      };
      const r = await requester.send(request);
      if (r.status && r.error) {
        const error = new Error(r.error.message || 'An error occurred in the microservice');
        error.statusCode = r.status;
        error.stack = r.error.stack;
        return next(error);
      }
      res.send(r);
    } catch (error) {
      next(error);
    }
  });
}
