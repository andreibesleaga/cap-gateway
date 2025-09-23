import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { translateWithLibre } from './translator.js';
import logger from '../logger.js';

class CapServiceError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'CapServiceError';
    this.details = details;
  }
}

/**
 * Gets language from CAP alert
 * @param {Object} alertData - Parsed CAP alert data
 * @returns {string} Language code or null
 */
const getLanguage = alertData => {
  try {
    if (Array.isArray(alertData.alert.info)) {
      return alertData.alert.info[0].language ?? 'autodetect';
    }
    return alertData.alert.info.language ?? 'autodetect';
  } catch (error) {
    logger.error('Error getting language from CAP alert:', error);
    throw new Error('Invalid CAP alert structure: unable to determine language');
  }
};

/**
 * Translates text content while preserving special characters and formatting
 * @param {string} text - Text to translate
 * @param {string} fromLang - Source language
 * @param {Function} translateEngine - Translation function to use
 * @returns {Promise<string>} Translated text
 */
const translateText = async (text, fromLang, translateEngine) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }

  try {
    const translated = await translateEngine(text, fromLang, 'en');
    return translated || text; // Fallback to original if translation is empty
  } catch (error) {
    logger.warn(`Translation failed for text: "${text.substring(0, 50)}..."`, error);
    return text; // Return original text on translation failure
  }
};

/**
 * Recursively translates object values
 * @param {Object} obj - Object to translate
 * @param {string} fromLang - Source language
 * @param {Function} translateEngine - Translation function
 * @returns {Promise<Object>} Translated object
 */
const translateObject = async (obj, fromLang, translateEngine) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const translatedObj = Array.isArray(obj) ? [] : {};

  // Fields that should not be translated
  const skipFields = [
    'identifier', 'sender', 'sent', 'status', 'msgType', 'scope',
    'addresses', 'code', 'incidents', 'language', 'category',
    'responseType', 'urgency', 'severity', 'certainty', 'effective',
    'onset', 'expires', 'senderName', 'headline', 'web', 'contact'
  ];

  for (const [key, value] of Object.entries(obj)) {
    if (skipFields.includes(key)) {
      translatedObj[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      translatedObj[key] = await translateText(value, fromLang, translateEngine);
    } else if (Array.isArray(value)) {
      translatedObj[key] = await Promise.all(
        value.map(item =>
          typeof item === 'object'
            ? translateObject(item, fromLang, translateEngine)
            : translateText(item, fromLang, translateEngine)
        )
      );
    } else if (value && typeof value === 'object') {
      translatedObj[key] = await translateObject(value, fromLang, translateEngine);
    } else {
      translatedObj[key] = value;
    }
  }

  return translatedObj;
};

/**
 * Translates CAP message
 * @param {string} xmlMessage - XML message to translate
 * @param {boolean} [exportJson=false] - Whether to export as JSON
 * @param {Function} [customTranslator=translateWithLibre] - Custom translation function
 * @returns {Promise<string|Object>} Translated message
 */
import * as translators from './translator.js';

const translate = async (xmlMessage, exportJson = false, translator = 'translateWithLibre') => {
  const customTranslator = translators[translator] || translators.translateWithLibre;

  // Parse XML to JSON
  const parserOptions = {
    attributeNamePrefix: '@_',
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
    parseTagValue: true,
    numberParseOptions: {
      hex: true,
      leadingZeros: false
    }
  };

  const parser = new XMLParser(parserOptions);
  let alertData;
  try {
    alertData = parser.parse(xmlMessage);
  } catch (error) {
    logger.error('XML parsing error:', error);
    throw new CapServiceError('Invalid XML format', error.stack);
  }


  // Check if translation is needed
  const languageFrom = getLanguage(alertData);
  if (languageFrom?.toLowerCase().includes('en')) {
    return exportJson ? alertData : xmlMessage;
  }

  // Translate the alert info
  logger.info('Starting CAP translation', {
    fromLanguage: languageFrom,
    translator: customTranslator.name
  });

  const translatedAlert = {
    ...alertData,
    alert: {
      ...alertData.alert,
      info: Array.isArray(alertData.alert.info)
        ? await Promise.all(alertData.alert.info.map(info =>
          translateObject(info, languageFrom, customTranslator)
            ))
        : await translateObject(alertData.alert.info, languageFrom, customTranslator)
    }
  };

  if (exportJson) {
    return translatedAlert;
  }

  // Convert back to XML
  const builderOptions = {
    attributeNamePrefix: '@_',
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true
  };

  const builder = new XMLBuilder(builderOptions);
  return builder.build(translatedAlert);
};

export default {
  translate,
  // Export for testing
  _translateObject: translateObject,
  _translateText: translateText,
  _getLanguage: getLanguage
};
