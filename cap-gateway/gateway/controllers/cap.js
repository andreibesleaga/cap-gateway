import { HTTP_CODE, Endpoints, SERVICE_TIMEOUT } from '../constants.js';
import { sanitizeParams } from '../middlewares/sanitize.js';
import  cote  from 'cote';

const Endpoint = Endpoints.cap;
const getError = error => ({ error: error?.response?.data ?? error?.response?.message ?? error?.message ?? error?.response});

export function registerCapCalls(app) {
  app.post(Endpoint.translate, sanitizeParams, async (req, res) => {
    try {
      const requester = new cote.Requester({ name: 'cap_requester_translate', timeout: SERVICE_TIMEOUT});
      const request = { type:'translate', message: req.body.message, exportJson: req.body.exportJson ?? false};
      let r = await requester.send(request);
      return (r.status!==undefined && r.error!==undefined) ? res.status(r.status).json({ error: r.error }) : res.send(r);
    } catch (error) {
      return res.status(error?.response?.status ?? HTTP_CODE.ServerError).json(getError(error));
    }
  });
}
