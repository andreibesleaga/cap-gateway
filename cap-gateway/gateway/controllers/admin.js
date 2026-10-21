import { Endpoints } from '../constants.js';
import { sanitizeParams } from '../middlewares/sanitize.js';
import { sendToMesh } from '../mesh.js';

// POST /app/admin/services/pubsub: starts the demo heartbeat publisher on one responder
export function registerAdminCalls(app, requester) {
  app.post(Endpoints.admin.pubsub, sanitizeParams, async (req, res) => {
    const { reply, status, error } = await sendToMesh(requester, { type: 'start' });
    return error ? res.status(status).json({ error }) : res.json(reply);
  });
}
