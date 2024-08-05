import { HTTP_CODE, Endpoints, SERVICE_TIMEOUT } from '../constants.js';
import { sanitizeParams } from '../middlewares/sanitize.js';
import  cote  from 'cote';

const Endpoint = Endpoints.admin;
const getError = error => ({ error: error?.response?.data ?? error?.response?.message ?? error?.message ?? error?.response});

export function registerAdminCalls(app) {
  app.post(Endpoint.pubsub, sanitizeParams, async (req, res) => {
    try {
      const requester = new cote.Requester({ name: 'admin_requester_pubsub', timeout: SERVICE_TIMEOUT});
      const request = { type:'start' };
      let r = await requester.send(request);
      return (r.status!==undefined && r.error!==undefined) ? res.status(r.status).json({ error: r.error }) : res.send(r);      
    } catch (error) {
      return res.status(error?.response?.status ?? HTTP_CODE.ServerError).json(getError(error));
    }
  });
}
