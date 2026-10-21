import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { translateWithLibre } from './translator.js';
import logger from '../logger.js';

/**
 * Formats error response
 * @param {Error} error - Error object
 * @returns {Object} Formatted error object
 */
const getError = error => ({
  error: error?.response?.data ?? error?.response?.message ?? error?.message ?? error,
  details: error?.stack,
});

/**
 * Gets language from CAP alert
 * @param {Object} alertData - Parsed CAP alert data
 * @returns {string} Language code of the first <info> block ("en-US" when absent)
 */
const getLanguage = alertData => {
  try {
    // CAP 1.2 section 3.2.2: when <language> is absent, "en-US" is implied.
    const info = Array.isArray(alertData.alert.info) ? alertData.alert.info[0] : alertData.alert.info;
    return info.language ?? 'en-US';
  } catch (error) {
    logger.error('Error getting language from CAP alert:', error);
    throw new Error('Invalid CAP alert structure: unable to determine language', { cause: error });
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
    'identifier',
    'sender',
    'sent',
    'status',
    'msgType',
    'scope',
    'addresses',
    'code',
    'incidents',
    'language',
    'category',
    'responseType',
    'urgency',
    'severity',
    'certainty',
    'effective',
    'onset',
    'expires',
    'senderName',
    'headline',
    'web',
    'contact',
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
const translate = async (xmlMessage, exportJson = false, customTranslator = translateWithLibre) => {
  try {
    // Parse XML to JSON
    // values are kept as strings so that identifiers, dates and the XML declaration round-trip unchanged
    const parserOptions = {
      attributeNamePrefix: '@_',
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true,
    };

    const parser = new XMLParser(parserOptions);
    const alertData = parser.parse(xmlMessage);

    // Check if translation is needed (already English: return as received)
    const languageFrom = getLanguage(alertData);
    if (String(languageFrom).toLowerCase().startsWith('en')) {
      return exportJson ? alertData : xmlMessage;
    }

    // Translate the <info> block(s) in place; <alert> header fields are kept as they are
    logger.info('Starting CAP translation', {
      fromLanguage: languageFrom,
      translator: customTranslator.name,
    });

    const translatedAlert = {
      ...alertData,
      alert: {
        ...alertData.alert,
        info: Array.isArray(alertData.alert.info)
          ? await Promise.all(alertData.alert.info.map(info => translateObject(info, languageFrom, customTranslator)))
          : await translateObject(alertData.alert.info, languageFrom, customTranslator),
      },
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
      suppressEmptyNode: true,
    };

    const builder = new XMLBuilder(builderOptions);
    return builder.build(translatedAlert);
  } catch (error) {
    logger.error('CAP translation error:', error);
    return {
      error: getError(error),
      status: 500,
    };
  }
};

export default {
  translate,
  // Export for testing
  _translateObject: translateObject,
  _translateText: translateText,
  _getLanguage: getLanguage,
};
