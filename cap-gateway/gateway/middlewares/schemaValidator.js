import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import libxml from 'libxmljs2';
import logger from '../logger.js';
import { HTTP_CODE } from '../constants.js';

// CAP 1.2 XSD (OASIS), parsed once; path resolved relative to this file, not the cwd
const XSD_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cap.xsd');
const xsdDoc = libxml.parseXml(readFileSync(XSD_PATH, 'utf-8'));
const MAX_DETAILS = 5;

/**
 * Checks that `xml` is a CAP 1.2 alert. A DOCTYPE is refused before parsing: CAP needs none, and
 * refusing it rules out entity expansion and external entities.
 * @returns {{ok: true} | {ok: false, error: string, details?: string[]}}
 */
export function validateCapXml(xml) {
  if (typeof xml !== 'string' || !xml) return { ok: false, error: 'message must be a string containing CAP XML' };
  if (/<!DOCTYPE/i.test(xml)) return { ok: false, error: 'DOCTYPE declarations are not allowed' };
  let doc;
  try {
    doc = libxml.parseXml(xml);
  } catch (error) {
    return { ok: false, error: 'message is not well-formed XML', details: [error.message.trim()] };
  }
  if (doc.validate(xsdDoc)) return { ok: true };
  return {
    ok: false,
    error: 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema',
    details: doc.validationErrors.slice(0, MAX_DETAILS).map(e => e.message.trim()),
  };
}

// Middleware: 400 unless req.body.message is a valid CAP 1.2 alert
export function schemaValidator(req, res, next) {
  const result = validateCapXml(req.body?.message);
  if (result.ok) return next();
  logger.warn('rejected message: %s %j', result.error, result.details ?? []);
  return res
    .status(HTTP_CODE.BadRequest)
    .json({ error: result.error, ...(result.details ? { details: result.details } : {}) });
}
