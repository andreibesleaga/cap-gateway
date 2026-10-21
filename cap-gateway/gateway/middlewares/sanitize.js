import { HTTP_CODE } from '../constants.js';

const MAX_PARAM_NAME_LENGTH = 50;
// C0 control characters that XML 1.0 forbids (tab, LF and CR are allowed)
// eslint-disable-next-line no-control-regex
const XML_ILLEGAL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

const malformed = res => res.status(HTTP_CODE.BadRequest).json({ error: 'Malformed Request' });

// Middleware: the JSON body must be an object with short parameter names; string values are trimmed and
// stripped of XML-illegal control characters. The body size is limited earlier by express.json (413).
export function sanitizeParams(req, res, next) {
  const body = req.body;
  if (body === undefined) return next();
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return malformed(res);
  for (const [key, value] of Object.entries(body)) {
    if (key.length > MAX_PARAM_NAME_LENGTH) return malformed(res);
    if (typeof value === 'string') body[key] = value.replace(XML_ILLEGAL_CHARS, '').trim();
  }
  return next();
}
