/* eslint-disable no-unused-vars */
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { translateWithLibre } from './translator.js';

const getError = error => ({ error: error?.response?.data ?? error?.response?.message ?? error?.response });

const getLanguage = obj => {
  return obj.alert.info.language ?? 'autodetect';
};

// Function to traverse and modify the JSON object
const translateJson = async (obj, fromLang) => {
  for (let key in obj) {
    if (typeof obj[key] === 'string') {
      let newContent = await translateWithLibre(obj[key], fromLang.substring(0, 2), 'en');
      obj[key] += newContent;
    } else if (typeof obj[key] === 'object') {
      obj[key] = translateJson(obj[key], fromLang);
    }
  }
  return obj;
};

let translate = async (xmlMessage, exportJson) => {
  try {
    exportJson = typeof exportJson === 'undefined' ? false : exportJson;
    const parserOptions = {
      attributes: {
        ignore: false,
        booleanType: true,
      },
    };

    // Parse the XML to JSON
    const parser = new XMLParser(parserOptions);
    const alertData = parser.parse(xmlMessage);

    const languageFrom = getLanguage(alertData);
    if (languageFrom?.includes('en')) {
      return exportJson ? alertData : xmlMessage;
    }

    // Modify the JSON object - select the translation engine API
    const translatedInfo = await translateJson(alertData.alert.info, languageFrom);
    const modifiedJsonObj = alertData + translatedInfo;

    if (exportJson) {
      return modifiedJsonObj;
    } else {
      // Convert the modified JSON back to XML
      const builder = new XMLBuilder();
      const modifiedXmlData = builder.build(modifiedJsonObj);
      return modifiedXmlData;
    }
  } catch (error) {
    console.log(error);
    return { error: getError(error), status: 500 };
  }
};

export default {
  translate,
};
