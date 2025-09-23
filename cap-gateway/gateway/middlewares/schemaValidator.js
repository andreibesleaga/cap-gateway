import { readFileSync } from 'fs';
import libxml from 'libxmljs';
import logger from '../logger.js';
import path from 'path';

import { HTTP_CODE } from '../constants.js';

export async function schemaValidator(req, res, next) {
  try {
    const xmlString = req.body.message || '';
    if (!xmlString) {
      return res.status(HTTP_CODE.BadRequest).json({ error: 'Missing XML message in request body' });
    }

    const xsdPath = path.join(process.cwd(), '..', 'cap.xsd');
    const xsdString = readFileSync(xsdPath, 'utf-8');
    const xmlDoc = libxml.parseXml(xmlString);
    const xsdDoc = libxml.parseXml(xsdString);

    if (xmlDoc.validate(xsdDoc)) {
      return next();
    }

    const validationErrors = xmlDoc.validationErrors.map(e => e.message);
    logger.error('XML validation error:', validationErrors);
    return res.status(HTTP_CODE.BadRequest).json({
      error: 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema',
      validationErrors,
    });
  } catch (error) {
    logger.error('Error in schema validator:', error);
    return res.status(HTTP_CODE.ServerError).json({ error: 'Internal server error during XML validation' });
  }
}
