import { readFileSync } from 'fs';
import libxml from 'libxmljs';
import logger from '../logger.js';

import { HTTP_CODE } from '../constants.js';

export async function schemaValidator(req, res, next) {
  // middleware for validating received XML against provided schema XSD
  try {
    // Load XML and XSD files
    let xmlString = req.body.message ?? '';
    const xsdString = readFileSync('cap.xsd', 'utf-8');

    // Parse XML and XSD
    const xmlDoc = libxml.parseXml(xmlString);
    const xsdDoc = libxml.parseXml(xsdString);

    // Validate XML against XSD
    const isValid = xmlDoc.validate(xsdDoc);

    // Check validation result
    if (!isValid) {
      const validationErrors = xmlDoc.validationErrors;
      validationErrors.forEach(error => logger.error(error.message));

      return res.status(HTTP_CODE.BadRequest).json({
        error: 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema',
      });
    }
  } catch (error) {
    logger.error(error);
  }
  next();
}
