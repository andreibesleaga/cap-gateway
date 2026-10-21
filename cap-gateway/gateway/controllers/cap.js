import { Endpoints, HTTP_CODE } from '../constants.js';
import { sanitizeParams } from '../middlewares/sanitize.js';
import { schemaValidator } from '../middlewares/schemaValidator.js';
import { sendToMesh } from '../mesh.js';

// POST /app/cap/translate { message: CAP XML, exportJson?: boolean }
export function registerCapCalls(app, requester) {
  app.post(Endpoints.cap.translate, sanitizeParams, schemaValidator, async (req, res) => {
    const exportJson = req.body.exportJson === true;
    const { reply, status, error } = await sendToMesh(requester, {
      type: 'translate',
      message: req.body.message,
      exportJson,
    });
    if (error) return res.status(status).json({ error });
    if (reply?.error !== undefined)
      return res.status(reply.status ?? HTTP_CODE.ServerError).json({ error: reply.error });

    res.set('X-Translation', reply.translation);
    return exportJson ? res.json(reply.message) : res.type('application/xml').send(reply.message);
  });
}
