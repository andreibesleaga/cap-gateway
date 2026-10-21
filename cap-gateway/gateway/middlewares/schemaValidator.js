import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import libxml from 'libxmljs2';
import logger from '../logger.js';
import { HTTP_CODE } from '../constants.js';

// CAP 1.2 XSD (OASIS), parsed once; path resolved relative to this file, not the cwd
const XSD_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cap.xsd');
const xsdDoc = libxml.parseXml(readFileSync(XSD_PATH, 'utf-8'));

// Middleware: rejects a request whose `message` is not well-formed XML valid against CAP 1.2
export function schemaValidator(req, res, next) {
  let xmlDoc;
  try {
    xmlDoc = libxml.parseXml(req.body.message ?? '');
  } catch (error) {
    logger.error('XML parse error: %s', error.message);
    return res.status(HTTP_CODE.BadRequest).json({ error: 'message is not well-formed XML' });
  }

  if (!xmlDoc.validate(xsdDoc)) {
    xmlDoc.validationErrors.forEach(error => logger.error(error.message));
    return res.status(HTTP_CODE.BadRequest).json({
      error: 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema',
    });
  }
  return next();
}
